import {
  STONE_AXE_RECIPE,
  WORKBENCH_COST,
  WORKBENCH_PLOTS,
} from "../content/crafting";
import type { GatherCommand, Inventory, ItemId, Progress } from "../content";
import type { World } from "../world";
import type { RealtimeActor } from "../protocol/realtime";
import { collides } from "./index";
import { addItems, type GatheringState } from "./gathering";
import { combatBusy } from "./combat";
/** Work, costs and receipts are a single pure transition in the durable gather stream. */
export function craft(
  world: World,
  state: GatheringState,
  actor: RealtimeActor,
  actors: RealtimeActor[],
  command: GatherCommand,
  tick: number,
  occupied: readonly { x: number; y: number }[] = [],
): GatheringState {
  const p = state.players[actor.id];
  if (!p || command.seq !== (p.receipt?.seq ?? 0) + 1) return state;
  let result: NonNullable<Progress["receipt"]>["result"] = "missing",
    inventory = p.inventory,
    benches = state.benches;
  const costs: Partial<Record<ItemId, number>> | undefined =
    command.action === "craft" && command.target === STONE_AXE_RECIPE.id
      ? STONE_AXE_RECIPE.inputs
      : command.action === "place" &&
          WORKBENCH_PLOTS.some((b) => b.id === command.target)
        ? { wood: WORKBENCH_COST }
        : undefined;
  if (actor.combat?.health === 0) result = "dead";
  else if (combatBusy(actor.combat, tick)) result = "busy";
  else if (tick < p.readyTick) result = "cooldown";
  else if (costs) {
    const next: Inventory = inventory.map((s) => s && { ...s });
    result = "crafted";
    for (const [item, quantity] of Object.entries(costs)) {
      let left = quantity;
      for (let i = 0; i < next.length; i++) {
        const s = next[i];
        if (s?.item !== item) continue;
        const take = Math.min(left, s.quantity);
        left -= take;
        s.quantity -= take;
        if (!s.quantity) next[i] = null;
      }
      if (left) result = "ingredients";
    }
    if (result === "crafted") {
      if (command.action === "craft") {
        const added = addItems(next, "stone-axe", 1);
        if (added) inventory = added;
        else result = "full";
      } else {
        const plot = WORKBENCH_PLOTS.find((b) => b.id === command.target)!;
        if (
          Math.hypot(actor.position.x - plot.x, actor.position.y - plot.y) > 2
        )
          result = "range";
        else if (
          benches?.some((b) => b.id === plot.id) ||
          [...actors.map((a) => a.position), ...occupied].some(
            (position) =>
              Math.abs(position.x - plot.x) < 0.85 &&
              Math.abs(position.y - plot.y) < 0.85,
          )
        )
          result = "occupied";
        else if (collides(world, plot)) result = "blocked";
        else {
          inventory = next;
          benches = [...(benches ?? []), { ...plot, owner: actor.id }];
          result = "placed";
        }
      }
    }
  }
  return {
    ...state,
    benches,
    players: {
      ...state.players,
      [actor.id]: {
        ...p,
        inventory,
        receipt: { ...command, result, tick },
        readyTick:
          result === "crafted" || result === "placed" ? tick + 30 : p.readyTick,
      },
    },
  };
}
