import { issueSession } from "../../../../apps/game-server/vercel";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = issueSession;
