import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
const snapshot = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
test("world-wide player map, running, safe teleport and campfire shadows", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext(),
    errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed check"));
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q]) {
      page.setDefaultTimeout(12000);
      page.on("pageerror", (e) => errors.push(e.message));
    }
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
    await enter(p, "Rowan");
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await enter(q, "Iris");
    await q.getByRole("application").focus();
    const start = (await snapshot(q)).state;
    await q.keyboard.down("v");
    await q.keyboard.down("d");
    await q.waitForTimeout(8000);
    await q.keyboard.up("d");
    await q.keyboard.up("v");
    await q.waitForTimeout(300);
    const far = (await snapshot(q)).state;
    expect(far.x - start.x).toBeGreaterThan(50);
    expect((await snapshot(q)).collision).toBe(false);
    await expect
      .poll(async () => (await snapshot(p)).network!.remotes.length)
      .toBe(0);
    await p.getByRole("button", { name: "Map and player list" }).click();
    await expect(p.getByRole("button", { name: /Return to the Meadow/ })).toBeHidden();
    await expect(
      p.getByRole("button", { name: "Teleport to Iris" }),
    ).toBeVisible();
    expect(
      await p.locator('svg[aria-label="Player locations"] circle').count(),
    ).toBe(2);
    const started = Date.now();
    await p.getByRole("button", { name: "Teleport to Iris" }).click();
    await p.waitForFunction(
      () =>
        window.__MEADOW__?.snapshot().companionReceipt?.result === "teleported",
    );
    const teleportMs = Date.now() - started;
    const landed = await snapshot(p);
    expect(
      Math.hypot(landed.state.x - far.x, landed.state.y - far.y),
    ).toBeLessThan(1.7);
    expect(landed.collision).toBe(false);
    await expect
      .poll(async () => (await snapshot(q)).network!.remotes.length)
      .toBe(1);
    await p.getByRole("button", { name: "Teleport to Iris" }).click();
    await expect(
      p.getByText("Teleport is cooling down — wait 3 seconds."),
    ).toBeVisible();
    await p.reload();
    await p.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect(
      Math.hypot(
        (await snapshot(p)).state.x - far.x,
        (await snapshot(p)).state.y - far.y,
      ),
    ).toBeLessThan(1.7);
    // Return one player to camp via real movement to exercise the additional shadow light.
    await q.getByRole("application").focus();
    await q.keyboard.down("v");
    await q.keyboard.down("a");
    await q.waitForTimeout(8000);
    await q.keyboard.up("a");
    await q.keyboard.up("v");
    await q.waitForTimeout(300);
    expect((await snapshot(q)).environment.fireShadowLights).toBe(1);
    await q.screenshot({ path: "docs/milestones/evidence/qol-camp.png" });
    await p.getByRole("button", { name: "Map and player list" }).click();
    await p.screenshot({ path: "docs/milestones/evidence/qol-map.png" });
    const frames = (await snapshot(q)).frames.slice(-600).sort((a, b) => a - b);
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/qol-browser.json",
      JSON.stringify(
        {
          result: "pass",
          runningTiles: far.x - start.x,
          worldWideRoster: true,
          teleportMs,
          teleportSurvivesReload: true,
          fireShadowLights: 1,
          frameP95Ms: frames[Math.floor(frames.length * 0.95)],
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await Promise.allSettled([a.close(), b.close()]);
  }
});
