<template>
  <div class="login-wrap">
    <Transition appear name="login">
      <form class="login-card" data-testid="login-form" @submit.prevent="submit">
        <h1>StrawToDo</h1>
        <p class="muted">登入後才能安排任務、派 Agent。</p>
        <label>
          帳號
          <input v-model="username" data-testid="login-user" autocomplete="username" required />
        </label>
        <label>
          密碼
          <input
            v-model="password"
            type="password"
            data-testid="login-pass"
            autocomplete="current-password"
            required
          />
        </label>
        <Transition name="fade">
          <p v-if="error" class="error" data-testid="login-error">{{ error }}</p>
        </Transition>
        <button class="primary" type="submit" data-testid="login-btn" :disabled="busy">登入</button>
      </form>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../api";

const username = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
const router = useRouter();

async function submit() {
  busy.value = true;
  error.value = "";
  try {
    await login(username.value, password.value);
    await router.replace("/board");
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>
