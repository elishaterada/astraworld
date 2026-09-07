import { experimental_upgradeWebSocket } from "@vercel/functions";
import {
  gateway,
  sameOrigin,
} from "../../../../apps/game-server/vercel-realtime";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!sameOrigin(request)) return new Response("Forbidden", { status: 403 });
  const runner = await gateway();
  return experimental_upgradeWebSocket(
    (socket) => runner.acceptSocket(socket),
    { maxPayload: 8192 },
  );
}
