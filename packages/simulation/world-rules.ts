import type { CompanionCommand, CompanionReceipt } from "../protocol/taming";
import type { TamingState } from "./taming";
export type WorldRules = { friendlyFire: boolean };
/** Creator identity is supplied by authenticated server membership, never by the command. */
export function setWorldRule(
  rules: WorldRules | undefined,
  taming: TamingState,
  creator: string | undefined,
  actor: string,
  command: CompanionCommand,
  tick: number,
) {
  const prior = taming.receipts[actor];
  if (prior && command.seq <= prior.seq) return { rules, taming };
  const permitted =
    actor === creator && (command.target === "on" || command.target === "off");
  const receipt: CompanionReceipt = {
    ...command,
    tick,
    result: permitted ? "settings-updated" : "forbidden",
  };
  return {
    rules: permitted ? { friendlyFire: command.target === "on" } : rules,
    taming: { ...taming, receipts: { ...taming.receipts, [actor]: receipt } },
  };
}
