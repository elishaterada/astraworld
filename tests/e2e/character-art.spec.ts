import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

test("each 3D character rotates, walks, stands and waves with the shared rig", async ({
  browser,
}) => {
  const results = [];
  for (const look of ["Fern", "Ember", "Iris", "Hazel"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await context.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed art review"));
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/?solo=1&debug=1");
      await page.getByLabel("What should we call you?").fill(look);
      await page.getByRole("radio", { name: look }).check();
      await page
        .getByRole("button", { name: "Enter Meadow", exact: true })
        .click();
      await page.waitForFunction(() => !!window.__MEADOW__);
      await page.getByRole("application").focus();
      const poses = [];
      for (const [key, row] of [
        ["d", Math.PI / 2],
        ["w", -Math.PI],
        ["s", 0],
        ["a", -Math.PI / 2],
      ] as const) {
        await page.keyboard.down(key);
        let movingFrame = -1;
        await expect
          .poll(
            async () => {
              const current = await page.evaluate(() =>
                window.__MEADOW__!.snapshot(),
              );
              movingFrame = current.visual.gait;
              return (
                Math.abs(movingFrame) > 0.1 &&
                current.visual.rotation === row &&
                !current.collision
              );
            },
            { intervals: [25, 50, 75, 100] },
          )
          .toBe(true);
        await page.keyboard.up(key);
        await expect
          .poll(() =>
            page.evaluate(() => window.__MEADOW__!.snapshot().visual.gait),
          )
          .toBe(0);
        poses.push({
          key,
          movingFrame,
          rotation: row,
        });
      }
      await page.keyboard.press("Space");
      await expect
        .poll(() =>
          page.evaluate(() => window.__MEADOW__!.snapshot().visual.waving),
        )
        .toBe(true);
      await page.screenshot({
        path: `docs/milestones/evidence/visual-3d-${look.toLowerCase()}.png`,
      });
      expect(errors).toEqual([]);
      results.push({ character: look, poses, errors });
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    "docs/milestones/evidence/visual-3d-directions.json",
    JSON.stringify({ browser: browser.version(), results }, null, 2),
  );
});
