import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DurableStore, type DurableState } from "../apps/game-server/durable";
import { hash } from "../apps/game-server/store";
import { CONTENT_VERSION, GENERATION_VERSION } from "../packages/world";
import { freshProgress } from "../packages/content";
import { parseRecovery } from "../app/recovery";
it("recovery files reject invalid credentials and extra fields", () => {
  expect(() => parseRecovery("{}")).toThrow();
  const s = {
    worldId: randomUUID(),
    playerId: randomUUID(),
    token: "a".repeat(43),
    invite: "b".repeat(43),
    seed: "meadow-001",
    name: "Rowan",
    character: "iris",
    durable: true,
  };
  expect(parseRecovery(JSON.stringify(s))).toEqual(s);
  expect(() => parseRecovery(JSON.stringify({ ...s, admin: true }))).toThrow();
  expect(() => parseRecovery("a".repeat(4097))).toThrow();
});
it.skipIf(!process.env.TEST_DATABASE_URL)(
  "Postgres fences old owners, atomically rejects conflicting replays and isolates worlds",
  async () => {
    const namespace = `test:${randomUUID()}`,
      db = new DurableStore(process.env.TEST_DATABASE_URL!, namespace),
      other = new DurableStore(
        process.env.TEST_DATABASE_URL!,
        `test:${randomUUID()}`,
      );
    const world = randomUUID(),
      actor = randomUUID();
    try {
      await db.ready();
      await db.create(
        world,
        {
          seed: "meadow-001",
          invite: hash(randomUUID()),
          contentVersion: CONTENT_VERSION,
          generationVersion: GENERATION_VERSION,
        },
        {
          id: actor,
          name: "Rowan",
          character: "iris",
          hash: hash(randomUUID()),
          spawnIndex: 0,
        },
      );
      const state: DurableState = {
        tick: 0,
        actors: [],
        gathering: { players: { [actor]: freshProgress() }, depleted: [] },
      };
      expect(await db.claim(world, "old")).toBe(1);
      expect(await db.commit(world, "old", 0, state)).toBe(1);
      expect(await db.claim(world, "new")).toBe(2);
      await expect(db.commit(world, "old", 1, state)).rejects.toThrow("fenced");
      const changed = structuredClone(state);
      changed.gathering.players[actor].receipt = {
        seq: 1,
        target: "missing",
        result: "missing",
        tick: 1,
      };
      expect(await db.commit(world, "new", 1, changed)).toBe(2);
      expect(await db.commit(world, "new", 2, changed)).toBe(3);
      const conflict = structuredClone(changed);
      conflict.gathering.players[actor].receipt!.target = "different";
      await expect(db.commit(world, "new", 3, conflict)).rejects.toThrow(
        "conflict",
      );
      expect((await db.load(world))!.revision).toBe(3);
      expect(await other.load(world)).toBeNull();
      expect(
        Number(
          (
            await db.pool.query(
              "SELECT count(*) FROM astraworld.commands WHERE namespace=$1",
              [namespace],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
      expect(
        Number(
          (
            await db.pool.query(
              "SELECT count(*) FROM astraworld.outbox WHERE namespace=$1",
              [namespace],
            )
          ).rows[0].count,
        ),
      ).toBe(3);
      await expect(db.commit(world, "new", 3, state)).rejects.toThrow(
        "regress",
      );
    } finally {
      await db.close();
      await other.close();
    }
  },
);
