import { CONTENT_VERSION } from "../../packages/world";
import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const snap = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function enter(p: Page, name: string) {
  await p.getByLabel("What should we call you?").fill(name);
  await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await p.waitForFunction(
    () =>
      window.__MEADOW__?.snapshot().network?.status === "Connected" &&
      !!window.__MEADOW__?.snapshot().progress,
  );
}
async function move(p: Page, key: string, ms: number) {
  await p.getByRole("application").focus();
  await p.keyboard.down(key);
  await p.waitForTimeout(ms);
  await p.keyboard.up(key);
  await p.waitForTimeout(250);
}
test("M2 two players gather, see depletion, chop a tree and resume inventory", async ({
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
  const evidence =
    process.env.GATHER_EVIDENCE_PREFIX ?? "docs/milestones/evidence/m2";
  const errors: string[] = [];
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
    await enter(p, "Rowan");
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await enter(q, "Iris");
    await expect
      .poll(async () => (await snap(p)).network!.remotes.length)
      .toBe(1);
    await p.getByRole("application").focus();
    await q.getByRole("application").focus();
    // Separate authenticated sessions race on the same highlighted bush.
    expect((await snap(p)).target?.id).toBe((await snap(q)).target?.id);
    await Promise.all([p.keyboard.press("e"), q.keyboard.press("e")]);
    await expect
      .poll(async () =>
        [
          (await snap(p)).progress?.receipt?.result,
          (await snap(q)).progress?.receipt?.result,
        ].sort(),
      )
      .toEqual(["depleted", "gathered"]);
    const first = await snap(p),
      second = await snap(q);
    expect(first.depleted).toEqual(second.depleted);
    expect(
      [first, second]
        .flatMap((s) => s.progress!.inventory)
        .filter((s) => s?.item === "sweet-berry")
        .reduce((n, s) => n + s!.quantity, 0),
    ).toBe(3);
    const winnerPage = first.progress!.receipt!.result === "gathered" ? p : q;
    await winnerPage.getByRole("button", { name: "Open inventory" }).click();
    await expect(
      winnerPage.getByLabel("Sweet Berries: 3", { exact: true }),
    ).toBeVisible();
    await winnerPage.screenshot({ path: `${evidence}-berries.png` });
    await winnerPage.getByRole("button", { name: "Close inventory" }).click();
    // Central path north, then approach the tree at (62.5,58.5) from the east.
    await move(p, "w", 1500);
    await move(p, "a", 230);
    await expect.poll(async () => (await snap(p)).target?.kind).toBe("tree");
    await p.keyboard.press("e");
    await expect
      .poll(
        async () =>
          (await snap(p)).progress!.inventory.find((s) => s?.item === "wood")
            ?.quantity,
      )
      .toBe(3);
    await expect
      .poll(async () => (await snap(q)).depleted)
      .toEqual((await snap(p)).depleted);
    await expect
      .poll(
        async () =>
          (await snap(q)).network!.remotes.find(
            (a) => a.id === first.network!.selfId,
          )?.action?.resource,
      )
      .toBe("tree");
    await p.getByRole("button", { name: "Open inventory" }).click();
    await expect(p.getByLabel("Wood: 3", { exact: true })).toBeVisible();
    await p.screenshot({ path: `${evidence}-stump.png` });
    const before = await snap(p);
    await p.reload();
    await p.getByRole("button", { name: "Resume Meadow" }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await expect
      .poll(async () => (await snap(p)).progress?.inventory)
      .toEqual(before.progress!.inventory);
    expect((await snap(p)).depleted).toEqual(before.depleted);
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}-browser.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          content: CONTENT_VERSION,
          race: [first.progress?.receipt, second.progress?.receipt],
          inventory: before.progress!.inventory,
          depleted: before.depleted,
          reload: true,
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
