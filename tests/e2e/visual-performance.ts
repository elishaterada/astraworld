import { expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { cpus, release } from "node:os";
/** Focused 60-second renderer check; does not replace the historical ten-minute M1 soak. */
export async function visualPerformance(pages: Page[]) {
  const start = Date.now();
  const cds = await Promise.all(pages.map((p) => p.context().newCDPSession(p)));
  const initialFrames = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => window.__MEADOW__!.snapshot().frames.length),
    ),
  );
  const heaps: number[][] = [];
  async function heap() {
    return Promise.all(
      cds.map(async (cd) => {
        await cd.send("HeapProfiler.collectGarbage");
        return (await cd.send("Runtime.getHeapUsage")).usedSize as number;
      }),
    );
  }
  heaps.push(await heap());
  for (let i = 0; i < 12; i++) {
    const key = ["d", "a", "w", "s"][i % 4];
    await Promise.all(
      pages.map(async (p) => {
        await p.getByRole("application").focus();
        await p.keyboard.down(key);
      }),
    );
    await pages[0].waitForTimeout(5000);
    await Promise.all(pages.map((p) => p.keyboard.up(key)));
    for (const p of pages) {
      const s = await p.evaluate(() => window.__MEADOW__!.snapshot());
      expect(s.collision).toBe(false);
      expect(s.network!.remotes).toHaveLength(7);
    }
  }
  heaps.push(await heap());
  const summary = await Promise.all(
    pages.map((p, i) =>
      p.evaluate((start) => {
        const s = window.__MEADOW__!.snapshot(),
          frames = s.frames.slice(start).sort((a, b) => a - b);
        return {
          frames: frames.length,
          p95: frames[Math.floor(frames.length * 0.95)],
          max: frames.at(-1),
          renderer: s.renderer,
          live: s.live,
          collision: s.collision,
          peers: s.network!.remotes.length,
        };
      }, initialFrames[i]),
    ),
  );
  writeFileSync(
    "docs/milestones/evidence/visual-3d-performance.json",
    JSON.stringify(
      {
        elapsedMs: Date.now() - start,
        cpu: cpus()[0].model,
        os: release(),
        browser: pages[0].context().browser()!.version(),
        viewport: pages[0].viewportSize(),
        summary,
        heaps,
      },
      null,
      2,
    ),
  );
  for (const s of summary) {
    expect(s.frames).toBeGreaterThan(1000);
    expect(s.p95).toBeLessThanOrEqual(20);
  }
  for (let i = 0; i < 8; i++)
    expect(heaps[1][i] - heaps[0][i]).toBeLessThan(8 * 1024 * 1024);
}
