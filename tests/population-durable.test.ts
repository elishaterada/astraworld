import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DurableStore, type DurableState } from "../apps/game-server/durable";
import { hash } from "../apps/game-server/store";
import { CONTENT_VERSION, GENERATION_VERSION } from "../packages/world";
import {
  freshTaming,
  expandTaming,
  type TamingState,
} from "../packages/simulation/taming";
import { freshSlime, expandMonsters } from "../packages/simulation/combat";
it.skipIf(!process.env.TEST_DATABASE_URL)(
  "old Postgres world expands without losing pets or resurrecting any defeated encounter",
  async () => {
    const db = new DurableStore(
        process.env.TEST_DATABASE_URL!,
        `test:${randomUUID()}`,
      ),
      worldId = randomUUID(),
      id = randomUUID(),
      seed = "meadow-001";
    try {
      await db.ready();
      await db.create(
        worldId,
        {
          seed,
          invite: hash(randomUUID()),
          contentVersion: CONTENT_VERSION,
          generationVersion: GENERATION_VERSION,
        },
        {
          id,
          name: "Keeper",
          character: "fern",
          hash: hash(randomUUID()),
          spawnIndex: 0,
        },
      );
      await db.claim(worldId, "owner");
      const taming = freshTaming(seed);
      taming.creatures = taming.creatures.slice(0, 2);
      taming.creatures[0].owner = id;
      taming.creatures[0].mode = "stay";
      const state: DurableState = {
        tick: 1,
        actors: [],
        gathering: { players: {}, depleted: [] },
        taming,
        slime: { ...freshSlime(seed), health: 0, phase: "dead", deathTick: 1 },
      };
      await db.commit(worldId, "owner", 0, state);
      const loaded = (await db.load(worldId))!.state!;
      const expanded = {
        ...loaded,
        taming: expandTaming(seed, loaded.taming as TamingState),
        monsters: expandMonsters(seed, loaded.monsters),
      };
      expanded.monsters[3] = {
        ...expanded.monsters[3],
        health: 0,
        phase: "dead",
        deathTick: 1,
      };
      await db.commit(worldId, "owner", 1, expanded);
      const recovered = (await db.load(worldId))!.state!;
      expect(recovered.taming!.creatures).toHaveLength(8);
      expect(recovered.taming!.creatures[0].owner).toBe(id);
      expect(recovered.taming!.creatures[0].mode).toBe("stay");
      expect(recovered.monsters![3].health).toBe(0);
      expect(expandMonsters(seed, recovered.monsters)).toEqual(
        recovered.monsters,
      );
      await expect(
        db.commit(worldId, "owner", 2, { ...recovered, monsters: [] }),
      ).rejects.toThrow("Monster defeat cannot regress");
    } finally {
      await db.close();
    }
  },
);
