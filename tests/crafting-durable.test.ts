import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DurableStore, type DurableState } from "../apps/game-server/durable";
import { hash } from "../apps/game-server/store";
import {
  CONTENT_VERSION,
  GENERATION_VERSION,
  generateWorld,
} from "../packages/world";
import { freshProgress } from "../packages/content";
import { craft } from "../packages/simulation/crafting";
import type { RealtimeActor } from "../packages/protocol/realtime";
it.skipIf(!process.env.TEST_DATABASE_URL)(
  "crafted tools and placed station recover from Postgres with exactly-once receipts",
  async () => {
    const namespace = `test:${randomUUID()}`,
      worldId = randomUUID(),
      id = randomUUID();
    const db = new DurableStore(process.env.TEST_DATABASE_URL!, namespace);
    try {
      await db.ready();
      await db.create(
        worldId,
        {
          seed: "meadow-001",
          invite: hash(randomUUID()),
          contentVersion: CONTENT_VERSION,
          generationVersion: GENERATION_VERSION,
        },
        {
          id,
          name: "Maker",
          character: "fern",
          hash: hash(randomUUID()),
          spawnIndex: 0,
        },
      );
      await db.claim(worldId, "first");
      const a: RealtimeActor = {
        id,
        name: "Maker",
        character: "fern",
        position: { x: 68.5, y: 68.5 },
        facing: 0,
        moving: false,
        action: null,
        ack: 0,
        generation: 1,
      };
      const p = freshProgress();
      p.inventory[2] = { item: "wood", quantity: 9 };
      p.inventory[3] = { item: "stone", quantity: 2 };
      let state: DurableState = {
        tick: 1,
        actors: [a],
        gathering: { players: { [id]: p }, depleted: [] },
      };
      await db.commit(worldId, "first", 0, state);
      const world = generateWorld("meadow-001"),
        cmd = { seq: 1, action: "craft" as const, target: "stone-axe" };
      state = {
        ...state,
        gathering: craft(world, state.gathering, a, [a], cmd, 1),
      };
      await db.commit(worldId, "first", 1, state);
      state = {
        ...state,
        tick: 40,
        gathering: craft(
          world,
          state.gathering,
          a,
          [a],
          { seq: 2, action: "place", target: "camp-north" },
          40,
        ),
      };
      await db.commit(worldId, "first", 2, state);
      await db.claim(worldId, "restarted");
      const cold = new DurableStore(process.env.TEST_DATABASE_URL!, namespace);
      const restored = (await cold.load(worldId))!;
      await cold.close();
      expect(restored.state!.gathering.benches).toHaveLength(1);
      expect(
        restored.state!.gathering.players[id].inventory.filter(
          (s) => s?.item === "stone-axe",
        ),
      ).toHaveLength(1);
      expect(
        restored.state!.gathering.players[id].inventory.some(
          (s) => s?.item === "wood" || s?.item === "stone",
        ),
      ).toBe(false);
      expect(
        craft(
          world,
          restored.state!.gathering,
          a,
          [a],
          { seq: 2, action: "place", target: "camp-north" },
          50,
        ),
      ).toBe(restored.state!.gathering);
      await db.commit(worldId, "restarted", 3, restored.state!);
      const count = await db.pool.query(
        "SELECT count(*) FROM astraworld.commands WHERE namespace=$1",
        [namespace],
      );
      expect(Number(count.rows[0].count)).toBe(2);
      const removed = structuredClone(restored.state!);
      removed.gathering.benches = [];
      await expect(db.commit(worldId, "restarted", 4, removed)).rejects.toThrow(
        "regress",
      );
    } finally {
      await db.close();
    }
  },
);
