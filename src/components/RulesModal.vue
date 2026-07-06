<script setup lang="ts">
/* Modale des règles (mode, manches/objectif, chrono, ordre de passage).
   Opère directement sur le store settings — extrait de SetupScreen pour
   resservir au salon « entre amis » (online=true masque l'ordre de
   passage : en ligne, tout le monde devine en même temps). */
import { computed } from "vue";
import { useSettingsStore } from "../stores/settings";

const props = withDefaults(defineProps<{ open: boolean; online?: boolean }>(),
  { online: false });
const emit = defineEmits<{ close: [] }>();
void props;

const settings = useSettingsStore();

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
function timerOn() { if (!settings.timer) settings.timer = 10; }
function setTimer(e: Event) {
  settings.timer = parseInt((e.target as HTMLInputElement).value, 10);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal" @click.self="emit('close')">
      <div class="panel rulesPanel">
        <div class="setHead" style="margin-bottom:26px">Règles</div>
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
            <label>Chrono par tour</label>
            <div class="seg">
              <div class="s" :class="{ on: settings.timer === 0 }" @click="settings.timer = 0">Sans chrono</div>
              <div class="s" :class="{ on: settings.timer > 0 }" @click="timerOn">Chrono</div>
            </div>
            <div v-if="settings.timer > 0" class="timerRow">
              <input type="range" min="3" max="30" step="1" :value="settings.timer" @input="setTimer">
              <span class="timerVal">{{ settings.timer }} s</span>
            </div>
          </div>

          <div v-if="!online" class="field">
            <label>Qui devine en premier ?</label>
            <div class="seg">
              <div class="s" :class="{ on: settings.start === 'alt' }" @click="settings.start = 'alt'">Alterné</div>
              <div class="s" :class="{ on: settings.start === 'random' }" @click="settings.start = 'random'">Aléatoire</div>
            </div>
          </div>
        </div>
        <div class="btnrow" style="margin-top:26px">
          <button class="big" @click="emit('close')">Valider</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
