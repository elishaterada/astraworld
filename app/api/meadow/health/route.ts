import { gateway } from "../../../../apps/game-server/vercel";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const runner = await gateway();
    return Response.json(
      { ready: runner.store.redis.isReady, owner: runner.owner },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ ready: false }, { status: 503 });
  }
}
