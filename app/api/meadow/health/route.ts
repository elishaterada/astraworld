import { gateway } from "../../../../apps/game-server/vercel";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const runner = await gateway();
    const started = performance.now();
    await runner.store.redis.ping();
    return Response.json(
      {
        ready: runner.store.redis.isReady,
        owner: runner.owner,
        redisRoundTripMs: performance.now() - started,
        region: process.env.VERCEL_REGION ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    const started = performance.now();
    await runner.store.redis.ping();
    return Response.json({ ready: false }, { status: 503 });
  }
}
