import { issueSession } from "../../../../apps/game-server/vercel-realtime";
export const runtime = "nodejs";
export const maxDuration = 300;
export const POST = issueSession;
