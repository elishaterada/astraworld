import { CAPACITY_REVISION } from "../../packages/protocol/capacity";
import { createRealtimeGateway } from "./realtime";
const gateway = await createRealtimeGateway({
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6380",
  prefix:
    process.env.GAME_NAMESPACE ?? `local:astraworld-v2-${CAPACITY_REVISION}`,
  origins: (
    process.env.WEB_ORIGINS ?? "http://127.0.0.1:3002,http://localhost:3002"
  ).split(","),
  owner: process.env.GATEWAY_ID,
  socketAgeMs: Number(process.env.SOCKET_AGE_MS) || undefined,
});
const port = Number(process.env.GAME_PORT ?? 3103);
gateway.server.listen(port, "127.0.0.1", () =>
  console.log(`Meadow gateway ${gateway.owner} on http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void gateway.close().then(() => process.exit(0));
  });
