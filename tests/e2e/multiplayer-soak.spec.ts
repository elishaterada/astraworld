import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test("M1 ten-minute two-player traversal and planned owner rotations", async ({
  browser,
}) => {
  test.skip(!process.env.M1_SOAK, "Run with M1_SOAK=1");
  test.setTimeout(650000);
  const a = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    b = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  for (const c of [a, b])
    await c.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new DOMException("Windowed soak", "NotAllowedError"));
    });
  await b.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(String(url).replace(":3103/", ":3104/"), protocols);
      }
    };
  });
  const left = await a.newPage(),
    right = await b.newPage();
  const errors: string[] = [];
  for (const p of [left, right])
    p.on("pageerror", (e) => errors.push(e.message));
  const stats = async () =>
    Promise.all(
      [3103, 3104].map(async (port) =>
        (await fetch(`http://127.0.0.1:${port}/health`)).json(),
      ),
    );
  const beforeStats = await stats();
  try {
    await left.goto("/?debug=1");
    await left.getByLabel("What should we call you?").fill("Rowan");
    await left
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await left.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await left.getByRole("button", { name: "Open menu" }).click();
    const link = await left.getByLabel("Invite a friend").inputValue();
    await left.getByRole("button", { name: "Keep exploring" }).click();
    await right.goto(`${link}&debug=1`);
    await right.getByLabel("What should we call you?").fill("Mika");
    await right
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await right.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    const cds = await Promise.all([
      a.newCDPSession(left),
      b.newCDPSession(right),
    ]);
    const heaps: number[][] = [],
      samples: unknown[] = [];
    const start = Date.now();
    for (let i = 0; i < 60; i++) {
      const key = ["d", "a", "w", "s"][i % 4];
      for (const p of [left, right]) {
        await p.getByRole("application").focus();
        await p.keyboard.down(key);
      }
      await left.waitForTimeout(10000);
      for (const p of [left, right]) await p.keyboard.up(key);
      const snap = await Promise.all(
        [left, right].map((p) =>
          p.evaluate(() => {
            const { frames, ...s } = window.__MEADOW__!.snapshot();
            return { ...s, frames: frames.length };
          }),
        ),
      );
      for (const s of snap) {
        expect(s.collision).toBe(false);
        expect(s.network?.remotes).toHaveLength(1);
      }
      samples.push(snap);
      if (i % 10 === 9) {
        const h: number[] = [];
        for (const cd of cds) {
          await cd.send("HeapProfiler.collectGarbage");
          h.push((await cd.send("Runtime.getHeapUsage")).usedSize);
        }
        heaps.push(h);
      }
    }
    const frames = await Promise.all(
      [left, right].map((p) =>
        p.evaluate(() => window.__MEADOW__!.snapshot().frames),
      ),
    );
    const summary = frames.map((f) => {
      const sorted = f.toSorted((a, b) => a - b);
      return {
        count: f.length,
        mean: f.reduce((a, b) => a + b, 0) / f.length,
        p95: sorted[Math.floor(f.length * 0.95)],
        max: sorted.at(-1),
        over20: f.filter((x) => x > 20).length,
      };
    });
    const afterStats = await stats();
    writeFileSync(
      "docs/milestones/evidence/m1-v2-soak.json",
      JSON.stringify(
        {
          browser: browser.version(),
          viewport: { width: 1440, height: 900 },
          dpr: 1,
          elapsedMs: Date.now() - start,
          summary,
          heaps,
          beforeStats,
          afterStats,
          samples,
          errors,
        },
        null,
        2,
      ),
    );
    for (const s of summary) expect(s.p95).toBeLessThanOrEqual(20);
    expect(errors).toEqual([]);
    const epochs = new Set(
      (samples as { network: { epoch: number } }[][]).map(
        (s) => s[0].network.epoch,
      ),
    );
    expect(epochs.size).toBeGreaterThan(2);
  } finally {
    await Promise.all([a.close(), b.close()]);
  }
});
