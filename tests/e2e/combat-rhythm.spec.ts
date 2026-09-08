import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("held combo, remote finisher, recovery roll and release behave in two browsers", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext(),
    errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed verification"));
        localStorage.setItem("meadow-combat-controls-seen-v1", "1");
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q])
      page.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/?debug=1");
    await p.getByLabel("What should we call you?").fill("Blade");
    await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await q.getByLabel("What should we call you?").fill("Witness");
    await q.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await q.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await p.getByRole("application").focus();
    await p.keyboard.down("j");
    await q.waitForFunction(
      () =>
        window.__MEADOW__?.snapshot().network?.remotes[0]?.combat?.attack
          ?.combo === 2,
    );
    await p.waitForFunction(() => {
      const s = window.__MEADOW__!.snapshot();
      return s.visual.slash && s.combat?.attack?.combo === 2;
    });
    await p.screenshot({
      path: "docs/milestones/evidence/combat-rhythm-finisher.png",
    });
    await p.keyboard.up("j");
    await p.waitForTimeout(900);
    const stopped = await p.evaluate(
      () => window.__MEADOW__!.snapshot().network!.action!.startedTick,
    );
    await p.waitForTimeout(500);
    expect(
      await p.evaluate(
        () => window.__MEADOW__!.snapshot().network!.action!.startedTick,
      ),
    ).toBe(stopped);
    await p.keyboard.press("j");
    await p.waitForFunction(() => {
      const s = window.__MEADOW__!.snapshot();
      return (
        s.combat?.attack &&
        s.network!.tick - s.combat.attack.startedTick >= 16 &&
        s.network!.tick < s.combat.attackReady
      );
    });
    await p.keyboard.press("Shift");
    await expect
      .poll(() =>
        q.evaluate(
          () => window.__MEADOW__!.snapshot().network!.remotes[0].action?.kind,
        ),
      )
      .toBe("dodge");
    await p.waitForTimeout(1000);
    expect(errors).toEqual([]);
    const s = await p.evaluate(() => window.__MEADOW__!.snapshot());
    const frames = s.frames.slice(-300).sort((a, b) => a - b);
    writeFileSync(
      "docs/milestones/evidence/combat-rhythm-browser.json",
      JSON.stringify(
        {
          result: "pass",
          independentContexts: 2,
          remoteFinisher: true,
          recoveryRoll: true,
          releaseStopsAttacks: true,
          p95: frames[Math.floor(frames.length * 0.95)],
          renderer: s.renderer,
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

test("reduced motion keeps combos functional without slash effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Windowed verification"));
  });
  await page.goto("/?debug=1");
  await page.getByLabel("What should we call you?").fill("Calm");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(
    () => window.__MEADOW__?.snapshot().network?.status === "Connected",
  );
  await page.getByRole("application").focus();
  await page.keyboard.down("j");
  await page.waitForFunction(() => {
    const s = window.__MEADOW__!.snapshot();
    return (
      s.combat?.attack?.combo === 2 &&
      s.network!.tick - s.combat.attack.startedTick >= 12
    );
  });
  expect(
    await page.evaluate(() => window.__MEADOW__!.snapshot().visual.slash),
  ).toBe(false);
  await page.keyboard.up("j");
});
