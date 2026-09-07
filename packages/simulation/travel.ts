import { collides } from "./index";
import { combatBusy } from "./combat";
import { SIZE, type World } from "../world";
import type { RealtimeActor } from "../protocol/realtime";
import type { CompanionCommand, CompanionReceipt } from "../protocol/taming";
import type { TamingState } from "./taming";
/** Only server-owned actor identities/positions enter this transition. */
export function teleportTo(
  world: World,
  taming: TamingState,
  actors: RealtimeActor[],
  player: string,
  command: CompanionCommand,
  online: Set<string>,
  tick: number,
) {
  const prior = taming.receipts[player];
  if (command.seq !== (prior?.seq ?? 0) + 1) return { actors, taming };
  const self = actors.find((a) => a.id === player),
    target = actors.find((a) => a.id === command.target);
  let result: CompanionReceipt["result"] = "teleported";
  let destination: Readonly<{ x: number; y: number }> | undefined;
  if (!self || !target || self.id === target.id || !online.has(target.id))
    result = "missing";
  else if (self.combat?.health === 0 || target.combat?.health === 0)
    result = "dead";
  else if (combatBusy(self.combat, tick) || combatBusy(target.combat, tick))
    result = "busy";
  else if (tick < (taming.travelReady?.[player] ?? 0)) result = "cooldown";
  else {
    const visited = new Uint8Array(SIZE * SIZE),
      queue = [
        Math.floor(self.position.y) * SIZE + Math.floor(self.position.x),
      ];
    visited[queue[0]] = 1;
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i],
        x = cell % SIZE,
        y = Math.floor(cell / SIZE),
        p = { x: x + 0.5, y: y + 0.5 };
      const distance = Math.hypot(
        p.x - target.position.x,
        p.y - target.position.y,
      );
      if (
        distance >= 0.7 &&
        distance <= 1.6 &&
        !collides(world, p) &&
        actors.every(
          (a) =>
            a.id === player ||
            Math.hypot(a.position.x - p.x, a.position.y - p.y) >= 0.7,
        )
      ) {
        destination = p;
        break;
      }
      for (const [dx, dy] of [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          n = ny * SIZE + nx;
        if (
          nx < 0 ||
          ny < 0 ||
          nx >= SIZE ||
          ny >= SIZE ||
          visited[n] ||
          collides(world, { x: nx + 0.5, y: ny + 0.5 })
        )
          continue;
        visited[n] = 1;
        queue.push(n);
      }
    }
    if (!destination) result = "blocked";
  }
  const next = {
    ...taming,
    receipts: { ...taming.receipts, [player]: { ...command, tick, result } },
  };
  if (destination) {
    next.travelReady = { ...taming.travelReady, [player]: tick + 180 };
    actors = actors.map((a) =>
      a.id === player
        ? { ...a, position: destination!, moving: false, action: null }
        : a,
    );
  }
  return { actors, taming: next };
}
