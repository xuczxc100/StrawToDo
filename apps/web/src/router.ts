import { createRouter, createWebHistory } from "vue-router";
import IssueList from "./views/IssueList.vue";
import IssueDetail from "./views/IssueDetail.vue";
import Board from "./views/Board.vue";
import Queue from "./views/Queue.vue";
import Login from "./views/Login.vue";
import { me } from "./api";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: Login, meta: { public: true } },
    { path: "/", name: "list", component: IssueList },
    { path: "/board", name: "board", component: Board },
    { path: "/queue", name: "queue", component: Queue },
    { path: "/issues/:id", name: "detail", component: IssueDetail, props: true },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;
  const who = await me();
  if (!who) return { path: "/login", query: { next: to.fullPath } };
  return true;
});
