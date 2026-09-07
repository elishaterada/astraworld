import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
const snap = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function hold(p: Page, key: string, ms: number) {
  await p.getByRole("application").focus();
  await p.keyboard.down(key);
  await p.waitForTimeout(ms);
  await p.keyboard.up(key);
  await p.waitForTimeout(200);
}
test("two independent players agree on pond collision, camp collision and environment", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed environment review"));
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q]) {
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (e) => {
        if (e.type() === "error") errors.push(e.text());
      });
    }
    await p.goto("/?debug=1");
    await p.getByLabel("What should we call you?").fill("Rowan");
    await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await q.getByLabel("What should we call you?").fill("Iris");
    await q.getByRole("radio", { name: "Iris" }).check();
    await q.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await q.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await expect
      .poll(async () => (await snap(p)).network!.remotes.length)
      .toBe(1);
    // The central north path is guaranteed clear. Approach the pond from the east.
    await hold(p, "w", 1750);
    await hold(p, "a", 2500);
    const pond = await snap(p);
    expect(pond.collision).toBe(false);
    expect(pond.state.x).toBeGreaterThanOrEqual(60.24 - 1e-5);
    expect(pond.state.x).toBeLessThan(61);
    expect(pond.environment.ponds).toBe(6);
    expect(pond.environment.bonfires).toBe(4);
    await expect
      .poll(async () =>
        Math.abs((await snap(q)).network!.remotes[0].position.x - pond.state.x),
      )
      .toBeLessThan(0.2);
    await p.screenshot({
      path: "docs/milestones/evidence/living-meadow-pond.png",
    });
    // Return along the bank to the central trail, then approach the solid fire pit from north.
    await hold(p, "d", 1060);
    await hold(p, "s", 1750);
    await hold(p, "d", 1250);
    await hold(p, "s", 2300);
    const fire = await snap(p);
    expect(fire.collision).toBe(false);
    expect(fire.state.y).toBeLessThan(70);
    expect(fire.state.y).toBeGreaterThan(69);
    expect(fire.environment.activeLights).toBeGreaterThan(0);
    await expect
      .poll(async () =>
        Math.hypot(
          (await snap(q)).network!.remotes[0].position.x - fire.state.x,
          (await snap(q)).network!.remotes[0].position.y - fire.state.y,
        ),
      )
      .toBeLessThan(0.2);
    await p.screenshot({
      path: "docs/milestones/evidence/living-meadow-camp.png",
    });
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/living-meadow-browser.json",
      JSON.stringify(
        {
          browser: browser.version(),
          pond: {
            position: pond.state,
            authoritative: pond.network!.authoritative,
          },
          fire: {
            position: fire.state,
            authoritative: fire.network!.authoritative,
          },
          environment: fire.environment,
          renderer: fire.renderer,
          errors,
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
test("reduced motion freezes atmosphere and waves remain readable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?solo=1&debug=1");
  await page.getByLabel("What should we call you?").fill("Hazel");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(() => !!window.__MEADOW__);
  await page.getByRole("application").focus();
  await hold(page, "d", 300);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await snap(page)).visual.waving).toBe(true);
  expect((await snap(page)).environment.phase).toBe(0);
  const first = await snap(page);
  await page.waitForTimeout(300);
  expect((await snap(page)).environment).toEqual(first.environment);
  expect((await snap(page)).visual.gait).toBe(0);
});
