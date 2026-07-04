<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useGameStore } from "../stores/game";
import { useListStore } from "../stores/list";
import { useProfileStore } from "../stores/profile";

const game = useGameStore();
const list = useListStore();
const profile = useProfileStore();

const showRules = ref(false);

/* ---- citations pour l'accueil ---- */
const QUOTES: Array<[string, string]> = [
  ["« La vie, c'est comme une boîte de chocolats : on ne sait jamais sur quoi on va tomber. »", "Forrest Gump — 1994"],
  ["« Je suis le roi du monde ! »", "Titanic — 1997"],
  ["« Que la Force soit avec toi. »", "Star Wars — 1977"],
  ["« Franchement, ma chère, c'est le cadet de mes soucis. »", "Autant en emporte le vent — 1939"],
  ["« La première règle du Fight Club est : il est interdit de parler du Fight Club. »", "Fight Club — 1999"],
  ["« I'll be back. »", "Terminator — 1984"],
  ["« Toto, j'ai l'impression que nous ne sommes plus au Kansas. »", "Le Magicien d'Oz — 1939"],
  ["« C'est pas ta faute. »", "Will Hunting — 1997"],
  ["« Un grand pouvoir implique de grandes responsabilités. »", "Spider-Man — 2002"],
  ["« Voici venir ton coucher de soleil, cow-boy. »", "Il était une fois dans l'Ouest — 1968"],
  ["« E.T. téléphone maison. »", "E.T. l'extra-terrestre — 1982"],
];
const quote = ref<[string, string]>(QUOTES[0]);
onMounted(() => { quote.value = QUOTES[(Math.random() * QUOTES.length) | 0]; });
</script>

<template>
  <section>
    <div class="tagline">Deux cinéphiles, une liste culte.<br>
      Un film s'affiche — <b>qui devinera son rang au plus près ?</b></div>

    <div v-if="list.ready" class="affiche">À l'affiche : <b>{{ list.listTitle }}</b> · {{ list.films!.length }} films</div>

    <nav class="menu">
      <div class="menuRow" role="button" tabindex="0"
           @click="game.goSetup()" @keydown.enter="game.goSetup()">
        <span class="num">01</span>
        <span class="lbl">Nouvelle séance</span>
        <span class="arr">→</span>
        <span class="sub">{{ list.ready ? list.listTitle : "choisis ton classement" }}</span>
      </div>
      <div v-if="profile.enabled" class="menuRow" role="button" tabindex="0"
           @click="game.goProfile()" @keydown.enter="game.goProfile()">
        <span class="num">02</span>
        <span class="lbl">Carte de membre</span>
        <span class="arr">→</span>
        <span class="sub">{{ profile.profile
          ? `${profile.profile.username} · ${profile.profile.games_won} victoires`
          : "rejoindre le club" }}</span>
      </div>
      <div class="menuRow" role="button" tabindex="0"
           @click="showRules = !showRules" @keydown.enter="showRules = !showRules">
        <span class="num">{{ profile.enabled ? "03" : "02" }}</span>
        <span class="lbl">Comment jouer</span>
        <span class="arr">{{ showRules ? "↑" : "↓" }}</span>
        <span class="sub">les règles, en trois actes</span>
      </div>
    </nav>

    <div v-if="showRules" class="acts">
      <div class="act">
        <div class="roman">Acte I</div>
        <p>Une affiche apparaît. Le titre, l'année, la main du cinéaste : tout est là —
          sauf sa place dans le classement.</p>
      </div>
      <div class="act">
        <div class="roman">Acte II</div>
        <p>Chacun son tour, en secret, on parie sur son rang. L'écran passe de main
          en main, les certitudes vacillent.</p>
      </div>
      <div class="act">
        <div class="roman">Acte III</div>
        <p>La révélation. Le pari le plus proche l'emporte, et le générique de fin
          départage les cinéphiles.</p>
      </div>
    </div>

    <div class="strip"></div>
    <div class="quote">
      <span>{{ quote[0] }}</span>
      <span class="qa">{{ quote[1] }}</span>
    </div>
  </section>
</template>
