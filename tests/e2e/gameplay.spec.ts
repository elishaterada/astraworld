import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import type { DebugSnapshot } from "../../app/renderer";
async function snapshot(page: Page): Promise<DebugSnapshot> {
  return page.evaluate(() => window.__MEADOW__!.snapshot());
}
test.beforeEach(async ({ page }, info) => {
  if (!info.title.includes("native fullscreen"))
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(
          new DOMException(
            "Fullscreen unavailable in this test",
            "NotAllowedError",
          ),
        );
    });
});
async function openMenu(page: Page) {
  if (!(await page.getByRole("dialog").isVisible()))
    await page.getByRole("button", { name: "Open menu" }).click();
}
async function ready(page: Page) {
  if (
    await page
      .getByRole("textbox", { name: "What should we call you?" })
      .isVisible()
  ) {
    await page
      .getByRole("textbox", { name: "What should we call you?" })
      .fill("Rowan");
    await page
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
  }
  await expect(page.locator(".playfield canvas")).toHaveCount(1);
  await page.waitForFunction(() => !!window.__MEADOW__);
}
async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
}
async function restart(page: Page) {
  await openMenu(page);
  await page
    .getByRole("button", { name: "Regenerate Meadow with this seed" })
    .click();
  await ready(page);
}

test("R0 actual keyboard movement, camera, boundary sliding, resize and focus", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await page.goto("/?solo=1&debug=1");
  await ready(page);
  const initial = await snapshot(page);
  await hold(page, ["d"], 1000);
  const straight = await snapshot(page);
  expect(straight.state.x - initial.state.x).toBeGreaterThan(3.6);
  expect(straight.state.x - initial.state.x).toBeLessThan(4.5);
  expect(straight.state.y).toBe(initial.state.y);
  expect(straight.camera.x).toBeGreaterThan(initial.camera.x);
  expect(straight.actorScreen).toEqual({
    x: straight.width / 2,
    y: straight.height / 2,
  });
  await restart(page);
  await hold(page, ["d", "s"], 1000);
  const diagonal = await snapshot(page);
  const distance = Math.hypot(
    diagonal.state.x - initial.state.x,
    diagonal.state.y - initial.state.y,
  );
  expect(distance).toBeGreaterThan(3.6);
  expect(distance).toBeLessThan(4.5);
  expect(diagonal.collision).toBe(false);
  await hold(page, ["d", "s"], 2500);
  const props = await snapshot(page);
  expect(props.collision).toBe(false);
  await page.screenshot({
    path: "docs/milestones/evidence/m1-regression-gameplay.png",
  });
  await page.setViewportSize({ width: 960, height: 720 });
  await page.waitForTimeout(200);
  const resized = await snapshot(page);
  expect(resized.width).toBeLessThan(initial.width);
  expect(resized.actorScreen).toEqual({
    x: resized.width / 2,
    y: resized.height / 2,
  });
  const box = (await page.getByRole("application").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const pointer = (await page
    .getByRole("application")
    .getAttribute("data-pointer-world"))!
    .split(",")
    .map(Number);
  expect(pointer[0]).toBeCloseTo(resized.camera.x, 2);
  expect(pointer[1]).toBeCloseTo(resized.camera.y, 2);
  await page.keyboard.down("w");
  await page.waitForTimeout(200);
  await openMenu(page);
  await page.getByRole("textbox", { name: "World seed" }).focus();
  const paused = await snapshot(page);
  expect(paused.paused).toBe(true);
  await page.waitForTimeout(300);
  expect((await snapshot(page)).state).toEqual(paused.state);
  await page.keyboard.up("w");
  await page.getByRole("button", { name: "Close menu" }).click();
  await page.waitForTimeout(200);
  expect((await snapshot(page)).state).toEqual(paused.state);
  await page.keyboard.press("Escape");
  expect((await snapshot(page)).paused).toBe(true);
  await restart(page);
  await hold(page, ["a"], 16500);
  const edge = await snapshot(page);
  expect(edge.state.x).toBeCloseTo(1.24, 5);
  expect(edge.collision).toBe(false);
  await hold(page, ["a", "s"], 1500);
  const slide = await snapshot(page);
  expect(slide.state.x).toBeCloseTo(1.24, 5);
  expect(slide.state.y).toBeGreaterThan(edge.state.y + 3);
  expect(slide.collision).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync(
    "docs/milestones/evidence/m1-regression-browser.json",
    JSON.stringify(
      {
        browser: browser.version(),
        viewport: initial.width + "×" + initial.height,
        initial: { ...initial, frames: undefined },
        straight: straight.state,
        diagonal: diagonal.state,
        diagonalDistance: distance,
        props: props.state,
        resized: {
          width: resized.width,
          height: resized.height,
          actorScreen: resized.actorScreen,
        },
        edge: edge.state,
        slide: slide.state,
        errors,
      },
      null,
      2,
    ),
  );
});

