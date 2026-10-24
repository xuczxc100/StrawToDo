<template>
  <section>
    <div class="row between">
      <h1>Queue</h1>
      <button class="primary" data-testid="queue-start" :disabled="busy" @click="start">
        執行下一張
      </button>
    </div>
    <p class="muted">只會派 Todo。全站同時最多一個 Agent Run。</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!todos.length" class="muted" data-testid="queue-empty">佇列是空的</p>
    <TransitionGroup v-else name="row" tag="ul" class="issue-list" data-testid="queue-list">
      <li v-for="(i, idx) in todos" :key="i.id">
        <router-link :to="`/issues/${i.identifier}`" :data-testid="`issue-${i.identifier}`">
          <span class="id">{{ idx + 1 }}. {{ i.identifier }}</span>
          <span>{{ i.title }}</span>
          <span class="status todo">Todo</span>
          <span class="faint">{{ i.priority }}</span>
        </router-link>
      </li>
    </TransitionGroup>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type Issue, type Run } from "../api";

const todos = ref<Issue[]>([]);
const error = ref("");
const busy = ref(false);
const router = useRouter();

async function load() {
  const data = await api<{ items: Issue[] }>("/v1/issues?status=todo&limit=100");
  todos.value = data.items;
}

async function start() {
  busy.value = true;
  error.value = "";
  try {
    const run = await api<Run>("/v1/queue/start", { method: "POST", body: "{}" });
    const issue = await api<Issue>(`/v1/issues/${run.issue_id}`);
    await router.push(`/issues/${issue.identifier}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
    await load().catch(() => undefined);
  }
}

onMounted(load);
</script>
