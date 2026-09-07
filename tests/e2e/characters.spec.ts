import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

test("character selection, private invitation, shared movement and saved appearance", async ({
  browser,
}) => {
  // Optional private Vercel automation access for the same end-to-end check on the hosted app.
  const access = process.env.HOSTED_ACCESS_FILE
    ? JSON.parse(readFileSync(process.env.HOSTED_ACCESS_FILE, "utf8"))
    : undefined;
  const extraHTTPHeaders: Record<string, string> = access
    ? {
        "x-vercel-protection-bypass": access.secret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {};
  const evidence =
    process.env.CHARACTER_EVIDENCE_PREFIX ??
    "docs/milestones/evidence/m1-character";
  const aContext = await browser.newContext({
    extraHTTPHeaders,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const bContext = await browser.newContext({ extraHTTPHeaders });
  const errors: string[] = [];
  for (const c of [aContext, bContext])
    await c.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new DOMException("Windowed test"));
    });
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
  const snapshot = (p: typeof a) =>
    p.evaluate(() => window.__MEADOW__!.snapshot());
  const ready = (p: typeof a) =>
    p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
  try {
    await a.goto("/?debug=1");
    await expect(a.getByRole("radio")).toHaveCount(4);
    await expect
      .poll(async () =>
        a.locator(".character-card canvas").evaluateAll((canvases) =>
          canvases.every((c) => {
            const ctx = (c as HTMLCanvasElement).getContext("2d")!;
            return ctx
              .getImageData(0, 0, 128, 160)
              .data.some((v, i) => i % 4 === 3 && v > 128);
          }),
        ),
      )
      .toBe(true);
    const portraits = await a
      .locator(".character-card canvas")
      .evaluateAll((cs) => cs.map((c) => (c as HTMLCanvasElement).toDataURL()));
    expect(new Set(portraits).size).toBe(4);
    await a.getByLabel("What should we call you?").fill("Rowan");
    await a.getByRole("radio", { name: "Ember" }).check();
    await expect(a.getByRole("radio", { name: "Ember" })).toBeChecked();
    await a.screenshot({
      path: `${evidence}-selector.png`,
    });
    await a.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await ready(a);
    await a.getByRole("button", { name: "Open menu" }).click();
    const link = await a.getByLabel("Invite a friend").inputValue();
    await a.getByRole("button", { name: "Copy invite link" }).click();
    await expect(
      a.getByText("Link copied. Send it to your friend."),
    ).toBeVisible();
    expect(await a.evaluate(() => navigator.clipboard.readText())).toBe(link);
    await a.getByRole("button", { name: "Keep exploring" }).click();
    await b.goto(`${link}&debug=1`);
    await expect(b.locator("#name-help")).toContainText("joining a friend");
    await b.getByLabel("What should we call you?").fill("Mika");
    await b.getByRole("radio", { name: "Iris" }).check();
    await b.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await ready(b);
    await expect
      .poll(async () => (await snapshot(a)).network?.remotes[0]?.character)
      .toBe("iris");
    await expect
      .poll(async () => (await snapshot(b)).network?.remotes[0]?.character)
      .toBe("ember");
    const initial = await snapshot(a);
    expect(initial.character).toBe("ember");
    await a.getByRole("application").focus();
    await a.keyboard.down("d");
    await a.waitForTimeout(650);
    await a.keyboard.up("d");
    await a.waitForTimeout(400);
    const moved = await snapshot(a);
    expect(moved.state.x - initial.state.x).toBeGreaterThan(1.5);
    expect(moved.collision).toBe(false);
    expect(
      Math.abs(
        (await snapshot(b)).network!.remotes[0].position.x - moved.state.x,
      ),
    ).toBeLessThan(0.3);
    await a.screenshot({
      path: `${evidence}-gameplay.png`,
    });
    await a.reload();
    await expect(
      a.getByRole("button", { name: "Resume Meadow", exact: true }),
    ).toBeVisible();
    await expect(a.getByRole("radio", { name: "Ember" })).toBeChecked();
    await expect(a.getByRole("radio", { name: "Ember" })).toBeDisabled();
    await expect(a.getByLabel("What should we call you?")).toHaveValue("Rowan");
    await a.getByRole("button", { name: "Resume Meadow", exact: true }).click();
    await ready(a);
    expect((await snapshot(a)).network!.selfId).toBe(initial.network!.selfId);
    expect((await snapshot(a)).character).toBe("ember");
    await expect
      .poll(async () => (await snapshot(b)).network?.remotes[0]?.character)
      .toBe("ember");
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}s.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          viewport: a.viewportSize(),
          characters: ["ember", "iris"],
          observedByFriend: (await snapshot(b)).network!.remotes,
          movementTiles: moved.state.x - initial.state.x,
          resumedSameIdentity: true,
          copiedInvite: true,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
