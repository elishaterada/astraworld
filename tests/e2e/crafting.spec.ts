import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { generateWorld } from "../../packages/world";
import { resourceNodes } from "../../packages/world/resources";
const snap = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function walk(p: Page, x: number, y: number) {
  await p.getByRole("application").focus();
  for (const axis of ["x", "y"] as const)
    for (let attempt = 0; attempt < 12; attempt++) {
      const s = await snap(p),
        delta = (axis === "x" ? x : y) - s.state[axis];
      if (Math.abs(delta) < 0.12) break;
      const key =
        axis === "x" ? (delta > 0 ? "d" : "a") : delta > 0 ? "s" : "w";
      await p.keyboard.down(key);
      await p.waitForTimeout(Math.min(1000, (Math.abs(delta) / 4) * 1000));
      await p.keyboard.up(key);
      await p.waitForTimeout(130);
    }
  const s = await snap(p);
  expect(Math.hypot(s.state.x - x, s.state.y - y)).toBeLessThan(0.3);
}
test("two players gather, craft, place and resume a shared workbench", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const a = await browser.newContext(),
    b = await browser.newContext(),
    errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed check"));
        localStorage.setItem("meadow-combat-controls-seen-v1", "1");
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q])
      page.on("pageerror", (e) => errors.push(e.message));
    async function enter(page: Page, name: string) {
      await page.getByLabel("What should we call you?").fill(name);
      await page
        .getByRole("button", { name: "Enter Meadow", exact: true })
        .click();
      await page.waitForFunction(
        () => window.__MEADOW__?.snapshot().network?.status === "Connected",
      );
    }
    await p.goto("/?debug=1");
    await enter(p, "Maker");
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await enter(q, "Friend");
    await p.getByRole("button", { name: "Open inventory" }).click();
    await expect(p.getByRole("button", { name: "Craft axe" })).toBeDisabled();
    await p.keyboard.press("Escape");
    await walk(p, 68.5, 64.5);
    await expect
      .poll(async () => (await snap(p)).target?.kind)
      .toBe("loose-stone");
    await p.keyboard.press("e");
    await expect
      .poll(
        async () =>
          (await snap(p)).progress?.inventory.find((s) => s?.item === "stone")
            ?.quantity,
      )
      .toBe(2);
    const world = generateWorld("meadow-001"),
      trees = resourceNodes(world)
        .filter(
          (n) =>
            n.kind === "tree" &&
            n.x > 68 &&
            n.x < 90 &&
            (n.y === 62.5 || n.y === 66.5),
        )
        .slice(0, 3);
    expect(trees).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const t = trees[i];
      await walk(p, (await snap(p)).state.x, 64.5);
      await walk(p, t.x, t.y === 62.5 ? 63.3 : 65.7);
      await expect.poll(async () => (await snap(p)).target?.id).toBe(t.id);
      await p.keyboard.press("e");
      await expect
        .poll(async () => (await snap(p)).depleted.includes(t.id))
        .toBe(true);
      if (i === 0) {
        await p.getByRole("button", { name: "Open inventory" }).click();
        await p.getByRole("button", { name: "Craft axe" }).click();
        await expect(
          p.getByLabel("Stone Axe: 1", { exact: true }),
        ).toBeVisible();
        await p.screenshot({
          path: "docs/milestones/evidence/m7-crafting.png",
        });
        await p.keyboard.press("Escape");
      }
    }
    expect(
      (await snap(p)).progress!.inventory.find((s) => s?.item === "wood")
        ?.quantity,
    ).toBe(10);
    await walk(p, (await snap(p)).state.x, 64.5);
    await walk(p, 69.5, 67.5);
    await p.getByRole("button", { name: "Open inventory" }).click();
    await p.getByRole("button", { name: "Place workbench" }).click();
    await expect.poll(async () => (await snap(p)).benches?.length).toBe(1);
    await expect.poll(async () => (await snap(q)).benches?.length).toBe(1);
    expect(
      (await snap(p)).progress!.inventory.find((s) => s?.item === "wood")
        ?.quantity,
    ).toBe(4);
    await p.keyboard.press("Escape");
    await p.getByRole("application").focus();
    await p.keyboard.down("s");
    await p.waitForTimeout(500);
    await p.keyboard.up("s");
    expect((await snap(p)).collision).toBe(false);
    expect((await snap(p)).state.y).toBeLessThan(68);
    await p.screenshot({ path: "docs/milestones/evidence/m7-workbench.png" });
    await p.reload();
    await p.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect((await snap(p)).benches).toHaveLength(1);
    expect(
      (await snap(p)).progress!.inventory.some((s) => s?.item === "stone-axe"),
    ).toBe(true);
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/m7-browser.json",
      JSON.stringify(
        {
          result: "pass",
          independentContexts: 2,
          stoneGathered: true,
          axeCrafted: true,
          improvedYield: 5,
          sharedWorkbench: true,
          collision: true,
          resumed: true,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});