test("R1 repeated real unmount/remount and rapid initialization cancellation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?solo=1&debug=1");
  await ready(page);
  const baseline = (await snapshot(page)).live;
  const cdp = await page.context().newCDPSession(page);
  const heaps: number[] = [];
  for (let i = 0; i < 12; i++) {
    await openMenu(page);
    await page.getByRole("button", { name: "Leave meadow" }).click();
    await expect(page.locator(".playfield canvas")).toHaveCount(0);
    expect(await page.evaluate(() => !!window.__MEADOW__)).toBe(false);
    await ready(page);
    expect((await snapshot(page)).live).toEqual(baseline);
    expect((await snapshot(page)).state).toEqual({ x: 64.5, y: 64.5 });
    await cdp.send("HeapProfiler.collectGarbage");
    heaps.push((await cdp.send("Runtime.getHeapUsage")).usedSize);
  }
  // Rapidly discard initialization, exercising the async dispose path.
  for (let i = 0; i < 4; i++) {
    await openMenu(page);
    await page
      .getByRole("button", { name: "Regenerate Meadow with this seed" })
      .click();
    await openMenu(page);
    await page.getByRole("button", { name: "Leave meadow" }).click();
    await ready(page);
  }
  await ready(page);
  await page.waitForTimeout(500);
  expect((await snapshot(page)).live).toEqual(baseline);
  expect(heaps.at(-1)! - heaps[2]).toBeLessThan(8 * 1024 * 1024);
  expect(errors).toEqual([]);
  writeFileSync(
    "docs/milestones/evidence/m1-regression-lifecycle.json",
    JSON.stringify(
      { cycles: 12, rapidCycles: 4, resources: baseline, heaps, errors },
      null,
      2,
    ),
  );
});

test("G0 seed controls regenerate the same rendered landscape and reset movement", async ({
  page,
}) => {
  await page.goto("/?solo=1&debug=1");
  await ready(page);
  await openMenu(page);
  const seed = page.getByRole("textbox", { name: "World seed" });
  await seed.fill("brook-42");
  expect((await snapshot(page)).paused).toBe(true);
  await restart(page);
  await page.waitForTimeout(150);
  expect((await snapshot(page)).seed).toBe("brook-42");
  const first = await page.locator(".playfield canvas").screenshot();
  await hold(page, ["ArrowRight"], 400);
  await restart(page);
  await page.waitForTimeout(150);
  expect((await snapshot(page)).state).toEqual({ x: 64.5, y: 64.5 });
  const second = await page.locator(".playfield canvas").screenshot();
  expect(second.equals(first)).toBe(true);
  await openMenu(page);
  await seed.fill("another-meadow");
  await restart(page);
  await page.waitForTimeout(150);
  expect(
    (await page.locator(".playfield canvas").screenshot()).equals(first),
  ).toBe(false);
});

test("visibility event handler clears input and freezes ticks until explicit resume", async ({
  page,
}) => {
  await page.goto("/?solo=1&debug=1");
  await ready(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(150);
  // Chromium automation keeps all targets visible here. Exercise the handler explicitly.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await snapshot(page);
  expect(hidden.paused).toBe(true);
  await page.waitForTimeout(250);
  expect((await snapshot(page)).tick).toBe(hidden.tick);
  await page.keyboard.up("d");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  expect((await snapshot(page)).paused).toBe(true);
  expect((await snapshot(page)).state).toEqual(hidden.state);
  await page.getByRole("button", { name: "Return to the Meadow" }).click();
  await page.waitForTimeout(150);
  expect((await snapshot(page)).state).toEqual(hidden.state);
  await hold(page, ["w"], 300);
  expect((await snapshot(page)).state.y).toBeLessThan(hidden.state.y);
});

test("username gate, viewport fallback and local display name", async ({
  page,
}) => {
  await page.goto("/?solo=1&debug=1");
  await expect(page.locator(".playfield canvas")).toHaveCount(0);
  await page.screenshot({
    path: "docs/milestones/evidence/m1-regression-entry.png",
  });
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await expect(page.locator("#name-error")).toContainText("2–20");
  await expect(page.locator(".playfield canvas")).toHaveCount(0);
  await page.getByLabel("What should we call you?").fill("  Mika  ");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await ready(page);
  await expect(page.getByLabel("Player Mika", { exact: true })).toBeVisible();
  expect((await snapshot(page)).username).toBe("Mika");
  const size = page.viewportSize()!,
    box = (await page.getByRole("application").boundingBox())!;
  expect(box).toEqual({ x: 0, y: 0, ...size });
  await expect(
    page.getByText("Playing in your browser window.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss fullscreen notice" }).click();
  await page.getByRole("application").focus();
  await page.screenshot({
    path: "docs/milestones/evidence/m1-regression-first-game.png",
  });

  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    size.height,
  );
  await hold(page, ["d"], 300);
  expect((await snapshot(page)).state.x).toBeGreaterThan(64.5);
  await openMenu(page);
  await page.getByRole("button", { name: "Leave meadow" }).click();
  await expect(page.locator(".playfield canvas")).toHaveCount(0);
  await expect(page.getByLabel("What should we call you?")).toHaveValue("Mika");
  await page.reload();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("");
});

test("native fullscreen entry and exit preserve a playable viewport", async ({
  page,
}) => {
  await page.goto("/?solo=1&debug=1");
  await ready(page);
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  const fullscreen = await snapshot(page);
  expect(fullscreen.width).toBe(await page.evaluate(() => innerWidth));
  expect(fullscreen.height).toBe(await page.evaluate(() => innerHeight));
  writeFileSync(
    "docs/milestones/evidence/m1-regression-fullscreen.json",
    JSON.stringify(
      {
        nativeFullscreen: true,
        width: fullscreen.width,
        height: fullscreen.height,
        username: fullscreen.username,
      },
      null,
      2,
    ),
  );
  await hold(page, ["d"], 300);
  expect((await snapshot(page)).state.x).toBeGreaterThan(64.5);
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  expect((await snapshot(page)).paused).toBe(true);
  await page.getByRole("button", { name: "Return to the Meadow" }).click();
  await hold(page, ["w"], 300);
  expect((await snapshot(page)).paused).toBe(false);
});
