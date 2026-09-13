import { createRealtimeGateway } from "./realtime";
import { createGateway } from "./server";

const {
  DATABASE_URL,
  REDIS_URL,
  GAME_NAMESPACE,
  LEGACY_NAMESPACE,
  WEB_ORIGINS,
} = process.env;
if (
  !DATABASE_URL ||
  !REDIS_URL ||
  !GAME_NAMESPACE ||
  !LEGACY_NAMESPACE ||
  !WEB_ORIGINS
) {
  throw new Error("Missing required Meadow server configuration");
}
const origins = WEB_ORIGINS.split(",");
console.info("[DEBUG-migration-origin]", JSON.stringify({ origins, namespace: GAME_NAMESPACE }));
const realtime = await createRealtimeGateway({
  databaseUrl: DATABASE_URL,
  redisUrl: REDIS_URL,
  prefix: GAME_NAMESPACE,
  origins,
  trustedProxy: true,
});
const legacy = await createGateway({
  redisUrl: REDIS_URL,
  prefix: LEGACY_NAMESPACE,
  origins,
  rotationMs: 45000,
});
realtime.server.prependListener("request", (req, res) => {
  if (req.url === "/health") {
    res.setHeader("x-meadow-debug-origins", origins.join(","));
    res.setHeader("x-meadow-debug-namespace", GAME_NAMESPACE);
  }
});
realtime.server.listen(8080, "0.0.0.0");
legacy.server.listen(8081, "0.0.0.0");
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void Promise.all([realtime.close(), legacy.close()]).then(() =>
      process.exit(0),
    );
  });
}
