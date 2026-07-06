import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import type { Room } from "../src/types";

const ME = "00000000-0000-0000-0000-0000000000aa";
const HOSTE = "00000000-0000-0000-0000-0000000000bb";
const ROOM: Room = {
  id: "11111111-1111-1111-1111-111111111111", host: ME, guest: null,
  status: "lobby", config: { mode: "rounds", rounds: 10 }, created_at: "2026-07-06",
};

const { rpcSpy, channelSpy } = vi.hoisted(() => ({
  rpcSpy: vi.fn(async (fn: string) => (
    fn === "create_room" || fn === "join_room" || fn === "set_room_config"
      ? { data: { ...ROOM }, error: null } : { data: null, error: null })),
  channelSpy: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() })),
}));

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    rpc: rpcSpy,
    channel: channelSpy,
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ error: null, data: [
        { room_id: ROOM.id, from_user: HOSTE, created_at: "2026-07-06",
          from_profile: { username: "hoster" } },
      ] }) }) }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  },
}));

import { useRoomStore } from "../src/stores/rooms";
import { useProfileStore } from "../src/stores/profile";

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  rpcSpy.mockClear();
  channelSpy.mockClear();
  useProfileStore().profile = {
    id: ME, username: "moi", games_played: 0, games_won: 0, best_gap: null,
  };
});

describe("rooms store — cycle de vie du salon", () => {
  it("ouvre un salon avec la config de l'hôte et s'y abonne", async () => {
    const rooms = useRoomStore();
    const err = await rooms.createRoom({ mode: "rounds", rounds: 10 });
    expect(err).toBeNull();
    expect(rpcSpy).toHaveBeenCalledWith("create_room",
      { p_config: { mode: "rounds", rounds: 10 } });
    expect(rooms.room?.id).toBe(ROOM.id);
    expect(rooms.isHost).toBe(true);
    expect(channelSpy).toHaveBeenCalledWith(`room:${ROOM.id}`);
  });

  it("invite un ami via la RPC (validation d'amitié côté SQL)", async () => {
    const rooms = useRoomStore();
    await rooms.createRoom({});
    const err = await rooms.invite(HOSTE);
    expect(err).toBeNull();
    expect(rpcSpy).toHaveBeenCalledWith("invite_friend",
      { p_room: ROOM.id, p_to: HOSTE });
  });

  it("traduit « déjà invité » et « salon complet »", async () => {
    const rooms = useRoomStore();
    await rooms.createRoom({});
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: "déjà invité" } } as never);
    expect(await rooms.invite(HOSTE)).toBe("Déjà invité");
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: "le salon est complet" } } as never);
    expect(await rooms.invite(HOSTE)).toBe("Le salon est complet");
  });

  it("charge les invitations avec le pseudo de l'hôte", async () => {
    const rooms = useRoomStore();
    await rooms.loadInvites();
    expect(rooms.invites).toHaveLength(1);
    expect(rooms.invites[0]).toMatchObject({ room_id: ROOM.id, from_username: "hoster" });
  });

  it("rejoint un salon depuis une invitation et la retire de la liste", async () => {
    const rooms = useRoomStore();
    await rooms.loadInvites();
    const err = await rooms.join(rooms.invites[0]);
    expect(err).toBeNull();
    expect(rpcSpy).toHaveBeenCalledWith("join_room", { p_room: ROOM.id });
    expect(rooms.room?.id).toBe(ROOM.id);
    expect(rooms.invites).toHaveLength(0);
  });

  it("salon complet au join : message clair et invitation retirée", async () => {
    const rooms = useRoomStore();
    await rooms.loadInvites();
    rpcSpy.mockResolvedValueOnce({ data: null, error: { message: "salon complet ou fermé" } } as never);
    const err = await rooms.join(rooms.invites[0]);
    expect(err).toMatch(/complet ou fermé/);
    expect(rooms.invites).toHaveLength(0);
  });

  it("quitter appelle leave_room et vide l'état local", async () => {
    const rooms = useRoomStore();
    await rooms.createRoom({});
    await rooms.leave();
    expect(rpcSpy).toHaveBeenCalledWith("leave_room", { p_room: ROOM.id });
    expect(rooms.room).toBeNull();
  });
});
