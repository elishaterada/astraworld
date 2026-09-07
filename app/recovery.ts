import { z } from "zod";
import {
  id,
  credential,
  name,
  characterSchema,
  type Session,
} from "../packages/protocol";
import { SESSION_STORAGE_KEY } from "../packages/protocol/capacity";
export const recoverySchema = z
  .object({
    worldId: id,
    playerId: id,
    token: credential,
    invite: credential,
    seed: z.literal("meadow-001"),
    name,
    character: characterSchema,
    durable: z.literal(true),
  })
  .strict();
export function parseRecovery(raw: string): Session {
  if (raw.length > 4096) throw Error("Choose an Astraworld recovery file.");
  try {
    return recoverySchema.parse(JSON.parse(raw));
  } catch {
    throw Error("Choose a valid Astraworld recovery file.");
  }
}
export function rememberSession(session: Session) {
  // Storage denial must not turn a successful admission into a duplicate join.
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {}
  if (session.durable)
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {}
}
export function downloadRecovery(session: Session) {
  const raw = JSON.stringify(recoverySchema.parse(session), null, 2);
  const url = URL.createObjectURL(
    new Blob([raw], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "astraworld-recovery.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
