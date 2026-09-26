import { createRouter, createWebHistory } from "vue-router";
import IssueList from "./views/IssueList.vue";
import IssueDetail from "./views/IssueDetail.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "list", component: IssueList },
    { path: "/issues/:id", name: "detail", component: IssueDetail, props: true },
  ],
});
