import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps preview from inheriting production domains or durable worlds", () => {
  const config = JSON.parse(
    readFileSync("wrangler.jsonc", "utf8").replace(/,\s*([}\]])/g, "$1"),
  );
  const preview = config.env.preview;
  // Wrangler inherits top-level routes when an environment omits this field.
  expect(preview.routes).toEqual([]);
  expect(preview.vars.CANONICAL_HOST).toBe("");
  expect(preview.vars.GAME_NAMESPACE).not.toBe(config.vars.GAME_NAMESPACE);
  expect(preview.vars.LEGACY_NAMESPACE).not.toBe(config.vars.LEGACY_NAMESPACE);
});
