import { weaponAttack, BLOCK } from "../content/weapons";
import { EXTRA_MONSTER_HOMES } from "../content/creatures";
import { creatureHomes } from "./population";
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
export function attackBusy(c: CombatState | undefined, tick: number) {
  return !!c && (c.health === 0 || tick < c.attackReady || tick < c.dodgeUntil);
}

export function combatBusy(c: CombatState | undefined, tick: number) {
  return (
    attackBusy(c, tick) ||
    (!!c && (c.charging !== undefined || c.blocking !== undefined))
  );
}
export function hurtActor(
  a: RealtimeActor,
  amount: number,
  tick: number,
): RealtimeActor {
  const c = a.combat;
  if (!c || !c.health || tick < c.invulnerableUntil || amount <= 0) return a;
  const health = Math.max(0, c.health - amount);
  return {
    ...a,
    ...(!health ? { moving: false, action: null } : {}),
    combat: {
      ...c,
      health,
      damageTick: tick,
      ...(!health
        ? {
            attack: null,
            charging: undefined,
            blocking: undefined,
            dodgeSteps: 0,
            dodgeUntil: 0,
            respawnAt: tick + C.respawnTicks,
            deaths: c.deaths + 1,
          }
        : {}),
    },
  };
}
export function defend(
  a: RealtimeActor,
  source: Position,
  damage: number,
  tick: number,
) {
  const c = a.combat,
    dir = direction(a.facing),
    dx = source.x - a.position.x,
    dy = source.y - a.position.y,
    d = Math.hypot(dx, dy);
  const guard =
    c?.blocking !== undefined &&
    tick >= c.blocking &&
    (d < 0.1 || (dx * dir.x + dy * dir.y) / d >= 0.25);
  const parry = !!guard && tick - c!.blocking! < BLOCK.parryTicks;
  return {
    actor: parry
      ? { ...a, combat: { ...c!, parryTick: tick } }
      : hurtActor(
          a,
          guard ? Math.max(1, Math.ceil(damage * BLOCK.chip)) : damage,
          tick,
        ),
    parry,
    blocked: !!guard,
  };
}
/** Swept projectile segments prevent tunneling; no client target or hit result is used. */
export function attackRay(
  world: World,
  a: RealtimeActor,
  target: Position,
  tick: number,
): number {
  const hit = a.combat?.attack;
  if (!hit) return -1;
  const p = weaponAttack(hit.weapon, hit.combo, hit.charge, hit.skill),
    age = tick - hit.startedTick;
  if (age < p.windup || age >= p.windup + p.active) return -1;
  const origin = p.projectile ? (hit.origin ?? a.position) : a.position,
    dx = target.x - origin.x,
    dy = target.y - origin.y,
    d = Math.hypot(dx, dy);
  if (!clearAttackLine(world, origin, target)) return -1;
  if (!p.projectile) {
    const dir = direction(hit.facing);
    return d <= p.range &&
      (p.radial || d < 0.35 || (dx * dir.x + dy * dir.y) / d >= 0.25)
      ? 0
      : -1;
  }
  const from = ((age - p.windup) / p.active) * p.range,
    to = ((age - p.windup + 1) / p.active) * p.range;
  return p.spread.findIndex((offset, i) => {
    if (hit.rays?.includes(i)) return false;
    const angle = (hit.facing * Math.PI) / 4 + offset,
      x = Math.cos(angle),
      y = Math.sin(angle),
      along = dx * x + dy * y;
    return (
      along >= from - 0.35 &&
      along <= to + 0.35 &&
      Math.abs(dx * y - dy * x) <= 0.35
    );
  });
}
function recordHit(c: CombatState, id: string, ray: number) {
  const attack = c.attack!;
  return {
    ...c,
    attack: {
      ...attack,
      hits: [...attack.hits, id],
      ...(weaponAttack(attack.weapon, attack.combo, attack.charge, attack.skill)
        .projectile
        ? { rays: [...(attack.rays ?? []), ray] }
        : {}),
    },
  };
}
export function stepFriendlyFire(
  world: World,
  actors: RealtimeActor[],
  tick: number,
  present: ReadonlySet<string>,
  enabled: boolean,
) {
  if (!enabled) return actors;
  const result = actors.slice();
  for (let i = 0; i < result.length; i++)
    for (let j = 0; j < result.length; j++) {
      if (i === j) continue;
      let a = result[i],
        b = result[j];
      const hit = a.combat?.attack;
      if (
        !hit ||
        !a.combat?.health ||
        !b.combat?.health ||
        !present.has(a.id) ||
        !present.has(b.id) ||
        tick < b.combat.invulnerableUntil ||
        hit.hits.includes(b.id)
      )
        continue;
      const ray = attackRay(world, a, b.position, tick);
      if (ray < 0) continue;
      const p = weaponAttack(hit.weapon, hit.combo, hit.charge, hit.skill),
        guard = defend(
          b,
          p.projectile ? (hit.origin ?? a.position) : a.position,
          p.damage,
          tick,
        );
      a = { ...a, combat: recordHit(a.combat, b.id, ray) };
      b = guard.actor;
      if (!guard.blocked && p.knockback > 0 && b.combat?.health) {
        const dx = b.position.x - a.position.x,
          dy = b.position.y - a.position.y,
          d = Math.hypot(dx, dy) || 1;
        b = {
          ...b,
          position: moveFor(
            world,
            b.position,
            { x: dx / d, y: dy / d },
            p.knockback / 4,
          ),
        };
      }
      if (guard.parry) {
        a = hurtActor(a, p.damage, tick);
        a = {
          ...a,
          combat: {
            ...a.combat!,
            attack: null,
            attackReady: Math.max(a.combat!.attackReady, tick + 24),
          },
        };
      }
      result[i] = a;
      result[j] = b;
    }
  return result;
}
/** Pure authoritative outcomes. Player attacks resolve first, so a killing hit interrupts a slam. */
function resolveCombat(
  world: World,
  actors: RealtimeActor[],
  original: Slime,
  tick: number,
  present: ReadonlySet<string>,
  stage: "all" | "attacks" | "enemy" = "all",
  lifecycle = true,
) {
  let slime = { ...original };
  let players =
    stage === "enemy"
      ? actors
      : actors.map((a) => {
          if (!a.combat) return a;
          let c = { ...a.combat };
          if (c.health === 0) {
            if (lifecycle && tick >= c.respawnAt)
              return {
                ...a,
                position: { ...c.spawn },
                moving: false,
                action: null,
                combat: {
                  ...freshCombat(c.spawn),
                  deaths: c.deaths,
                  weapon: c.weapon,
                  skillReady: c.skillReady,
                  invulnerableUntil: tick + C.spawnProtection,
                },
              };
            return { ...a, moving: false, action: null };
          }
          const attack = c.attack;
          if (attack && present.has(a.id)) {
            const profile = weaponAttack(
              attack.weapon,
              attack.combo,
              attack.charge,
              attack.skill,
            );
            const age = tick - attack.startedTick,
              dir = profile.radial
                ? (() => {
                    const dx = slime.position.x - a.position.x,
                      dy = slime.position.y - a.position.y,
                      d = Math.hypot(dx, dy) || 1;
                    return { x: dx / d, y: dy / d };
                  })()
                : direction(attack.facing),
              ray = attackRay(world, a, slime.position, tick);
            if (
              slime.health > 0 &&
              !attack.hits.includes(slime.id) &&
              ray >= 0
            ) {
              slime = {
                ...slime,
                health: Math.max(0, slime.health - profile.damage),
                damageTick: tick,
                lastDamage: Math.min(slime.health, profile.damage),
                ...(profile.knockback > 0
                  ? {
                      position: moveFor(
                        world,
                        slime.position,
                        dir,
                        profile.knockback / 4,
                      ),
                      phase: "recover" as const,
                      phaseTick: tick,
                      staggerUntil: tick + C.slimeRecovery,
                      target: null,
                    }
                  : {}),
              };
              c = recordHit(c, slime.id, ray);
              if (slime.health === 0)
                slime = {
                  ...slime,
                  phase: "dead",
                  phaseTick: tick,
                  deathTick: tick,
                  target: null,
                };
            }
            if (age >= profile.windup + profile.active + profile.recovery)
              c.attack = null;
          } else if (!present.has(a.id)) c.attack = null;
          return { ...a, combat: c };
        });
  if (stage === "attacks" || slime.health === 0)
    return { actors: players, slime };
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
          slime.health === 0 ||
          !present.has(a.id) ||
          c.health === 0 ||
          tick < c.invulnerableUntil ||
          distance(a.position, slime.impact) > C.slamRadius ||
          !clearAttackLine(world, slime.position, a.position)
        )
          return a;
        const defense = defend(a, slime.position, C.slimeDamage, tick);
        if (defense.parry) {
          const health = Math.max(0, slime.health - C.slimeDamage);
          slime = {
            ...slime,
            health,
            damageTick: tick,
            lastDamage: Math.min(slime.health, C.slimeDamage),
            staggerUntil: tick + C.slimeRecovery,
            ...(!health
              ? {
                  phase: "dead",
                  phaseTick: tick,
                  deathTick: tick,
                  target: null,
                }
              : {}),
          };
        }
        return defense.actor;
      });
      if (slime.health > 0)
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

