<script setup lang="ts">
/* L'affiche du film en jeu : halo, cadre, états de chargement,
   et le tilt 3D au survol (desktop uniquement). Partagée par tous
   les écrans de jeu — la mise en scène doit rester identique. */
import { ref } from "vue";
import type { Film } from "../types";
import { REDUCE } from "../lib/env";

defineProps<{ film: Film }>();

const zone = ref<HTMLElement | null>(null);
const tiltOk = !REDUCE && matchMedia("(pointer:fine)").matches;
function onTilt(e: PointerEvent) {
  if (!tiltOk || !zone.value) return;
  const r = zone.value.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
  zone.value.style.transform = `perspective(700px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg)`;
}
function offTilt() { if (zone.value) zone.value.style.transform = ""; }
</script>

<template>
  <div ref="zone" class="posterZone" @pointermove="onTilt" @pointerleave="offTilt">
    <img v-if="film.poster" class="glow" :src="film.poster" alt="">
    <div class="poster">
      <img v-if="film.poster" :src="film.poster" alt="affiche">
      <div v-else-if="film.poster === undefined" class="ph"><div class="loader"></div></div>
      <div v-else class="ph">
        <div class="ico">🎞️</div>
        <div class="t">{{ film.title }}</div>
        <div v-if="film.year" class="y">{{ film.year }}</div>
      </div>
    </div>
  </div>
</template>
