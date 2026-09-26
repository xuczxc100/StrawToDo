<template>
  <section class="panel" v-if="issue">
    <router-link class="back" to="/">← 返回列表</router-link>
    <div class="row between">
      <h1>
        <span class="id">{{ issue.identifier }}</span>
        {{ issue.title }}
      </h1>
      <select v-model="status" @change="saveStatus" data-testid="status-select">
        <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <p class="desc" data-testid="description">{{ issue.description || "（無描述）" }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <h2>留言</h2>
    <ul class="comments" data-testid="comments">
      <li v-for="c in comments" :key="c.id">
        <div class="meta">{{ c.created_by }} · {{ c.created_at }}</div>
        <div>{{ c.body }}</div>
      </li>
    </ul>
    <form class="create" @submit.prevent="addComment">
      <input v-model="commentBody" required placeholder="新增留言" data-testid="comment-input" />
      <button type="submit" data-testid="comment-btn">送出</button>
    </form>
  </section>
  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else class="muted">載入中…</p>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, type Comment, type Issue } from "../api";

const props = defineProps<{ id: string }>();
const statuses = ["backlog", "todo", "in_progress", "in_review", "done", "canceled"];
const issue = ref<Issue | null>(null);
const comments = ref<Comment[]>([]);
const status = ref("backlog");
const commentBody = ref("");
const error = ref("");

async function load() {
  error.value = "";
  try {
    issue.value = await api<Issue>(`/v1/issues/${encodeURIComponent(props.id)}`);
    status.value = issue.value.status;
    const c = await api<{ items: Comment[] }>(
      `/v1/issues/${encodeURIComponent(props.id)}/comments`,
    );
    comments.value = c.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function saveStatus() {
  if (!issue.value) return;
  try {
    issue.value = await api<Issue>(`/v1/issues/${issue.value.identifier}`, {
      method: "PATCH",
      body: JSON.stringify({ status: status.value }),
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function addComment() {
  if (!issue.value) return;
  try {
    await api(`/v1/issues/${issue.value.identifier}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentBody.value }),
    });
    commentBody.value = "";
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(load);
watch(() => props.id, load);
</script>
