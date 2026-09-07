import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
test("renew live sockets without periodic room pauses", async ({ browser }) => {
  test.skip(
    process.env.REALTIME_LIFECYCLE !== "1",
    "Explicit lifecycle observation",
  );
  const duration = Number(process.env.LIFECYCLE_MS ?? 26000);
  test.setTimeout(duration + 45000);
  const access = process.env.HOSTED_ACCESS_FILE
    ? JSON.parse(readFileSync(process.env.HOSTED_ACCESS_FILE, "utf8"))
    : null;
  const extraHTTPHeaders: Record<string, string> = access
    ? {
        "x-vercel-protection-bypass": access.secret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {};
  const contexts = await Promise.all([
    browser.newContext({ extraHTTPHeaders }),
    browser.newContext({ extraHTTPHeaders }),
  ]);
  const errors: string[] = [];
  try {
    for (let i = 0; i < 2; i++)
      await contexts[i].addInitScript(
        ({ second }) => {
          Element.prototype.requestFullscreen = () =>
            Promise.reject(new DOMException("Windowed test"));
          const Original = window.WebSocket;
          window.WebSocket = class extends Original {
            constructor(url: string | URL, protocols?: string | string[]) {
              super(
                second ? String(url).replace(":3103/", ":3104/") : url,
                protocols,
              );
            }
          };
        },
        { second: i === 1 },
      );
    const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
    for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
    const ready = (p: typeof a) =>
      p.waitForFunction(
        () => window.__MEADOW__?.snapshot().network?.status === "Connected",
      );
    await a.goto("/?debug=1");
    await a.getByLabel("What should we call you?").fill("Rowan");
    await a.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await ready(a);
    await a.getByRole("button", { name: "Open menu" }).click();
    const invite = await a.getByLabel("Invite a friend").inputValue();
    await a.getByRole("button", { name: "Keep exploring" }).click();
    await b.goto(`${invite}&debug=1`);
    await b.getByLabel("What should we call you?").fill("Mika");
    await b.getByRole("radio", { name: "Iris" }).check();
    await b.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await ready(b);
    for (const p of [a, b])
      await p.evaluate(() => {
        const samples: {
          at: number;
          tick: number;
          epoch: number;
          generation: number;
          owner: string;
          age: number;
        }[] = [];
        Object.assign(window, {
          __netSamples: samples,
          __sampleTimer: setInterval(() => {
            const n = window.__MEADOW__?.snapshot().network;
            if (!n) return;
            const last = samples.at(-1);
            if (
              !last ||
              last.tick !== n.tick ||
              last.epoch !== n.epoch ||
              last.generation !== n.generation
            )
              samples.push({
                at: performance.now(),
                tick: n.tick,
                epoch: n.epoch,
                generation: n.generation,
                owner: n.owner,
                age: n.snapshotAge,
              });
          }, 20),
        });
      });
    const initial = await a.evaluate(() => window.__MEADOW__!.snapshot());
    await a.waitForTimeout(duration);
    await ready(a);
    await ready(b);
    const final = await a.evaluate(() => window.__MEADOW__!.snapshot());
    expect(final.network!.generation).toBeGreaterThan(
      initial.network!.generation,
    );
    expect(final.network!.remotes).toHaveLength(1);
    expect(final.network!.selfId).toBe(initial.network!.selfId);
    await a.getByRole("application").focus();
    await a.keyboard.press("Space");
    await expect
      .poll(async () =>
        b.evaluate(
          () =>
            window.__MEADOW__!.snapshot().network!.remotes[0]?.action
              ?.generation,
        ),
      )
      .toBe(final.network!.generation);
    const results = [];
    for (const p of [a, b]) {
      const samples = await p.evaluate(() => {
        const w = window as unknown as {
          __netSamples: {
            at: number;
            tick: number;
            epoch: number;
            generation: number;
            owner: string;
            age: number;
          }[];
          __sampleTimer: number;
        };
        clearInterval(w.__sampleTimer);
        return w.__netSamples;
      });
      const gaps = samples
        .slice(1)
        .map((s, i) => s.at - samples[i].at)
        .sort((a, b) => a - b);
      const elapsed = samples.at(-1)!.at - samples[0].at;
      const result = {
        observedMs: elapsed,
        maxGapMs: Math.max(...gaps),
        p95GapMs: gaps[Math.floor(gaps.length * 0.95)],
        serverHz: ((samples.at(-1)!.tick - samples[0].tick) * 1000) / elapsed,
        generations: [...new Set(samples.map((s) => s.generation))],
        owners: [...new Set(samples.map((s) => s.owner))],
        epochs: [...new Set(samples.map((s) => s.epoch))],
      };
      expect(result.maxGapMs).toBeLessThan(3000);
      expect(result.serverHz).toBeGreaterThan(50);
      results.push(result);
    }
    expect(errors).toEqual([]);
    writeFileSync(
      `docs/milestones/evidence/m1-v2-${access ? "hosted" : "local"}-lifecycle.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          requestedDurationMs: duration,
          clients: results,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
