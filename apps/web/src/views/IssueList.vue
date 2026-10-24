<template>
  <section>
    <div class="row between">
      <h1>Issues</h1>
      <div class="row">
        <select v-model="status" @change="load" data-testid="status-filter">
          <option value="">全部狀態</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ labels[s] }}</option>
        </select>
        <select v-model="projectId" @change="load" data-testid="project-filter">
          <option value="">全部專案</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>

    <form class="create" @submit.prevent="create">
      <input v-model="title" required placeholder="新建議題標題（快捷鍵 C）" data-testid="new-title" />
      <select v-model="newStatus">
        <option value="todo">Todo</option>
        <option value="backlog">Backlog</option>
      </select>
      <button class="primary" type="submit" data-testid="create-btn">建立</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="muted">載入中…</p>
    <p v-else-if="!issues.length" class="muted" data-testid="empty">尚無議題</p>
    <ul v-else class="issue-list" data-testid="issue-list">
      <li v-for="i in issues" :key="i.id">
        <router-link :to="`/issues/${i.identifier}`" :data-testid="`issue-${i.identifier}`">
          <span class="id">{{ i.identifier }}</span>
          <span class="title">{{ i.title }}</span>
          <span :class="['status', i.status]">{{ labels[i.status] || i.status }}</span>
          <span class="faint">{{ i.priority }}</span>
        </router-link>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api, STATUS_LABEL, STATUSES, type Issue, type Project } from "../api";

const statuses = STATUSES;
const labels = STATUS_LABEL;
const issues = ref<Issue[]>([]);
const projects = ref<Project[]>([]);
const status = ref("");
const projectId = ref("");
const title = ref("");
const newStatus = ref("todo");
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const q = new URLSearchParams();
    if (status.value) q.set("status", status.value);
    if (projectId.value) q.set("project_id", projectId.value);
    q.set("limit", "100");
    const data = await api<{ items: Issue[] }>(`/v1/issues?${q}`);
    issues.value = data.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function loadProjects() {
  try {
    const data = await api<{ items: Project[] }>("/v1/projects");
    projects.value = data.items;
  } catch {
    /* ignore until key set */
  }
}

async function create() {
  error.value = "";
  try {
    await api("/v1/issues", {
      method: "POST",
      body: JSON.stringify({ title: title.value, status: newStatus.value }),
    });
    title.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === "c" || e.key === "C") {
    e.preventDefault();
    document.querySelector<HTMLInputElement>("[data-testid=new-title]")?.focus();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  await loadProjects();
  await load();
});
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>
