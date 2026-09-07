import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const netem = (mode: string) =>
  execFileSync("bash", ["scripts/netem.sh", mode], { encoding: "utf8" });
const p95 = (xs: number[]) =>
  xs.toSorted((a, b) => a - b)[Math.floor(xs.length * 0.95)];

test("real TCP loss preserves predicted movement, facing, waves and recovery", async ({
  browser,
}) => {
  test.skip(
    process.env.M1_NETEM !== "1",
    "Requires disposable Linux with receiver-ingress netem",
  );
  test.setTimeout(300000);
  const evidence = "test-results/m1-network";
  mkdirSync(evidence, { recursive: true });
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const errors: string[] = [],
    phases: unknown[] = [];
  const connections = [
    { receivedBytes: 0, sentBytes: 0 },
    { receivedBytes: 0, sentBytes: 0 },
  ];
  const tcpBefore = readFileSync("/proc/net/snmp", "utf8");
  try {
    for (let i = 0; i < 2; i++)
      await contexts[i].addInitScript(
        ({ second }) => {
          Element.prototype.requestFullscreen = () =>
            Promise.reject(new DOMException("Windowed network check"));
          const Native = WebSocket;
          window.WebSocket = class extends Native {
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
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const [a, b] = pages;
    for (let i = 0; i < 2; i++) {
      pages[i].on("pageerror", (e) => errors.push(e.message));
      pages[i].on("websocket", (ws) => {
        ws.on(
          "framereceived",
          (e) => (connections[i].receivedBytes += Buffer.byteLength(e.payload)),
        );
        ws.on(
          "framesent",
          (e) => (connections[i].sentBytes += Buffer.byteLength(e.payload)),
        );
      });
    }
    const snapshot = (p: typeof a) =>
      p.evaluate(() => window.__MEADOW__!.snapshot());
    const ready = (p: typeof a) =>
      expect
        .poll(async () => (await snapshot(p)).network!.status, {
          timeout: 15000,
        })
        .toBe("Connected");
    await a.goto("/?debug=1");
    await a.getByLabel("What should we call you?").fill("Network A");
    await a.getByRole("radio", { name: "Hazel" }).check();
    await a.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await a.waitForFunction(() => !!window.__MEADOW__);
    await ready(a);
    await a.getByRole("button", { name: "Open menu" }).click();
    const invite = await a.getByLabel("Invite a friend").inputValue();
    await a.getByRole("button", { name: "Keep exploring" }).click();
    await b.goto(`${invite}&debug=1`);
    await b.getByLabel("What should we call you?").fill("Network B");
    await b.getByRole("radio", { name: "Ember" }).check();
    await b.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await b.waitForFunction(() => !!window.__MEADOW__);
    await ready(b);
    await expect
      .poll(async () => (await snapshot(b)).network!.remotes.length)
      .toBe(1);
    const identities = await Promise.all(
      pages.map(async (p) => (await snapshot(p)).network!.selfId),
    );
    const started = Date.now();
    for (const [mode, rounds] of [
      ["clean", 8],
      ["normal", 30],
      ["high", 12],
    ] as const) {
      netem(mode);
      const statsBefore = JSON.parse(netem("stats"));
      const phaseStart = Date.now();
      const confirmed: number[] = [],
        visible: number[] = [],
        snapshotAges: number[] = [];
      await a.waitForTimeout(1500);
      for (let i = 0; i < rounds; i++) {
        await a.getByRole("application").focus();
        const initial = await snapshot(a);
        const key = i % 2 ? "a" : "d";
        const pressAt = Date.now();
        await a.keyboard.down(key);
        await expect
          .poll(
            async () => Math.abs((await snapshot(a)).state.x - initial.state.x),
            { intervals: [10, 20, 30], timeout: 2000 },
          )
          .toBeGreaterThan(0.02);
        visible.push(Date.now() - pressAt);
        await a.waitForTimeout(400);
        await a.keyboard.up(key);
        await a.mouse.move(i % 2 ? 100 : 1300, 450);
        await a.waitForTimeout(300);
        const beforeWave = (await snapshot(a)).network!.action?.seq;
        const waveAt = Date.now();
        await a.keyboard.press("Space");
        await expect
          .poll(
            async () => {
              const s = await snapshot(a),
                action = s.network!.action;
              return (
                !!action &&
                action.seq !== beforeWave &&
                s.network!.ack >= action.seq
              );
            },
            { intervals: [10, 20, 30], timeout: 10000 },
          )
          .toBe(true);
        confirmed.push(Date.now() - waveAt);
        const accepted = (await snapshot(a)).network!.action!;
        await expect
          .poll(
            async () => (await snapshot(b)).network!.remotes[0]?.action?.seq,
            { timeout: 10000 },
          )
          .toBe(accepted.seq);
        await expect
          .poll(async () => (await snapshot(b)).network!.remotes[0]?.facing, {
            timeout: 10000,
          })
          .toBe(i % 2 ? 4 : 0);
        await expect
          .poll(
            async () => {
              const self = await snapshot(a),
                other = await snapshot(b);
              return Math.hypot(
                other.network!.remotes[0].position.x -
                  self.network!.authoritative.x,
                other.network!.remotes[0].position.y -
                  self.network!.authoritative.y,
              );
            },
            { timeout: 10000 },
          )
          .toBeLessThan(0.15);
        for (const p of pages) {
          const s = await snapshot(p);
          expect(s.collision).toBe(false);
          snapshotAges.push(s.network!.snapshotAge);
        }
        await a.waitForTimeout(1100);
      }
      const statsAfter = JSON.parse(netem("stats"));
      phases.push({
        mode,
        rounds,
        elapsedMs: Date.now() - phaseStart,
        confirmedMs: confirmed,
        confirmedP95Ms: p95(confirmed),
        inputToObservedMovementMs: visible,
        movementP95Ms: p95(visible),
        snapshotAges,
        statsBefore,
        statsAfter,
      });
      writeFileSync(
        `${evidence}/progress.json`,
        JSON.stringify(phases, null, 2),
      );
      if (mode === "normal") {
        expect(statsAfter[0].drops - statsBefore[0].drops).toBeGreaterThan(0);
        expect(p95(confirmed)).toBeLessThan(500);
      }
    }
    netem("outage");
    await a.keyboard.down("w");
    await a.waitForTimeout(1500);
    const frozen = await snapshot(a);
    expect(frozen.network!.status).toContain("Reconnecting");
    await a.waitForTimeout(3600);
    expect((await snapshot(a)).state).toEqual(frozen.state);
    await a.keyboard.up("w");
    netem("normal");
    const recoveryAt = Date.now();
    await Promise.all(pages.map(ready));
    const recovered = await Promise.all(pages.map(snapshot));
    const recoveryMs = Date.now() - recoveryAt;
    for (let i = 0; i < 2; i++) {
      expect(recovered[i].network!.selfId).toBe(identities[i]);
      expect(recovered[i].network!.remotes).toHaveLength(1);
      expect(recovered[i].collision).toBe(false);
    }
    await a.screenshot({ path: `${evidence}/recovered.png` });
    const elapsedSeconds = (Date.now() - started) / 1000;
    const tcpAfter = readFileSync("/proc/net/snmp", "utf8");
    const rates = connections.map((c) => ({
      receivedBytesPerSecond: c.receivedBytes / elapsedSeconds,
      sentBytesPerSecond: c.sentBytes / elapsedSeconds,
    }));
    writeFileSync(
      `${evidence}/result.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          platform: process.platform,
          phases,
          recoveryMs,
          sameIdentities: true,
          connections,
          rates,
          tcpBefore,
          tcpAfter,
          errors,
        },
        null,
        2,
      ),
    );
    for (const rate of rates)
      expect(rate.receivedBytesPerSecond).toBeLessThan(50 * 1024);
    expect(recoveryMs).toBeLessThan(15000);
    expect(errors).toEqual([]);
  } finally {
    netem("clean");
    await Promise.all(contexts.map((c) => c.close()));
  }
});
