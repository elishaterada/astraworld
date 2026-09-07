import { randomUUID } from "node:crypto";
import { createGateway } from "./server";
import { joinSchema } from "../../packages/protocol";
import { ipAddress } from "@vercel/functions";
let instance: ReturnType<typeof createGateway> | undefined;
export function gateway() {
  if (!process.env.REDIS_URL) throw Error("REDIS_URL is required");
  const environment =
    process.env.VERCEL_ENV === "production" ? "production" : "preview";
  const suffix =
    environment === "production"
      ? "astraworld-m1"
      : `astraworld-${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12)}`;
  return (instance ??= createGateway({
    redisUrl: process.env.REDIS_URL,
    owner: `${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)}-${randomUUID()}`,
    prefix: `${environment}:${suffix}`,
    origins: [],
    rotationMs: 45000,
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
      ? await store.join(input.data.name, input.data.invite)
      : await store.create(input.data.name);
    return Response.json(s, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "This Meadow is unavailable or already has two adventurers." },
      { status: 503 },
    );
  }
}
