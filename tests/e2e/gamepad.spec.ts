import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("Xbox API input moves, aims, fights, opens menus and stops on disconnect", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Windowed verification"));
    localStorage.setItem("meadow-combat-controls-seen-v1", "1");
    const sample = {
      id: "Xbox simulated standard",
      index: 0,
      mapping: "standard",
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
    };
    Object.assign(window, { __testPad: sample });
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [sample.connected ? sample : null],
    });
  });
  await page.goto("/?debug=1");
  await page.getByLabel("What should we call you?").fill("Controller");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(
    () => window.__MEADOW__?.snapshot().network?.status === "Connected",
  );
  await page.bringToFront();
  await page.getByRole("application").focus();
  await page.waitForTimeout(150);
  await expect(page.locator(".first-play-hint")).toContainText("Charge");
  await expect(page.locator(".satchel-toggle kbd")).toHaveText("Y");
  await expect(page.locator(".interaction-hint kbd")).toHaveText("A");
  await page.screenshot({
    path: "docs/milestones/evidence/controller-hints.png",
  });
  const input = async (axes = [0, 0, 0, 0], buttons: number[] = []) =>
    page.evaluate(
      ({ axes, buttons }) => {
        const pad = (
          window as unknown as {
            __testPad: {
              axes: number[];
              buttons: { pressed: boolean; value: number }[];
            };
          }
        ).__testPad;
        pad.axes = axes;
        pad.buttons.forEach((b, i) => {
          b.pressed = buttons.includes(i);
          b.value = b.pressed ? 1 : 0;
        });
      },
      { axes, buttons },
    );
  const tap = async (button: number) => {
    await input(undefined, [button]);
    await page.waitForTimeout(100);
    await input();
    await page.waitForTimeout(150);
  };
  const snap = () => page.evaluate(() => window.__MEADOW__!.snapshot());
  await tap(0);
  await expect
    .poll(async () => (await snap()).progress?.receipt?.result)
    .toBe("gathered");
  const start = (await snap()).state;
  await input([1, 0, 0, -1]);
  await page.waitForTimeout(650);
  await input();
  await page.waitForTimeout(120);
  expect((await snap()).state.x - start.x).toBeGreaterThan(1.5);
  expect((await snap()).network!.facing).toBe(6);
  await input(undefined, [2]);
  await page.waitForFunction(
    () => window.__MEADOW__!.snapshot().combat?.attack?.combo === 2,
  );
  await input();
  await page.waitForTimeout(850);
  await tap(1);
  expect((await snap()).network!.action?.kind).toBe("dodge");
  await page.waitForTimeout(700);
  await input(undefined, [7]);
  await page.waitForFunction(
    () => window.__MEADOW__!.snapshot().combat?.charging !== undefined,
  );
  await page.waitForTimeout(500);
  await input();
  await page.waitForFunction(
    () => (window.__MEADOW__!.snapshot().combat?.attack?.charge ?? 0) > 0.4,
  );
  await page.waitForTimeout(800);
  await input(undefined, [6]);
  await page.waitForFunction(
    () => window.__MEADOW__!.snapshot().combat?.blocking !== undefined,
  );
  await input();
  await page.waitForFunction(
    () => window.__MEADOW__!.snapshot().combat?.blocking === undefined,
  );
  await tap(5);
  await expect
    .poll(async () => (await snap()).combat?.attack?.skill)
    .toBe(true);
  await page.waitForTimeout(1000);
  await tap(13);
  await expect.poll(async () => (await snap()).combat?.weapon).toBe("fists");
  await tap(3);
  await expect(
    page
      .getByRole("dialog")
      .filter({ has: page.getByText("Satchel", { exact: true }) }),
  ).toBeVisible();
  await tap(1);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await tap(9);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await tap(13);
  await tap(0);
  await expect(
    page
      .locator("details[open]")
      .filter({
        has: page.getByText("Weapons and world rules", { exact: true }),
      }),
  ).toHaveCount(1);
  const at = (await snap()).state;
  await input([1, 0, 0, 0], [2]);
  await page.waitForTimeout(500);
  expect((await snap()).state).toEqual(at);
  await input();
  await page.waitForTimeout(100);
  await tap(1);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await tap(8);
  await expect(page.locator(".travel-list")).toBeVisible();
  await tap(8);
  await expect(page.locator(".travel-list")).toHaveCount(0);
  await input([1, 0, 0, 0]);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    (
      window as unknown as { __testPad: { connected: boolean } }
    ).__testPad.connected = false;
  });
  await page.waitForTimeout(150);
  await expect(page.locator(".satchel-toggle kbd")).toHaveText("I");
  await expect(page.locator(".first-play-hint")).toHaveCount(0);
  const stopped = (await snap()).state;
  await page.waitForTimeout(350);
  expect((await snap()).state).toEqual(stopped);
  await page.keyboard.down("a");
  await page.waitForTimeout(300);
  await page.keyboard.up("a");
  expect((await snap()).state.x).toBeLessThan(stopped.x - 0.5);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "docs/milestones/evidence/gamepad-browser.png",
  });
  writeFileSync(
    "docs/milestones/evidence/gamepad-browser.json",
    JSON.stringify(
      {
        result: "pass",
        input: "simulated standard Gamepad API; no physical controller",
        controllerHints: true,
        keyboardHintsAfterDisconnect: true,
        movement: true,
        aim: true,
        combo: true,
        roll: true,
        charge: true,
        block: true,
        skill: true,
        cycleWeapon: true,
        satchel: true,
        menuBlocksGameplay: true,
        disconnectStops: true,
        keyboardAfterDisconnect: true,
        errors,
      },
      null,
      2,
    ),
  );
});
