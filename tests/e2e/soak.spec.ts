import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("ten-minute Meadow traversal frame and memory envelope", async ({
  page,
  browser,
}) => {
  test.skip(!process.env.SOAK, "Run explicitly with npm run test:soak");
  test.setTimeout(650000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Windowed benchmark", "NotAllowedError"));
  });
  await page.goto("/?debug=1");
  await page.getByLabel("What should we call you?").fill("Rowan");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(() => !!window.__MEADOW__);
  await page.getByRole("application").focus();
  const cdp = await page.context().newCDPSession(page);
  const samples: unknown[] = [],
    heaps: number[] = [];
  const start = Date.now();
  for (let i = 0; i < 60; i++) {
    const key = ["d", "a", "w", "s"][i % 4];
    await page.keyboard.down(key);
    await page.waitForTimeout(10000);
    await page.keyboard.up(key);
    const state = await page.evaluate(() => {
      const { frames, ...s } = window.__MEADOW__!.snapshot();
      return { ...s, frames: frames.length };
    });
    expect(state.collision).toBe(false);
    expect(state.paused).toBe(false);
    samples.push(state);
    if (i % 10 === 9) {
      await cdp.send("HeapProfiler.collectGarbage");
      heaps.push((await cdp.send("Runtime.getHeapUsage")).usedSize);
    }
  }
  const frames = await page.evaluate(
    () => window.__MEADOW__!.snapshot().frames,
  );
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const result = {
    browser: browser.version(),
    userAgent: await page.evaluate(() => navigator.userAgent),
    viewport: page.viewportSize(),
    dpr: await page.evaluate(() => devicePixelRatio),
    elapsedSeconds: (Date.now() - start) / 1000,
    frameCount: frames.length,
    meanMs: frames.reduce((a, b) => a + b, 0) / frames.length,
    p95Ms: p95,
    maxMs: sorted.at(-1),
    over20Ms: frames.filter((f) => f > 20).length,
    heaps,
    samples,
    errors,
  };
  writeFileSync(
    "docs/milestones/evidence/m0-style-performance.json",
    JSON.stringify(result, null, 2),
  );
  expect(frames.length).toBeGreaterThan(30000);
  expect(p95).toBeLessThanOrEqual(20);
  expect(errors).toEqual([]);
  expect(heaps.at(-1)! - heaps[1]).toBeLessThan(8 * 1024 * 1024);
});
