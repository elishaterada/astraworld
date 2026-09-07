import { MAX_PLAYERS, ROOM_REVISION } from "../../packages/protocol/capacity";
import { randomUUID } from "node:crypto";
import { createRealtimeGateway } from "./realtime";
import { joinSchema } from "../../packages/protocol";
import { ipAddress } from "@vercel/functions";
let instance: ReturnType<typeof createRealtimeGateway> | undefined;
export function gateway() {
  if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required for M6");
  if (!process.env.REDIS_URL) throw Error("REDIS_URL is required");
  const environment =
    process.env.VERCEL_ENV === "production" ? "production" : "preview";
  const suffix =
    environment === "production"
      ? `astraworld-m1v2-${ROOM_REVISION}`
      : `astraworld-v2-${ROOM_REVISION}-${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12)}`;
  return (instance ??= createRealtimeGateway({
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    owner: `${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}-${randomUUID()}`,
    prefix: `${environment}:${suffix}`,
    origins: [],
  }).catch((error) => {
    instance = undefined;
    throw error;
  }));
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}
const rates = new Map<string, { start: number; count: number }>();
export async function issueSession(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const now = Date.now(),
    ip = ipAddress(request) ?? "unknown";
  for (const [key, value] of rates)
    if (now - value.start > 60000) rates.delete(key);
  const rate = rates.get(ip) ?? { start: now, count: 0 };
  rates.set(ip, rate);
  if (++rate.count > 20 || rates.size > 1000)
    return new Response("Too many requests", { status: 429 });
  const reader = request.body?.getReader();
  let raw = "";
  let size = 0;
  const decoder = new TextDecoder();
  if (!reader) return new Response("Body required", { status: 400 });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const input = joinSchema.safeParse(JSON.parse(raw));
    if (!input.success)
      return Response.json(
        { error: "Choose a valid name and invitation." },
        { status: 400 },
      );
    const { store } = await gateway();
    const s = input.data.invite
      ? await store.join(
          input.data.name,
          input.data.invite,
          input.data.character,
        )
      : await store.create(input.data.name, input.data.character);
    return Response.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        error: `This Meadow is unavailable or full (${MAX_PLAYERS} adventurers).`,
      },
      { status: 503 },
    );
  }
}
