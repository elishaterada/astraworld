import { test, expect } from "@playwright/test";
test("compact HUD hides inventory, teaches once, and restores keyboard control", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Windowed UI review"));
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?solo=1&debug=1");
  await page.getByLabel("What should we call you?").fill("Rowan");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(() => !!window.__MEADOW__?.snapshot().progress);
  await expect(
    page.getByRole("dialog", { name: "Inventory" }),
  ).not.toBeVisible();
  await expect(page.locator(".walk-hint")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Dismiss controls hint" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss controls hint" }).click();
  await expect(page.locator(".first-play-hint")).toHaveCount(0);
  await page.getByRole("application").focus();
  await page.keyboard.press("e");
  await expect(page.locator(".gather-notice")).toHaveText("+3 Sweet Berries");
  await page.screenshot({ path: "docs/milestones/evidence/m2-hud-play.png" });
  await page.keyboard.press("i");
  const inventory = page.getByRole("dialog", { name: "Inventory" });
  await expect(inventory).toBeVisible();
  await expect(
    page.getByLabel("Sweet Berries: 3", { exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() => window.__MEADOW__!.snapshot().state);
  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  await page.keyboard.up("w");
  expect(
    await page.evaluate(() => window.__MEADOW__!.snapshot().state),
  ).toEqual(before);
  await page.screenshot({
    path: "docs/milestones/evidence/m2-hud-satchel.png",
  });
  await page.keyboard.press("i");
  await expect(inventory).not.toBeVisible();
  await expect(page.getByRole("application")).toBeFocused();
  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  await page.keyboard.up("w");
  expect(
    (await page.evaluate(() => window.__MEADOW__!.snapshot().state)).y,
  ).toBeLessThan(before.y);
  await page.getByRole("button", { name: "Open inventory" }).click();
  await page.keyboard.press("Escape");
  await expect(inventory).not.toBeVisible();
  await expect(page.getByRole("application")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
  await page.getByText("Controls", { exact: true }).click();
  await expect(
    page.getByText("WASD / arrow keys", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 800, height: 600 });
  await page.getByRole("button", { name: "Open inventory" }).click();
  await page.screenshot({ path: "docs/milestones/evidence/m2-hud-small.png" });
  await page.reload();
  await page.getByLabel("What should we call you?").fill("Rowan");
  await page.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await page.waitForFunction(() => !!window.__MEADOW__?.snapshot().progress);
  await expect(page.locator(".first-play-hint")).toHaveCount(0);
  await expect(inventory).not.toBeVisible();
  expect(errors).toEqual([]);
});
