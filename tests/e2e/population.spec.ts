import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { generateWorld } from "../../packages/world";
import { route } from "../../packages/simulation/taming";
const snap = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function walk(p: Page, destination: { x: number; y: number }) {
  const initial = await snap(p),
    path = route(
      generateWorld(initial.seed),
      initial.state,
      destination,
      16384,
    );
  expect(path).not.toBeNull();
  await p.getByRole("application").focus();
  for (const point of path!) {
    for (const axis of ["x", "y"] as const) {
      for (let retry = 0; retry < 3; retry++) {
        const delta = point[axis] - (await snap(p)).state[axis];
        if (Math.abs(delta) < 0.12) break;
        const key =
          axis === "x" ? (delta > 0 ? "d" : "a") : delta > 0 ? "s" : "w";
        await p.keyboard.down(key);
        await p.waitForTimeout(Math.min(350, Math.abs(delta) * 250));
        await p.keyboard.up(key);
        await p.waitForTimeout(50);
      }
    }
  }
  expect((await snap(p)).collision).toBe(false);
}
test("expanded creatures render, sync to a separate player, and survive reload", async ({
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
          Promise.reject(new DOMException("Windowed verification"));
        localStorage.setItem("meadow-controls-seen-v1", "1");
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q])
      page.on("pageerror", (e) => errors.push(e.message));
    const enter = async (page: Page, name: string) => {
      await page.getByLabel("What should we call you?").fill(name);
      await page
        .getByRole("button", { name: "Enter Meadow", exact: true })
        .click();
      await page.waitForFunction(
        () => window.__MEADOW__?.snapshot().network?.status === "Connected",
      );
    };
    await p.goto("/?debug=1");
    await enter(p, "Explorer");
    await expect.poll(async () => (await snap(p)).moss.length).toBe(8);
    await expect.poll(async () => (await snap(p)).monsters?.length).toBe(5);
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await enter(q, "Keeper");
    expect((await snap(q)).moss.map((m) => m.id)).toEqual(
      (await snap(p)).moss.map((m) => m.id),
    );
    const pet = (await snap(p)).moss[2];
    await walk(p, pet.home);
    await p.screenshot({ path: "docs/milestones/evidence/population-pet.png" });
    const monster = (await snap(p)).monsters![0];
    await walk(p, { x: monster.home.x + 2, y: monster.home.y });
    await expect
      .poll(async () => (await snap(q)).monsters![0].phase)
      .not.toBe("idle");
    await p.screenshot({
      path: "docs/milestones/evidence/population-encounter.png",
    });
    const before = await snap(p);
    await p.reload();
    await p.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await p.waitForFunction(
      () =>
        !!window.__MEADOW__?.snapshot().network?.status &&
        window.__MEADOW__.snapshot().network?.status === "Connected",
    );
    expect((await snap(p)).monsters!.map((m) => m.id)).toEqual(
      before.monsters!.map((m) => m.id),
    );
    expect((await snap(p)).moss).toHaveLength(8);
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/population-browser.json",
      JSON.stringify(
        {
          result: "pass",
          players: 2,
          monsters: 6,
          pets: 8,
          remoteEncounter: true,
          reload: true,
          errors,
          renderer: before.renderer,
        },
        null,
        2,
      ),
    );
  } finally {
    await a.close();
    await b.close();
  }
});
