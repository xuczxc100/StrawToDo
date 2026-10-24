<template>
  <div v-if="isLogin" class="login-only">
    <router-view />
  </div>
  <div v-else class="app-shell">
    <aside class="side">
      <router-link class="brand" to="/board">StrawToDo</router-link>
      <div class="ver">{{ version || "Linear × Agent" }}</div>
      <router-link class="nav" to="/board">Board</router-link>
      <router-link class="nav" to="/">List</router-link>
      <router-link class="nav" to="/queue">Queue</router-link>
    </aside>
    <div class="main">
      <div class="top-tools">
        <span class="muted">{{ username }}</span>
        <button class="ghost" type="button" data-testid="logout-btn" @click="doLogout">登出</button>
      </div>
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { loadUiConfig, logout, me } from "./api";

const route = useRoute();
const router = useRouter();
const version = ref("");
const username = ref("");
const isLogin = computed(() => route.path === "/login");

onMounted(async () => {
  const cfg = await loadUiConfig();
  version.value = cfg.version ? `v${cfg.version}` : "";
  const who = await me();
  username.value = who?.username || "";
});

async function doLogout() {
  await logout();
  username.value = "";
  await router.push("/login");
}
</script>
