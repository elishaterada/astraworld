import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
const snap = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function enter(p: Page, name: string) {
  await p.getByLabel("What should we call you?").fill(name);
  await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await p.waitForFunction(
    () => window.__MEADOW__?.snapshot().network?.status === "Connected",
  );
}
async function ready(p: Page) {
  await p.waitForFunction(() => {
    const s = window.__MEADOW__!.snapshot();
    return s.network!.tick >= (s.combat?.attackReady ?? 0);
  });
}
async function strike(p: Page, observer: Page) {
  const previous =
    (await snap(observer)).network!.remotes[0]?.combat?.attack?.startedTick ??
    -1;
  await p.keyboard.press("j");
  await observer.waitForFunction((previous) => {
    const attack =
      window.__MEADOW__!.snapshot().network!.remotes[0]?.combat?.attack;
    return !!attack && attack.startedTick > previous;
  }, previous);
}
async function equip(p: Page, key: string, weapon: string) {
  await ready(p);
  await p.getByRole("application").focus();
  await p.keyboard.press(key);
  await expect.poll(async () => (await snap(p)).combat?.weapon).toBe(weapon);
}
test("five weapons, charged ranged skill, host settings, chip block and reflected parry work for two players", async ({
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
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q])
      page.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/?debug=1");
    await enter(p, "Fighter");
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await enter(q, "Defender");
    await q
      .getByRole("application")
      .evaluate((el) =>
        el.dispatchEvent(new CustomEvent("friendly-fire", { detail: true })),
      );
    await expect
      .poll(async () => (await snap(q)).companionReceipt?.result)
      .toBe("forbidden");
    expect((await snap(p)).friendlyFire).toBe(false);
    for (const [key, weapon] of [
      ["2", "fists"],
      ["4", "bow"],
      ["5", "magic"],
    ]) {
      await equip(p, key, weapon);
      await p.keyboard.down("k");
      await p.waitForTimeout(650);
      expect((await snap(p)).combat?.charging).toBeDefined();
      await p.keyboard.up("k");
      await p.waitForFunction(
        () => !!window.__MEADOW__!.snapshot().combat?.attack?.charge,
      );
      if (weapon !== "fists") {
        await p.waitForFunction(
          () => window.__MEADOW__!.snapshot().visual.projectiles > 0,
        );
        await p.screenshot({
          path: `docs/milestones/evidence/arsenal-${weapon}.png`,
        });
      }
      await ready(p);
      await p.waitForFunction(() => {
        const s = window.__MEADOW__!.snapshot();
        return s.network!.tick >= (s.combat?.skillReady ?? 0);
      });
      await p.keyboard.press("h");
      await expect
        .poll(async () => (await snap(p)).combat?.attack?.skill)
        .toBe(true);
      await ready(p);
    }
    await equip(p, "3", "greatsword");
    const ps = (await snap(p)).actorScreen,
      qs = (await snap(q)).actorScreen;
    await p.mouse.move(ps.x + 140, ps.y);
    await q.mouse.move(qs.x - 140, qs.y);
    await strike(p, q);
    await ready(p);
    expect((await snap(q)).combat!.health).toBe(100);
    expect((await snap(p)).combat!.health).toBe(100);
    await p.getByRole("button", { name: "Open menu" }).click();
    await p.getByText("Weapons and world rules", { exact: true }).click();
    await p.getByRole("checkbox", { name: /Friendly fire/ }).click();
    await expect.poll(async () => (await snap(q)).friendlyFire).toBe(true);
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await p.getByRole("application").focus();
    await p.mouse.move(ps.x + 140, ps.y);
    await q.getByRole("application").focus();
    await q.mouse.move(qs.x - 140, qs.y);
    await q.keyboard.down("f");
    await q.waitForTimeout(600);
    await strike(p, q);
    await expect.poll(async () => (await snap(q)).combat!.health).toBe(95);
    await expect(q.locator(".combat-hud")).toContainText("95 / 100");
    await q.screenshot({ path: "docs/milestones/evidence/arsenal-block.png" });
    await q.keyboard.up("f");
    await ready(p);
    await q.waitForTimeout(600);
    await strike(p, q);
    await q.waitForFunction(() => {
      const s = window.__MEADOW__!.snapshot(),
        attack = s.network!.remotes[0]?.combat?.attack;
      return (
        !!attack &&
        s.network!.tick - attack.startedTick >= 12 &&
        s.network!.tick - attack.startedTick < 18
      );
    });
    const priorParry = (await snap(q)).combat?.parryTick ?? 0;
    await q.keyboard.down("f");
    await expect
      .poll(async () => (await snap(q)).combat?.parryTick, { intervals: [20] })
      .toBeGreaterThan(priorParry);
    await q.keyboard.up("f");
    await expect.poll(async () => (await snap(p)).combat!.health).toBe(82);
    expect((await snap(q)).combat!.health).toBe(95);
    await p.screenshot({ path: "docs/milestones/evidence/arsenal-parry.png" });
    await p.reload();
    await p.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect((await snap(p)).friendlyFire).toBe(true);
    expect((await snap(p)).combat!.weapon).toBe("greatsword");
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/arsenal-browser.json",
      JSON.stringify(
        {
          result: "pass",
          independentContexts: 2,
          unauthorizedSettingRejected: true,
          friendlyFireDefaultOff: true,
          charge: true,
          rangedModels: true,
          skills: true,
          chipDamage: 5,
          parryReflection: 18,
          reloadRulesAndClass: true,
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
