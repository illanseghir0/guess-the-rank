<script setup lang="ts">
/* Choix du classement : carrousel auto-défilant + galerie « voir tout ».
   Extrait de SetupScreen pour resservir au salon « entre amis ».
   remember=false : la sélection ne devient pas la liste par défaut
   du mode local. Émet "selected" après chargement de la liste. */
import { computed, onMounted, onUnmounted, ref } from "vue";
import { REDUCE } from "../lib/env";
import { useListStore } from "../stores/list";
import type { CatalogEntry } from "../types";

const props = withDefaults(defineProps<{ remember?: boolean }>(), { remember: true });
const emit = defineEmits<{ selected: [entry: CatalogEntry] }>();

const list = useListStore();

onMounted(() => list.loadCatalog());
/* contenu doublé pour un défilement en boucle sans couture */
const loop = computed(() =>
  list.catalog.length ? [...list.catalog, ...list.catalog] : []);

/* Le rail est déplacé par transform, position possédée à 100 % en JS :
   pas de scrollLeft (que le navigateur clampe à 0), pas de scroll natif
   concurrent. Survol = ralenti. Flèches = exactement une carte,
   cumulables. Glissement au doigt géré par pointer events. */
const track = ref<HTMLElement | null>(null);
const posR = ref(0);               // position du rail (px, sans limite)
let rafId = 0;
let tween: number | null = null;   // cible des flèches
const hovering = ref(false);
const dragging = ref(false);
let dragStartX = 0, dragStartPos = 0, dragMoved = false;
const SPEED = 0.5, SPEED_HOVER = 0.12;

const trackStyle = computed(() => ({ transform: `translate3d(${-posR.value}px,0,0)` }));

function cardWidth(): number {
  const c = track.value?.querySelector<HTMLElement>(".lcard");
  return c ? c.offsetWidth + parseFloat(getComputedStyle(c).marginRight || "0") : 338;
}

function carTick() {
  if (!dragging.value) {
    if (tween !== null) {
      const d = tween - posR.value;
      posR.value += d * 0.16;
      if (Math.abs(d) < 0.8) { posR.value = tween; tween = null; }
    } else if (!REDUCE) {
      posR.value += hovering.value ? SPEED_HOVER : SPEED;
    }
  }
  // boucle sans couture : deux copies, on replie modulo une copie
  const w = (track.value?.scrollWidth ?? 0) / 2;
  if (w > 0) {
    let shift = 0;
    if (posR.value >= w) shift = -w;
    else if (posR.value < 0) shift = w;
    if (shift) {
      posR.value += shift;
      if (tween !== null) tween += shift;
      dragStartPos += shift;
    }
  }
  rafId = requestAnimationFrame(carTick);
}
onMounted(() => { rafId = requestAnimationFrame(carTick); });
onUnmounted(() => cancelAnimationFrame(rafId));

function carNav(dir: number) {
  tween = (tween ?? posR.value) + dir * cardWidth(); // clics cumulables
}

/* glissement (souris ou doigt) — la capture n'est prise qu'à partir d'un
   vrai déplacement (>7px), sinon les cartes deviennent incliquables */
let pressed = false;
function dragDown(e: PointerEvent) {
  pressed = true; dragMoved = false;
  dragStartX = e.clientX; dragStartPos = posR.value;
}
function dragMove(e: PointerEvent) {
  if (!pressed) return;
  const dx = e.clientX - dragStartX;
  if (!dragging.value) {
    if (Math.abs(dx) < 7) return;      // simple clic : on ne s'en mêle pas
    dragging.value = true; tween = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  dragMoved = true;
  posR.value = dragStartPos - dx;
}
function dragUp() { pressed = false; dragging.value = false; }

async function pick(entry: CatalogEntry) {
  await list.selectList(entry, props.remember);
  if (list.ready) emit("selected", entry);
}
/* un vrai glissement ne doit pas sélectionner la carte relâchée */
function cardClick(entry: CatalogEntry) {
  if (dragMoved) { dragMoved = false; return; }
  pick(entry);
}

const showAll = ref(false);   // galerie « voir tout »
</script>

<template>
  <div class="actLbl">Choisis le classement
    <button class="ghost lblBtn" @click="showAll = true">Voir tout</button>
  </div>
  <div class="field" style="margin-bottom:0">
    <div class="carWrap">
      <div class="carousel" :class="{ grabbing: dragging }"
           @pointerenter="hovering = true" @pointerleave="hovering = false"
           @pointerdown="dragDown" @pointermove="dragMove"
           @pointerup="dragUp" @pointercancel="dragUp">
        <div ref="track" class="ctrack" :style="trackStyle">
          <div v-for="(e, i) in loop" :key="i" class="lcard"
               :class="{ sel: e.slug === list.selectedSlug }" role="button" tabindex="0"
               @click="cardClick(e)" @keydown.enter="pick(e)">
            <img v-if="e.cover" :src="e.cover" alt="" loading="lazy">
            <div class="lgrad"></div>
            <div class="linfo">
              <div class="lt">{{ e.title }}</div>
              <div class="lc">{{ e.count }} films</div>
            </div>
          </div>
        </div>
      </div>
      <button class="cnav next" type="button" aria-label="Classements suivants" @click="carNav(1)">›</button>
    </div>

    <div v-if="list.status && list.status.type !== 'ok'" class="statusWrap">
      <span class="statusChip" :class="list.status.type">
        <span class="dotc"></span><span>{{ list.status.msg }}</span>
      </span>
    </div>
  </div>

  <!-- galerie « voir tout ». Teleport : la section animée capturerait le fixed -->
  <Teleport to="body">
    <div v-if="showAll" class="modal" @click.self="showAll = false">
      <div class="panel allPanel">
        <div class="allHead">
          <div class="setHead" style="margin-bottom:0">Tous les classements</div>
          <button class="ghost lblBtn" @click="showAll = false">Fermer</button>
        </div>
        <div class="lgrid">
          <div v-for="e in list.catalog" :key="e.slug" class="lcard"
               :class="{ sel: e.slug === list.selectedSlug }" role="button" tabindex="0"
               @click="pick(e)" @keydown.enter="pick(e)">
            <img v-if="e.cover" :src="e.cover" alt="" loading="lazy">
            <div class="lgrad"></div>
            <div class="linfo">
              <div class="lt">{{ e.title }}</div>
              <div class="lc">{{ e.count }} films</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
