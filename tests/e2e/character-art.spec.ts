import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";

test("each distinct character walks and turns through its own front, back and side frames", async ({
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
        ["d", 6],
        ["w", 3],
        ["s", 0],
        ["a", 6],
      ] as const) {
        await page.keyboard.down(key);
        let movingFrame = -1;
        await expect
          .poll(
            async () => {
              const current = await page.evaluate(() =>
                window.__MEADOW__!.snapshot(),
              );
              movingFrame = current.characterFrame;
              return (
                movingFrame > row && movingFrame < row + 3 && !current.collision
              );
            },
            { intervals: [25, 50, 75, 100] },
          )
          .toBe(true);
        await page.keyboard.up(key);
        await expect
          .poll(() =>
            page.evaluate(() => window.__MEADOW__!.snapshot().characterFrame),
          )
          .toBe(row);
        poses.push({
          key,
          movingFrame,
          standingFrame: row,
        });
      }
      await page.screenshot({
        path: `docs/milestones/evidence/m1-art-${look.toLowerCase()}.png`,
      });
      expect(errors).toEqual([]);
      results.push({ character: look, poses, errors });
    } finally {
      await context.close();
    }
  }
  writeFileSync(
    "docs/milestones/evidence/m1-art-directions.json",
    JSON.stringify({ browser: browser.version(), results }, null, 2),
  );
});
