<script setup lang="ts">
/* La séance locale : classement (ListPicker), joueurs, règles
   (résumé + RulesModal), lancement. */
import { computed, ref, watch } from "vue";
import { useGameStore } from "../stores/game";
import { useListStore } from "../stores/list";
import { useProfileStore } from "../stores/profile";
import { useSettingsStore } from "../stores/settings";
import ListPicker from "./ListPicker.vue";
import RulesModal from "./RulesModal.vue";

const game = useGameStore();
const list = useListStore();
const profile = useProfileStore();
const settings = useSettingsStore();

/* ---- joueurs : pas de noms préremplis, validation au lancement ---- */
const DEFAULTS = ["Joueur 1", "Joueur 2"];
const n1 = ref(DEFAULTS.includes(game.names[0]) ? "" : game.names[0]);
const n2 = ref(DEFAULTS.includes(game.names[1]) ? "" : game.names[1]);
const nameErr = ref("");
watch([n1, n2], () => { nameErr.value = ""; });
/* le profil connecté joue en Joueur 1 */
watch(() => profile.username, (u) => {
  if (u && n1.value === "") n1.value = u;
}, { immediate: true });

function launch() {
  if (!n1.value.trim() || !n2.value.trim()) {
    nameErr.value = "Veuillez rentrer des noms de joueur";
    return;
  }
  game.start(n1.value, n2.value);
}

/* ---- règles : résumé + modale ---- */
const showRules = ref(false);
const ruleSummary = computed(() => {
  const m = settings.mode === "rounds"
    ? `${settings.rounds} manches` : `course à ${settings.target} pts`;
  const t = settings.timer ? `chrono ${settings.timer} s` : "sans chrono";
  const s2 = settings.start === "alt" ? "premier joueur alterné" : "premier joueur aléatoire";
  return `${m} · ${t} · ${s2}`;
});
</script>

<template>
  <section>
    <div class="setHead">La séance</div>

    <ListPicker />

    <div class="actLbl">Joueurs</div>
    <div class="row2">
      <div class="field" style="margin-bottom:0">
        <label>Joueur 1</label>
        <input id="n1" v-model="n1" type="text" maxlength="18" placeholder="entre un nom">
      </div>
      <div class="field" style="margin-bottom:0">
        <label>Joueur 2</label>
        <input id="n2" v-model="n2" type="text" maxlength="18" placeholder="entre un nom">
      </div>
    </div>
    <div v-if="nameErr" class="formErr" style="text-align:center">{{ nameErr }}</div>

    <div class="actLbl">Règles</div>
    <div class="ruleSummary">
      <span class="sum">{{ ruleSummary }}</span>
      <button class="ghost" @click="showRules = true">Personnaliser</button>
    </div>
    <RulesModal :open="showRules" @close="showRules = false" />

    <div class="btnrow launchRow">
      <button class="big xl" :disabled="!list.ready" @click="launch">Lancer la séance</button>
    </div>
  </section>
</template>
