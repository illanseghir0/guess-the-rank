/* ============================================================
   stores/rooms.ts — le salon « entre amis »
   Cycle de vie en DB via RPC (create/set_config/invite/join/leave),
   synchronisation en direct par postgres_changes (RLS respectée) :
   l'hôte et l'invité voient le même salon, les invitations arrivent
   en toast. Quitter dissout le salon — rien de persistant.
   ============================================================ */

import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { reportError } from "../lib/telemetry";
import { useProfileStore } from "./profile";
import type { DbInviteRow, GameInvite, Room, RoomConfig } from "../types";

export const useRoomStore = defineStore("rooms", () => {
  const enabled = !!supabase;
  const room = ref<Room | null>(null);
  const invites = ref<GameInvite[]>([]);
  /** dernière invitation arrivée en direct (toast global) */
  const toast = ref<GameInvite | null>(null);
  /** message quand le salon vient d'être dissous par l'hôte */
  const dissolved = ref(false);
  const busy = ref(false);

  const profile = useProfileStore();
  const isHost = computed(() => !!room.value && room.value.host === profile.profile?.id);

  /* ---- cycle de vie ---- */

  async function createRoom(config: RoomConfig): Promise<string | null> {
    if (!supabase || !profile.profile) return "Connexion requise";
    busy.value = true;
    try {
      const { data, error } = await supabase.rpc("create_room", { p_config: config });
      if (error) { reportError("room_create", error.message); return "Impossible d'ouvrir le salon"; }
      room.value = data as Room;
      dissolved.value = false;
      watchRoom();
      return null;
    } finally { busy.value = false; }
  }

  async function setConfig(config: RoomConfig): Promise<void> {
    if (!supabase || !room.value) return;
    const { data, error } = await supabase.rpc("set_room_config",
      { p_room: room.value.id, p_config: config });
    if (error) { reportError("room_config", error.message); return; }
    room.value = data as Room;
  }

  async function invite(friendId: string): Promise<string | null> {
    if (!supabase || !room.value) return "Pas de salon ouvert";
    busy.value = true;
    try {
      const { error } = await supabase.rpc("invite_friend",
        { p_room: room.value.id, p_to: friendId });
      if (!error) return null;
      if (/déjà invité/.test(error.message)) return "Déjà invité";
      if (/complet/.test(error.message)) return "Le salon est complet";
      reportError("room_invite", error.message);
      return error.message;
    } finally { busy.value = false; }
  }

  async function join(inv: GameInvite): Promise<string | null> {
    if (!supabase || !profile.profile) return "Connexion requise";
    busy.value = true;
    try {
      const { data, error } = await supabase.rpc("join_room", { p_room: inv.room_id });
      if (error) {
        invites.value = invites.value.filter((i) => i.room_id !== inv.room_id);
        return /complet|fermé/.test(error.message)
          ? "Trop tard — le salon est complet ou fermé" : error.message;
      }
      room.value = data as Room;
      dissolved.value = false;
      invites.value = invites.value.filter((i) => i.room_id !== inv.room_id);
      watchRoom();
      return null;
    } finally { busy.value = false; }
  }

  async function decline(inv: GameInvite): Promise<void> {
    if (!supabase || !profile.profile) return;
    await supabase.from("game_invites").delete()
      .eq("room_id", inv.room_id).eq("to_user", profile.profile.id);
    invites.value = invites.value.filter((i) => i.room_id !== inv.room_id);
    if (toast.value?.room_id === inv.room_id) toast.value = null;
  }

  /** quitter : l'hôte dissout, l'invité libère sa place */
  async function leave(): Promise<void> {
    if (!supabase || !room.value) return;
    const id = room.value.id;
    stopRoomWatch();
    room.value = null;
    const { error } = await supabase.rpc("leave_room", { p_room: id });
    if (error) reportError("room_leave", error.message);
  }

  /* ---- synchro du salon (postgres_changes, RLS respectée) ---- */
  let roomChannel: RealtimeChannel | null = null;

  function watchRoom() {
    stopRoomWatch();
    if (!supabase || !room.value) return;
    roomChannel = supabase
      .channel(`room:${room.value.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.value.id}` },
        (payload) => {
          const next = payload.new as Room;
          if (next.status === "closed") {
            // l'hôte a dissous le salon
            if (!isHost.value) dissolved.value = true;
            stopRoomWatch();
            room.value = null;
            return;
          }
          room.value = next;
        })
      .subscribe();
  }

  function stopRoomWatch() {
    roomChannel?.unsubscribe();
    roomChannel = null;
  }

  /* ---- invitations reçues : chargement + arrivées en direct ---- */
  let inviteChannel: RealtimeChannel | null = null;

  async function loadInvites() {
    if (!supabase || !profile.profile) { invites.value = []; return; }
    const { data, error } = await supabase
      .from("game_invites")
      .select("room_id,from_user,created_at,from_profile:profiles!game_invites_from_user_fkey(username)")
      .eq("to_user", profile.profile.id)
      .order("created_at", { ascending: false });
    if (error) { reportError("invites_load", error.message); return; }
    invites.value = ((data ?? []) as unknown as DbInviteRow[]).map((r): GameInvite => ({
      room_id: r.room_id, from_user: r.from_user, created_at: r.created_at,
      from_username: r.from_profile?.username ?? "?",
    }));
  }

  function startInviteWatch() {
    if (!supabase || !profile.profile || inviteChannel) return;
    loadInvites();
    inviteChannel = supabase
      .channel("invites")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "game_invites",
          filter: `to_user=eq.${profile.profile.id}` },
        async () => {
          await loadInvites();
          toast.value = invites.value[0] ?? null;
        })
      .subscribe();
  }

  function stopInviteWatch() {
    inviteChannel?.unsubscribe();
    inviteChannel = null;
    invites.value = [];
    toast.value = null;
  }

  return {
    enabled, room, invites, toast, dissolved, busy, isHost,
    createRoom, setConfig, invite, join, decline, leave,
    loadInvites, startInviteWatch, stopInviteWatch, watchRoom, stopRoomWatch,
  };
});
