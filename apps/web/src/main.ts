import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { loadUiConfig } from "./api";
import "./styles.css";

void loadUiConfig().finally(() => {
  createApp(App).use(router).mount("#app");
});
