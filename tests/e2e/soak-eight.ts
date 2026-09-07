import { expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { cpus, release } from "node:os";
export async function soakEight(pages: Page[]) {
  const start = Date.now(),
    samples: unknown[] = [],
    heaps: number[][] = [];
  const sessions = await Promise.all(
    pages.map((p) => p.context().newCDPSession(p)),
  );
  const snapshot = (p: Page) =>
    p.evaluate(() => {
      const { frames, ...s } = window.__MEADOW__!.snapshot();
      return s;
    });
  const initial = await Promise.all(pages.map(snapshot));
  for (let i = 0; i < 120; i++) {
    const key = ["d", "a", "w", "s"][i % 4];
    await Promise.all(
      pages.map(async (p) => {
        await p.getByRole("application").focus();
        await p.keyboard.down(key);
      }),
    );
    await pages[0].waitForTimeout(5000);
    await Promise.all(pages.map((p) => p.keyboard.up(key)));
    const current = await Promise.all(pages.map(snapshot));
    for (let n = 0; n < 8; n++) {
      expect(current[n].collision).toBe(false);
      expect(current[n].network!.selfId).toBe(initial[n].network!.selfId);
      expect(current[n].network!.remotes).toHaveLength(7);
    }
    samples.push(current);
    if (i % 12 === 11) {
      const heap: number[] = [];
      for (const cd of sessions) {
        await cd.send("HeapProfiler.collectGarbage");
        heap.push((await cd.send("Runtime.getHeapUsage")).usedSize);
      }
      heaps.push(heap);
      console.log(
        `Eight-player soak: ${Math.round((Date.now() - start) / 1000)} seconds; all identities and peers intact.`,
      );
    }
  }
  const summary = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => {
        const frames = window.__MEADOW__!.snapshot().frames,
          sorted = frames.toSorted((a, b) => a - b);
        return {
          count: frames.length,
          mean: frames.reduce((a, b) => a + b, 0) / frames.length,
          p95: sorted[Math.floor(sorted.length * 0.95)],
          max: sorted.at(-1),
        };
      }),
    ),
  );
  const stats = await Promise.all(
    [3103, 3104].map(async (port) =>
      (await fetch(`http://127.0.0.1:${port}/health`)).json(),
    ),
  );
  const final = await Promise.all(pages.map(snapshot));
  writeFileSync(
    "docs/milestones/evidence/m1-final-eight-soak.json",
    JSON.stringify(
      {
        elapsedMs: Date.now() - start,
        cpu: cpus()[0].model,
        os: release(),
        browser: pages[0].context().browser()!.version(),
        viewport: pages[0].viewportSize(),
        summary,
        heaps,
        stats,
        initial,
        final,
        samples,
      },
      null,
      2,
    ),
  );
  for (const s of summary) expect(s.p95).toBeLessThanOrEqual(20);
  for (const s of stats) expect(s.metrics.cpuP95Ms).toBeLessThan(25);
  for (let i = 0; i < 8; i++) {
    expect(final[i].network!.generation).toBeGreaterThanOrEqual(
      initial[i].network!.generation + 2,
    );
    expect(heaps.at(-1)![i]).toBeLessThan(heaps[0][i] * 1.3 + 8 * 1024 * 1024);
  }
}