export const stepCombat = resolveCombat;
/** All player strikes precede every enemy impact. Lifecycle runs only in the first pass. */
export function stepEncounters(
  world: World,
  actors: RealtimeActor[],
  monsters: Slime[],
  tick: number,
  present: ReadonlySet<string>,
  friendlyFire = false,
) {
  let players = actors;
  const struck = monsters.map((monster, index) => {
    const result = resolveCombat(
      world,
      players,
      monster,
      tick,
      present,
      "attacks",
      index === 0,
    );
    players = result.actors;
    return result.slime;
  });
  players = stepFriendlyFire(world, players, tick, present, friendlyFire);
  const resolved = struck.map((monster) => {
    const result = resolveCombat(
      world,
      players,
      monster,
      tick,
      present,
      "enemy",
    );
    players = result.actors;
    return result.slime;
  });
  return { actors: players, slime: resolved[0], monsters: resolved.slice(1) };
}
/** Legacy north-trail ID stays canonical. Extra encounters are additive save content. */
export function freshMonsters(seed: string): Slime[] {
  return creatureHomes(seed, EXTRA_MONSTER_HOMES).map((home, i) => ({
    ...freshSlime(seed),
    id: `hostile-slime:${seed}:meadow:${i}`,
    home,
    position: { ...home },
    impact: { ...home },
  }));
}
export function expandMonsters(seed: string, saved: Slime[] = []): Slime[] {
  const ids = new Set(saved.map((s) => s.id));
  return [...saved, ...freshMonsters(seed).filter((s) => !ids.has(s.id))];
}
