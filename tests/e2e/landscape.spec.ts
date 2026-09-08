import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("organic Meadow renders and traverses with bounded frame times", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Windowed test"));
    localStorage.setItem("meadow-controls-seen-v1", "1");
  });
  await page.goto("/?solo=1&debug=1");
  await page.getByLabel("What should we call you?").fill("Rowan");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(() => !!window.__MEADOW__);
  await page.getByRole("application").focus();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: "docs/milestones/evidence/organic-meadow-camp.png",
  });
  for (const key of ["w", "s", "d", "a"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(2200);
    await page.keyboard.up(key);
    expect(
      await page.evaluate(() => window.__MEADOW__!.snapshot().collision),
    ).toBe(false);
  }
  await page.screenshot({
    path: "docs/milestones/evidence/organic-meadow-field.png",
  });
  const s = await page.evaluate(() => {
    const s = window.__MEADOW__!.snapshot(),
      f = s.frames.slice(-500).sort((a, b) => a - b);
    return { p95: f[Math.floor(f.length * 0.95)], renderer: s.renderer };
  });
  expect(errors).toEqual([]);
  expect(s.p95).toBeLessThanOrEqual(20);
  writeFileSync(
    "docs/milestones/evidence/organic-meadow-browser.json",
    JSON.stringify({ result: "pass", ...s, errors }, null, 2),
  );
});
