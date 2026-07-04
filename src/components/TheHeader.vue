<script setup lang="ts">
import { useGameStore } from "../stores/game";
import { useListStore } from "../stores/list";
import { useProfileStore } from "../stores/profile";

const game = useGameStore();
const list = useListStore();
const profile = useProfileStore();

/* le titre ramène à l'accueil (sauf en pleine partie) */
function homeClick() {
  if (game.screen !== "play") game.goHome();
}
</script>

<template>
  <header class="bar">
    <div v-if="profile.enabled && game.screen !== 'play'" class="topbar">
      <span v-if="profile.profile" class="profileChip" role="button" tabindex="0"
            :title="`${profile.profile.games_won} victoires / ${profile.profile.games_played} séances`"
            style="cursor:pointer" @click="game.goProfile()" @keydown.enter="game.goProfile()">
        <span class="u">{{ profile.profile.username }}</span>
        · {{ profile.profile.games_won }} V
      </span>
      <button v-else class="mini ghost" @click="game.goProfile()">Connexion</button>
    </div>

    <div class="billing">A Letterboxd Game</div>
    <h1 @click="homeClick">Guess the Rank</h1>
    <div class="rule"><span>{{ list.headerTag }}</span></div>
  </header>
</template>
