import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DurableStore, type DurableState } from "../apps/game-server/durable";
import { hash } from "../apps/game-server/store";
import { CONTENT_VERSION, GENERATION_VERSION } from "../packages/world";
import { freshTaming } from "../packages/simulation/taming";
import { freshCombat } from "../packages/simulation/combat";
import { setWorldRule } from "../packages/simulation/world-rules";
it.skipIf(!process.env.TEST_DATABASE_URL)(
  "friendly-fire rules and weapon cooldowns recover from old-style Postgres worlds",
  async () => {
    const db = new DurableStore(
        process.env.TEST_DATABASE_URL!,
        `test:${randomUUID()}`,
      ),
      id = randomUUID(),
      world = randomUUID(),
      seed = "meadow-001";
    try {
      await db.ready();
      await db.create(
        world,
        {
          seed,
          invite: hash(randomUUID()),
          generationVersion: GENERATION_VERSION,
          contentVersion: CONTENT_VERSION,
        },
        {
          id,
          name: "Owner",
          character: "fern",
          hash: hash(randomUUID()),
          spawnIndex: 0,
        },
      );
      await db.claim(world, "owner");
      const state: DurableState = {
        tick: 1,
        actors: [
          {
            id,
            name: "Owner",
            character: "fern",
            position: { x: 64.5, y: 64.5 },
            facing: 0,
            moving: false,
            ack: 0,
            generation: 1,
            action: null,
            combat: freshCombat({ x: 64.5, y: 64.5 }),
          },
        ],
        gathering: { players: {}, depleted: [] },
        taming: freshTaming(seed),
      };
      await db.commit(world, "owner", 0, state);
      const changed = {
        ...state,
        ...setWorldRule(
          undefined,
          freshTaming(seed),
          id,
          id,
          { seq: 1, action: "friendly-fire", target: "on" },
          1,
        ),
      };
      changed.actors = changed.actors.map((a) => ({
        ...a,
        combat: { ...a.combat!, weapon: "magic", skillReady: 400 },
      }));
      await db.commit(world, "owner", 1, changed);
      const recovered = (await db.load(world))!.state!;
      expect(recovered.rules?.friendlyFire).toBe(true);
      expect(recovered.actors[0].combat!.weapon).toBe("magic");
      expect(recovered.actors[0].combat!.skillReady).toBe(400);
      expect(recovered.taming!.receipts[id].result).toBe("settings-updated");
    } finally {
      await db.close();
    }
  },
);
