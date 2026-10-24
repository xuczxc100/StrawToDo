import { createRouter, createWebHistory } from "vue-router";
import IssueList from "./views/IssueList.vue";
import IssueDetail from "./views/IssueDetail.vue";
import Board from "./views/Board.vue";
import Queue from "./views/Queue.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "list", component: IssueList },
    { path: "/board", name: "board", component: Board },
    { path: "/queue", name: "queue", component: Queue },
    { path: "/issues/:id", name: "detail", component: IssueDetail, props: true },
  ],
});
