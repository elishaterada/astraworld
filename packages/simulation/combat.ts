import { COMBAT as C } from "../content/combat";
import type { CombatState, Slime } from "../protocol/combat";
import type { RealtimeActor } from "../protocol/realtime";
import { isSolid, type World } from "../world";
import { moveFor, type Position } from "./index";
export const direction = (facing: number) => ({
  x: Math.cos((facing * Math.PI) / 4),
  y: Math.sin((facing * Math.PI) / 4),
});
export const distance = (a: Position, b: Position) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export function freshCombat(spawn: Position): CombatState {
  return {
    health: C.playerHealth,
    spawn: { ...spawn },
    attack: null,
    attackReady: 0,
    dodgeUntil: 0,
    dodgeReady: 0,
    dodgeSteps: 0,
    dodgeFacing: 2,
    invulnerableUntil: 0,
    respawnAt: 0,
    damageTick: 0,
    deaths: 0,
  };
}
export function freshSlime(seed: string): Slime {
  const home = { x: 64.5, y: 48.5 };
  return {
    id: `hostile-slime:${seed}:north-trail`,
    kind: "hostile-slime",
    home,
    position: { ...home },
    health: C.slimeHealth,
    phase: "idle",
    phaseTick: 0,
    target: null,
    impact: { ...home },
    damageTick: 0,
    deathTick: null,
  };
}
export function clearAttackLine(world: World, a: Position, b: Position) {
  // Exact segment/tile intersection: even a very short corner crossing blocks a hit.
  for (
    let y = Math.floor(Math.min(a.y, b.y));
    y <= Math.floor(Math.max(a.y, b.y));
    y++
  )
    for (
      let x = Math.floor(Math.min(a.x, b.x));
      x <= Math.floor(Math.max(a.x, b.x));
      x++
    ) {
      if (!isSolid(world, x, y)) continue;
      let entry = 0,
        exit = 1;
      for (const axis of ["x", "y"] as const) {
        const lo = axis === "x" ? x : y,
          delta = b[axis] - a[axis];
        if (delta === 0) {
          if (a[axis] < lo || a[axis] > lo + 1) {
            entry = 2;
            break;
          }
        } else {
          const first = (lo - a[axis]) / delta,
            last = (lo + 1 - a[axis]) / delta;
          entry = Math.max(entry, Math.min(first, last));
          exit = Math.min(exit, Math.max(first, last));
        }
      }
      if (entry <= exit) return false;
    }
  return true;
}
export function combatBusy(c: CombatState | undefined, tick: number) {
  return !!c && (c.health === 0 || tick < c.attackReady || tick < c.dodgeUntil);
}
/** Pure authoritative outcomes. Player attacks resolve first, so a killing hit interrupts a slam. */
export function stepCombat(
  world: World,
  actors: RealtimeActor[],
  original: Slime,
  tick: number,
  present: ReadonlySet<string>,
) {
  let slime = { ...original };
  let players = actors.map((a) => {
    if (!a.combat) return a;
    let c = { ...a.combat };
    if (c.health === 0) {
      if (tick >= c.respawnAt)
        return {
          ...a,
          position: { ...c.spawn },
          moving: false,
          action: null,
          combat: {
            ...freshCombat(c.spawn),
            deaths: c.deaths,
            invulnerableUntil: tick + C.spawnProtection,
          },
        };
      return { ...a, moving: false, action: null };
    }
    const attack = c.attack;
    if (attack && present.has(a.id)) {
      const age = tick - attack.startedTick,
        dir = direction(attack.facing),
        dx = slime.position.x - a.position.x,
        dy = slime.position.y - a.position.y,
        d = Math.hypot(dx, dy);
      if (
        slime.health > 0 &&
        age >= C.windup &&
        age < C.windup + C.active &&
        !attack.hits.includes(slime.id) &&
        d <= C.bladeRange &&
        (d < 0.35 || (dx * dir.x + dy * dir.y) / d >= 0.25) &&
        clearAttackLine(world, a.position, slime.position)
      ) {
        slime = {
          ...slime,
          health: Math.max(0, slime.health - C.bladeDamage),
          damageTick: tick,
        };
        c.attack = { ...attack, hits: [...attack.hits, slime.id] };
        if (slime.health === 0)
          slime = {
            ...slime,
            phase: "dead",
            phaseTick: tick,
            deathTick: tick,
            target: null,
          };
      }
      if (age >= C.windup + C.active + C.recovery) c.attack = null;
    } else if (!present.has(a.id)) c.attack = null;
    return { ...a, combat: c };
  });
  if (slime.health === 0) return { actors: players, slime };
  const eligible = players.filter(
    (a) =>
      a.combat &&
      a.combat.health > 0 &&
      present.has(a.id) &&
      distance(a.position, slime.home) <= C.leash,
  );
  const target = eligible.toSorted(
    (a, b) =>
      distance(a.position, slime.position) -
        distance(b.position, slime.position) || a.id.localeCompare(b.id),
  )[0];
  if (slime.phase === "tell") {
    if (tick - slime.phaseTick >= C.tellTicks) {
      players = players.map((a) => {
        const c = a.combat;
        if (
          !c ||
          !present.has(a.id) ||
          c.health === 0 ||
          tick < c.invulnerableUntil ||
          distance(a.position, slime.impact) > C.slamRadius ||
          !clearAttackLine(world, slime.position, a.position)
        )
          return a;
        const health = Math.max(0, c.health - C.slimeDamage);
        return {
          ...a,
          ...(health === 0 ? { moving: false, action: null } : {}),
          combat: {
            ...c,
            health,
            damageTick: tick,
            ...(health === 0
              ? {
                  attack: null,
                  dodgeSteps: 0,
                  dodgeUntil: 0,
                  respawnAt: tick + C.respawnTicks,
                  deaths: c.deaths + 1,
                }
              : {}),
          },
        };
      });
      slime = { ...slime, phase: "recover", phaseTick: tick };
    }
  } else if (
    slime.phase === "recover" &&
    tick - slime.phaseTick < C.slimeRecovery
  ) {
    // Recovery is an opening for a counterattack.
  } else if (!target || distance(slime.position, slime.home) > C.leash) {
    const home = distance(slime.position, slime.home) < 0.05;
    slime = {
      ...slime,
      phase: home ? "idle" : "return",
      target: null,
      position: home
        ? slime.home
        : moveFor(
            world,
            slime.position,
            {
              x: slime.home.x - slime.position.x,
              y: slime.home.y - slime.position.y,
            },
            C.slimeSpeed / 4 / 60,
          ),
    };
  } else if (distance(target.position, slime.position) <= C.acquireRange) {
    if (
      distance(target.position, slime.position) <= 1.05 &&
      clearAttackLine(world, slime.position, target.position)
    )
      slime = {
        ...slime,
        phase: "tell",
        phaseTick: tick,
        target: target.id,
        impact: { ...slime.position },
      };
    else
      slime = {
        ...slime,
        phase: "chase",
        target: target.id,
        position: moveFor(
          world,
          slime.position,
          {
            x: target.position.x - slime.position.x,
            y: target.position.y - slime.position.y,
          },
          C.slimeSpeed / 4 / 60,
        ),
      };
  } else
    slime = {
      ...slime,
      phase: "return",
      target: null,
      position: moveFor(
        world,
        slime.position,
        {
          x: slime.home.x - slime.position.x,
          y: slime.home.y - slime.position.y,
        },
        C.slimeSpeed / 4 / 60,
      ),
    };
  return { actors: players, slime };
}
