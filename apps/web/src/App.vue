<template>
  <div class="app-shell">
    <aside class="side">
      <router-link class="brand" to="/board">StrawToDo</router-link>
      <div class="ver">{{ version || "Linear × Agent" }}</div>
      <router-link class="nav" to="/board">Board</router-link>
      <router-link class="nav" to="/">List</router-link>
      <router-link class="nav" to="/queue">Queue</router-link>
    </aside>
    <div class="main">
      <div class="top-tools">
        <label for="apiKey">API Key</label>
        <input
          id="apiKey"
          v-model="apiKey"
          type="password"
          placeholder="std_…"
          autocomplete="off"
          @change="saveKey"
        />
      </div>
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getApiKey, loadUiConfig, setApiKey } from "./api";

const apiKey = ref("");
const version = ref("");

onMounted(async () => {
  const cfg = await loadUiConfig();
  version.value = cfg.version ? `v${cfg.version}` : "";
  apiKey.value = getApiKey();
});

function saveKey() {
  setApiKey(apiKey.value.trim());
}
</script>
