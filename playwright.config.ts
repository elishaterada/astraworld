import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 900 },
    headless: true,
    launchOptions: {
      args:
        process.platform === "darwin"
          ? ["--use-gl=angle", "--use-angle=metal"]
          : [
              "--use-gl=angle",
              "--use-angle=swiftshader",
              "--enable-unsafe-swiftshader",
            ],
    },
  },
  reporter: "list",
});
