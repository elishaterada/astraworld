import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
test("M6 saved inventory resumes after reload and recovery-key import into a fresh browser", async ({
  browser,
}) => {
  const access = process.env.HOSTED_ACCESS_FILE
    ? JSON.parse(readFileSync(process.env.HOSTED_ACCESS_FILE, "utf8"))
    : null;
  const extraHTTPHeaders: Record<string, string> = access
    ? {
        "x-vercel-protection-bypass": access.secret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {};
  const a = await browser.newContext({ extraHTTPHeaders }),
    b = await browser.newContext({ extraHTTPHeaders });
  const errors: string[] = [];
  try {
    for (const context of [a, b])
      await context.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed test"));
      });
    const p = await a.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/?debug=1");
    await p.getByLabel("What should we call you?").fill("Rowan");
    await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await p.getByRole("application").focus();
    await p.keyboard.press("e");
    await p.waitForFunction(
      () =>
        window.__MEADOW__?.snapshot().progress?.receipt?.result === "gathered",
    );
    const inventory = await p.evaluate(
      () => window.__MEADOW__!.snapshot().progress!.inventory,
    );
    await p.getByRole("button", { name: "Open menu" }).click();
    await expect(
      p.getByText("Progress is saved to this world.", { exact: false }),
    ).toBeVisible();
    const downloadPromise = p.waitForEvent("download");
    await p.getByRole("button", { name: "Download recovery key" }).click();
    const download = await downloadPromise;
    const buffer = readFileSync((await download.path())!);
    await p.reload();
    await expect(
      p.getByRole("button", { name: "Resume Meadow", exact: true }),
    ).toBeVisible();
    await p.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect(
      await p.evaluate(() => window.__MEADOW__!.snapshot().progress!.inventory),
    ).toEqual(inventory);
    await a.close();
    const q = await b.newPage();
    q.on("pageerror", (e) => errors.push(e.message));
    await q.goto("/?debug=1");
    await q.getByText("Restore a saved world", {exact:true}).click();
    await q.getByLabel("Restore recovery key").setInputFiles({
      name: "astraworld-recovery.json",
      mimeType: "application/json",
      buffer,
    });
    await expect(
      q.getByRole("button", { name: "Resume Meadow", exact: true }),
    ).toBeVisible();
    await q.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await q.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect(
      await q.evaluate(() => window.__MEADOW__!.snapshot().progress!.inventory),
    ).toEqual(inventory);
    await q.getByRole("button", { name: "Open menu" }).click();
    const prefix =
      process.env.RECOVERY_EVIDENCE_PREFIX ??
      "docs/milestones/evidence/m6-recovery-key";
    await q.screenshot({
      path: `${prefix}.png`,
      mask: [q.getByLabel("Invite a friend")],
    });
    expect(errors).toEqual([]);
    writeFileSync(
      `${prefix}.json`,
      JSON.stringify(
        {
          result: "pass",
          reload: true,
          freshBrowserKeyImport: true,
          inventory,
          errors,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await a.close();
    await b.close();
  }
});
