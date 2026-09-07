import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("dodge renders a torso roll locally and for another player", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed test"));
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q])
      page.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/?debug=1");
    await p.getByLabel("What should we call you?").fill("Roller");
    await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await q.getByLabel("What should we call you?").fill("Observer");
    await q.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await q.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.remotes.length === 1,
    );
    const samples = [p, q].map((page) =>
      page.evaluate(
        () =>
          new Promise<number[]>((resolve) => {
            const rolls: number[] = [],
              start = performance.now();
            function sample() {
              const s = window.__MEADOW__!.snapshot();
              rolls.push(
                s.username === "Roller"
                  ? s.visual.roll
                  : (s.network!.remotes[0]?.visual?.roll ?? 0),
              );
              if (performance.now() - start < 1500)
                requestAnimationFrame(sample);
              else resolve(rolls);
            }
            sample();
          }),
      ),
    );
    await p.getByRole("application").focus();
    await p.keyboard.down("d");
    await p.keyboard.press("Shift");
    await p.waitForTimeout(100);
    await p.screenshot({ path: "docs/milestones/evidence/qol-roll.png" });
    await p.keyboard.up("d");
    const [local, remote] = await Promise.all(samples);
    for (const values of [local, remote]) {
      expect(Math.max(...values)).toBeGreaterThan(Math.PI);
      expect(values.at(-1)).toBe(0);
    }
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/qol-roll.json",
      JSON.stringify({ result: "pass", local, remote, errors }, null, 2),
    );
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});
