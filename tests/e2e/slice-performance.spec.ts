import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { cpus, release } from "node:os";
test("M5 two-player traversal frame sample", async ({ browser }) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  try {
    for (const page of pages) {
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed verification"));
        localStorage.setItem("meadow-combat-controls-seen-v1", "1");
      });
    }
    await pages[0].goto("/?debug=1");
    await pages[0].getByLabel("What should we call you?").fill("Rowan");
    await pages[0]
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await pages[0].waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await pages[0].getByRole("button", { name: "Open menu" }).click();
    const invite = await pages[0].getByLabel("Invite a friend").inputValue();
    await pages[0].getByRole("button", { name: "Keep exploring" }).click();
    await pages[1].goto(`${invite}&debug=1`);
    await expect(
      pages[1].getByText(
        "You’re joining a friend’s Meadow. Choose a name and look.",
        { exact: true },
      ),
    ).toBeVisible();
    await pages[1].getByLabel("What should we call you?").fill("Iris");
    await pages[1]
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await pages[1].waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    const samples = pages.map((p) =>
      p.evaluate(
        () =>
          new Promise<{ p95: number; frames: number; max: number }>(
            (resolve) => {
              const intervals: number[] = [];
              const start = performance.now();
              let prior = start;
              function sample(now: number) {
                intervals.push(now - prior);
                prior = now;
                if (now - start < 30000) requestAnimationFrame(sample);
                else {
                  intervals.sort((a, b) => a - b);
                  resolve({
                    p95: intervals[Math.floor(intervals.length * 0.95)],
                    frames: intervals.length,
                    max: intervals.at(-1)!,
                  });
                }
              }
              requestAnimationFrame(sample);
            },
          ),
      ),
    );
    for (let i = 0; i < 6; i++) {
      const key = i % 2 ? "a" : "d";
      await Promise.all(
        pages.map(async (p) => {
          await p.getByRole("application").focus();
          await p.keyboard.down(key);
        }),
      );
      await pages[0].waitForTimeout(5000);
      await Promise.all(pages.map((p) => p.keyboard.up(key)));
    }
    const results = await Promise.all(samples);
    const states = await Promise.all(
      pages.map((p) =>
        p.evaluate(() => {
          const s = window.__MEADOW__!.snapshot();
          return {
            collision: s.collision,
            peers: s.network!.remotes.length,
            renderer: s.renderer,
          };
        }),
      ),
    );
    writeFileSync(
      "docs/milestones/evidence/m5-two-performance.json",
      JSON.stringify(
        {
          cpu: cpus()[0].model,
          os: release(),
          browser: browser.version(),
          viewport: pages[0].viewportSize(),
          seconds: 30,
          results,
          states,
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
    for (const s of states) {
      expect(s.collision).toBe(false);
      expect(s.peers).toBe(1);
    }
    for (const r of results) expect(r.p95).toBeLessThanOrEqual(20);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
