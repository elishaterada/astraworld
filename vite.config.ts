import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NEXT_PUBLIC_GAME_GATEWAYS": JSON.stringify(
      process.env.NEXT_PUBLIC_GAME_GATEWAYS ?? "",
    ),
  },
  server: { host: "127.0.0.1", allowedHosts: ["astraworld.localhost"] },
});
