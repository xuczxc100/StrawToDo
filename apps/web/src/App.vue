<template>
  <div class="app">
    <header class="top">
      <router-link class="brand" to="/">StrawToDo</router-link>
      <span class="tag">Agent-first · v0.1</span>
      <div class="key-box">
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
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getApiKey, setApiKey } from "./api";

const apiKey = ref("");
onMounted(() => {
  apiKey.value = getApiKey();
});
function saveKey() {
  setApiKey(apiKey.value.trim());
}
</script>
