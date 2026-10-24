<template>
  <div class="issue-page">
  <section v-if="issue">
    <router-link class="back" to="/board">← Board</router-link>
    <div class="row between">
      <h1>
        <span class="id">{{ issue.identifier }}</span>
        {{ issue.title }}
      </h1>
      <div class="row">
        <select v-model="status" data-testid="status-select" @change="saveStatus">
          <option v-for="s in statuses" :key="s" :value="s">{{ labels[s] }}</option>
        </select>
        <button class="primary" data-testid="run-btn" :disabled="running" @click="runAgent">
          {{ running ? "執行中" : issue.status === "in_review" ? "Restart" : "執行 Agent" }}
        </button>
        <button v-if="activeRun" class="ghost" data-testid="stop-btn" @click="stopRun">停止</button>
      </div>
    </div>
    <p class="desc" data-testid="description">{{ issue.description || "（無描述）" }}</p>
    <div class="props">
      <div class="prop"><span class="faint">優先</span><span>{{ issue.priority }}</span></div>
      <div class="prop"><span class="faint">類型</span><span>{{ issue.issue_type }}</span></div>
      <div class="prop"><span class="faint">執行者</span><span>{{ issue.assignee_type }}</span></div>
      <div class="prop"><span class="faint">狀態</span><span :class="['st', issue.status]">{{ labels[issue.status] }}</span></div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <h2>Agent Run</h2>
    <p v-if="!latestRun" class="muted">還沒有派過工。</p>
    <div v-else>
      <p class="faint">{{ latestRun.status }} · {{ latestRun.model }}</p>
      <pre class="log" data-testid="run-log">{{ latestRun.log_text || "（尚無輸出）" }}</pre>
    </div>

    <h2>留言</h2>
    <TransitionGroup name="row" tag="ul" class="comments" data-testid="comments">
      <li v-for="c in comments" :key="c.id" :class="c.author_type">
        <div class="meta">{{ c.author_type === "agent" ? "Agent" : "你" }} · {{ c.created_at }}</div>
        <div>{{ c.body }}</div>
      </li>
    </TransitionGroup>
    <form class="create" @submit.prevent="addComment">
      <input v-model="commentBody" required placeholder="新增留言" data-testid="comment-input" />
      <button type="submit" data-testid="comment-btn">送出</button>
    </form>
  </section>
  <p v-else-if="error" class="error">{{ error }}</p>
  <p v-else class="muted">載入中…</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { api, STATUS_LABEL, STATUSES, type Comment, type Issue, type Run } from "../api";

const props = defineProps<{ id: string }>();
const statuses = STATUSES;
const labels = STATUS_LABEL;
const issue = ref<Issue | null>(null);
const comments = ref<Comment[]>([]);
const runs = ref<Run[]>([]);
const status = ref("backlog");
const commentBody = ref("");
const error = ref("");
let timer: number | undefined;

const latestRun = computed(() => runs.value[0] || null);
const activeRun = computed(() =>
  runs.value.find((r) => r.status === "running" || r.status === "queued") || null,
);
const running = computed(() => Boolean(activeRun.value));

async function load() {
  error.value = "";
  try {
    issue.value = await api<Issue>(`/v1/issues/${encodeURIComponent(props.id)}`);
    status.value = issue.value.status;
    const c = await api<{ items: Comment[] }>(
      `/v1/issues/${encodeURIComponent(props.id)}/comments`,
    );
    comments.value = c.items;
    const r = await api<{ items: Run[] }>(
      `/v1/issues/${encodeURIComponent(props.id)}/runs`,
    );
    runs.value = r.items;
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

async function runAgent() {
  if (!issue.value) return;
  error.value = "";
  try {
    if (issue.value.status === "done") {
      throw new Error("Done 的 Issue 不能再派工");
    }
    await api(`/v1/issues/${issue.value.identifier}/runs`, {
      method: "POST",
      body: "{}",
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function stopRun() {
  if (!activeRun.value) return;
  try {
    await api(`/v1/runs/${activeRun.value.id}/cancel`, { method: "POST" });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

onMounted(() => {
  load();
  timer = window.setInterval(() => {
    if (running.value) load();
  }, 1500);
});
onUnmounted(() => {
  if (timer) window.clearInterval(timer);
});
watch(() => props.id, load);
</script>
