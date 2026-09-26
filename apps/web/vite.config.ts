import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3041,
    proxy: {
      "/v1": process.env.VITE_API_PROXY || "http://localhost:3040",
      "/docs": process.env.VITE_API_PROXY || "http://localhost:3040",
      "/openapi.json": process.env.VITE_API_PROXY || "http://localhost:3040",
    },
  },
});
