<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useGameStore } from "../stores/game";
import { useListStore } from "../stores/list";
import { useProfileStore } from "../stores/profile";
import { useSettingsStore } from "../stores/settings";

const game = useGameStore();
const list = useListStore();
const profile = useProfileStore();
const settings = useSettingsStore();

/* ---- le classement : carrousel du catalogue ---- */
onMounted(() => list.loadCatalog());
/* contenu doublé pour un défilement en boucle sans couture */
const loop = computed(() =>
  list.catalog.length ? [...list.catalog, ...list.catalog] : []);

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

/* ---- règles ---- */
const ROUND_PRESETS = [5, 10, 15, 20];
const TARGET_PRESETS = [500, 1000, 2000];
const roundsCustom = computed(() =>
  ROUND_PRESETS.includes(settings.rounds) ? "" : String(settings.rounds));
const targetCustom = computed(() =>
  TARGET_PRESETS.includes(settings.target) ? "" : String(settings.target));

function setRoundsCustom(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  if (v >= 1 && v <= 99) settings.rounds = v;
}
function setTargetCustom(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10);
  if (v >= 50 && v <= 99999) settings.target = v;
}
</script>

<template>
  <section>
    <div class="setHead">La séance</div>

    <div class="actLbl">Choisis le classement</div>
    <div class="field" style="margin-bottom:0">
      <div class="carousel">
        <div class="ctrack">
          <div v-for="(e, i) in loop" :key="i" class="lcard"
               :class="{ sel: e.slug === list.selectedSlug }" role="button" tabindex="0"
               @click="list.selectList(e)" @keydown.enter="list.selectList(e)">
            <img v-if="e.cover" :src="e.cover" alt="" loading="lazy">
            <div class="lgrad"></div>
            <div class="linfo">
              <div class="lt">{{ e.title }}</div>
              <div class="lc">{{ e.count }} films</div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="list.status && list.status.type !== 'ok'" class="statusWrap">
        <span class="statusChip" :class="list.status.type">
          <span class="dotc"></span><span>{{ list.status.msg }}</span>
        </span>
      </div>
    </div>

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
    <div class="rulesWrap">
      <div class="field">
        <label>Mode de jeu</label>
        <div class="seg">
          <div class="s" :class="{ on: settings.mode === 'rounds' }" @click="settings.mode = 'rounds'">Nombre de manches</div>
          <div class="s" :class="{ on: settings.mode === 'points' }" @click="settings.mode = 'points'">Course aux points</div>
        </div>
        <div class="modeNote">{{ settings.modeNote }}</div>
      </div>

      <div v-if="settings.mode === 'rounds'" class="field">
        <label>Manches</label>
        <div class="rounds">
          <div v-for="r in ROUND_PRESETS" :key="r" class="r"
               :class="{ on: settings.rounds === r }" @click="settings.rounds = r">{{ r }}</div>
          <input type="number" min="1" max="99" inputmode="numeric" placeholder="custom"
                 title="Nombre personnalisé" :value="roundsCustom" @input="setRoundsCustom">
        </div>
      </div>

      <div v-else class="field">
        <label>Objectif de points</label>
        <div class="rounds">
          <div v-for="t in TARGET_PRESETS" :key="t" class="r"
               :class="{ on: settings.target === t }" @click="settings.target = t">{{ t }}</div>
          <input type="number" min="50" max="99999" inputmode="numeric" placeholder="custom"
                 title="Objectif personnalisé" :value="targetCustom" @input="setTargetCustom">
        </div>
      </div>

      <div class="field">
        <label>Qui devine en premier ?</label>
        <div class="seg">
          <div class="s" :class="{ on: settings.start === 'alt' }" @click="settings.start = 'alt'">Alterné</div>
          <div class="s" :class="{ on: settings.start === 'random' }" @click="settings.start = 'random'">Aléatoire</div>
        </div>
      </div>
    </div>

    <div class="btnrow" style="margin-top:32px">
      <button class="big" :disabled="!list.ready" @click="launch">Lancer la séance</button>
    </div>
  </section>
</template>
