<template>
  <section>
    <div class="row between">
      <h1>Board</h1>
      <form class="create" style="margin:0" @submit.prevent="create">
        <input v-model="title" required placeholder="新建並放入 Todo" data-testid="new-title" />
        <button class="primary" type="submit" data-testid="create-btn">建立</button>
      </form>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="board" data-testid="board">
      <div
        v-for="col in columns"
        :key="col"
        class="col"
        :class="{ over: over === col }"
        :data-testid="`col-${col}`"
        @dragover.prevent="over = col"
        @dragleave="over = over === col ? '' : over"
        @drop.prevent="drop(col)"
      >
        <div class="col-h">
          <span>{{ labels[col] }}</span>
          <span>{{ byStatus(col).length }}</span>
        </div>
        <router-link
          v-for="i in byStatus(col)"
          :key="i.id"
          class="chip"
          :to="`/issues/${i.identifier}`"
          draggable="true"
          :data-testid="`issue-${i.identifier}`"
          @dragstart="dragging = i.identifier"
        >
          <span class="id">{{ i.identifier }}</span>
          <span><i :class="['pri', i.priority]"></i>{{ i.title }}</span>
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, STATUS_LABEL, type Issue } from "../api";

const columns = ["backlog", "todo", "in_progress", "in_review", "done"] as const;
const labels = STATUS_LABEL;
const issues = ref<Issue[]>([]);
const title = ref("");
const error = ref("");
const dragging = ref("");
const over = ref("");

function byStatus(status: string) {
  return issues.value.filter((i) => i.status === status);
}

async function load() {
  error.value = "";
  try {
    const data = await api<{ items: Issue[] }>("/v1/issues?limit=100");
    issues.value = data.items.filter((i) => i.status !== "canceled");
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function create() {
  try {
    await api("/v1/issues", {
      method: "POST",
      body: JSON.stringify({ title: title.value, status: "todo" }),
    });
    title.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function drop(status: string) {
  const id = dragging.value;
  over.value = "";
  dragging.value = "";
  if (!id) return;
  try {
    await api(`/v1/issues/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(load);
</script>
