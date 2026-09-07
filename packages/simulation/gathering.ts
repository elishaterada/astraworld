import {
  CONTENT,
  itemDefinition,
  type Inventory,
  type ItemId,
  type Progress,
  type GatherCommand,
} from "../content";
import { isSolid, type World } from "../world";
import type { ResourceNode } from "../world/resources";
import type { Position } from "./index";
export type GatheringState = {
  players: Record<string, Progress>;
  depleted: string[];
};
export const emptyGathering = (): GatheringState => ({
  players: {},
  depleted: [],
});
export function addItems(
  inventory: Inventory,
  item: ItemId,
  quantity: number,
): Inventory | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return null;
  const next = inventory.map((s) => (s ? { ...s } : null)),
    max = itemDefinition(item).stackMax;
  for (const slot of next)
    if (slot?.item === item) {
      const n = Math.min(quantity, max - slot.quantity);
      slot.quantity += n;
      quantity -= n;
    }
  for (let i = 0; i < next.length && quantity; i++)
    if (!next[i]) {
      const n = Math.min(quantity, max);
      next[i] = { item, quantity: n };
      quantity -= n;
    }
  return quantity ? null : next;
}
export function interactionClear(
  world: World,
  from: Position,
  node: ResourceNode,
) {
  const steps = Math.ceil(Math.hypot(node.x - from.x, node.y - from.y) * 32);
  for (let i = 0; i <= steps; i++) {
    const x = Math.floor(from.x + ((node.x - from.x) * i) / Math.max(1, steps)),
      y = Math.floor(from.y + ((node.y - from.y) * i) / Math.max(1, steps));
    if (x === Math.floor(node.x) && y === Math.floor(node.y)) continue;
    if (isSolid(world, x, y)) return false;
  }
  return true;
}
/** Pure, serial room transition. Membership identity is supplied only by the gateway. */
export function gather(
  world: World,
  nodes: Map<string, ResourceNode>,
  state: GatheringState,
  player: string,
  position: Position,
  command: GatherCommand,
  tick: number,
  unavailable?: "dead" | "busy",
): GatheringState {
  const p = state.players[player];
  if (!p || command.seq !== (p.receipt?.seq ?? 0) + 1) return state;
  const node = nodes.get(command.target),
    definition = CONTENT.resources.find((d) => d.id === node?.kind);
  let result: NonNullable<Progress["receipt"]>["result"] = "gathered";
  let inventory = p.inventory;
  if (unavailable) result = unavailable;
  else if (!node || !definition) result = "missing";
  else if (state.depleted.includes(node.id)) result = "depleted";
  else if (Math.hypot(node.x - position.x, node.y - position.y) > 1.5)
    result = "range";
  else if (!interactionClear(world, position, node)) result = "blocked";
  else if (
    definition.toolRequirement &&
    !p.inventory.some((s) => s?.item === definition.toolRequirement)
  )
    result = "tool";
  else if (tick < p.readyTick) result = "cooldown";
  else {
    const added = addItems(
      p.inventory,
      definition.yields.item,
      definition.yields.quantity,
    );
    if (!added) result = "full";
    else inventory = added;
  }
  return {
    players: {
      ...state.players,
      [player]: {
        inventory,
        receipt: { ...command, result, tick },
        readyTick:
          result === "gathered"
            ? tick + definition!.gatherDuration
            : p.readyTick,
      },
    },
    depleted:
      result === "gathered" ? [...state.depleted, node!.id] : state.depleted,
  };
}
