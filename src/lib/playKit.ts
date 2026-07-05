/* ============================================================
   playKit.ts — boîte à outils partagée des écrans de jeu
   (PlayScreen, CompetPlayScreen, et les modes à venir)
   Chaque écran garde sa mise en page ; la mécanique commune
   vit ici : saisie du pari, compteur animé du vrai rang.
   Le chrono est dans useTurnTimer, l'affiche dans PosterZone.
   ============================================================ */

import { ref, watch } from "vue";
import type { Film } from "../types";
import { REDUCE } from "./env";
import { useGameStore } from "../stores/game";
import { useListStore } from "../stores/list";

/** sous-titre de la fiche film : « 1994 · de Frank Darabont » */
export function filmSubtitle(f: Film | null): string {
  if (!f) return "";
  return [f.year, f.director ? `de ${f.director}` : null].filter(Boolean).join(" · ");
}

/** champ de pari : validation avec secousse si hors bornes, et
    auto-validation à l'expiration du chrono (saisie en cours ou hasard) */
export function useGuessInput() {
  const game = useGameStore();
  const list = useListStore();
  const gval = ref("");
  const shaking = ref(false);
  const guessInput = ref<HTMLInputElement | null>(null);

  function validate() {
    const v = parseInt(gval.value, 10);
    if (!game.submitGuess(v)) {
      shaking.value = false;
      requestAnimationFrame(() => { shaking.value = true; });
      guessInput.value?.focus();
      return;
    }
    gval.value = "";
  }

  /** temps écoulé : on valide la saisie en cours, sinon pari au hasard */
  function expireGuess() {
    const v = parseInt(gval.value, 10);
    const guess = v >= 1 && v <= list.maxRank ? v : 1 + ((Math.random() * list.maxRank) | 0);
    gval.value = "";
    game.submitGuess(guess);
  }

  return { gval, shaking, guessInput, validate, expireGuess };
}

/** compteur animé du vrai rang pendant la révélation (« # ? » -> « #123 ») */
export function useRankCounter(opts: {
  stage: () => number;
  film: () => Film | null;
  revealing: () => boolean;
}) {
  const list = useListStore();
  const displayRank = ref("# ?");
  watch(opts.stage, (st) => {
    const f = opts.film();
    if (!f) return;
    if (st < 1) { displayRank.value = "# ?"; return; }
    if (REDUCE || st > 1) { displayRank.value = "#" + f.rank; return; }
    const to = f.rank, from = to <= list.maxRank / 2 ? list.maxRank : 1;
    const t0 = performance.now(), dur = 950;
    (function step(t: number) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      displayRank.value = "#" + Math.round(from + (to - from) * e);
      if (p < 1 && opts.revealing()) requestAnimationFrame(step);
    })(t0);
  });
  return displayRank;
}
