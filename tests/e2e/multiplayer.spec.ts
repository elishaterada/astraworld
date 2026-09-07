import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
const snapshot = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function prepare(context: BrowserContext) {
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Windowed test", "NotAllowedError"));
  });
}
async function enter(p: Page, name: string, url = "/?debug=1") {
  await p.goto(url);
  await p.getByLabel("What should we call you?").fill(name);
  await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await p.waitForFunction(
    () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    null,
    { timeout: 15000 },
  );
  await p.getByRole("application").focus();
}
async function invite(p: Page) {
  await p.getByRole("button", { name: "Open menu" }).click();
  const link = await p.getByLabel("Invite a friend").inputValue();
  await p.getByRole("button", { name: "Keep exploring" }).click();
  return `${link}&debug=1`;
}
test("N0/N2 two independent browsers see movement and recover on the other gateway", async ({
  browser,
}) => {
  const ac = await browser.newContext(),
    bc = await browser.newContext(),
    cc = await browser.newContext();
  await Promise.all([prepare(ac), prepare(bc), prepare(cc)]);
  await ac.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        window.addEventListener(
          "meadow-test-disconnect",
          () => this.close(1000, "Test transport interruption"),
          { once: true },
        );
      }
    };
  });
  await bc.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(String(url).replace(":3103/", ":3104/"), protocols);
      }
    };
  });
  const a = await ac.newPage(),
    b = await bc.newPage(),
    third = await cc.newPage();
  const errors: string[] = [];
  const connectionsA: string[] = [],
    connectionsB: string[] = [];
  a.on("websocket", (socket) => connectionsA.push(socket.url()));
  b.on("websocket", (socket) => connectionsB.push(socket.url()));
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
  try {
    await enter(a, "Rowan");
    const link = await invite(a);
    await enter(b, "Mika", link);
    await a.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.remotes.length === 1,
      null,
      { timeout: 15000 },
    );
    expect(connectionsA[0]).toContain(":3103/");
    expect(connectionsB[0]).toContain(":3104/");
    const initial = await snapshot(a);
    expect((await snapshot(b)).network!.selfId).not.toBe(
      initial.network!.selfId,
    );
    await a.getByRole("application").focus();
    await a.keyboard.down("d");
    await a.waitForTimeout(700);
    await a.keyboard.up("d");
    await a.waitForTimeout(500);
    const moved = await snapshot(a),
      observed = (await snapshot(b)).network!.remotes[0];
    expect(moved.state.x - initial.state.x).toBeGreaterThan(1.8);
    expect(Math.abs(observed.position.x - moved.state.x)).toBeLessThan(0.25);
    expect(moved.collision).toBe(false);
    await third.goto(link);
    await third.getByLabel("What should we call you?").fill("Third");
    await third
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await expect(third.locator("#name-error")).toContainText("two adventurers");
    const oldGeneration = moved.network!.generation;
    await ac.setOffline(true);
    await a.waitForTimeout(1500);
    expect((await snapshot(a)).network!.status).toContain("Reconnecting");
    await ac.setOffline(false);
    // A short offline pause can recover on the same TCP connection. Explicitly
    // close this test-owned transport to exercise a new generation and gateway.
    await a.evaluate(() =>
      window.dispatchEvent(new Event("meadow-test-disconnect")),
    );
    await a.waitForFunction(
      (g) => (window.__MEADOW__?.snapshot().network?.generation ?? 0) > g,
      oldGeneration,
      { timeout: 15000 },
    );
    await a.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect(connectionsA.some((url) => url.includes(":3104/"))).toBe(true);
    const resumed = await snapshot(a);
    expect(resumed.network!.selfId).toBe(initial.network!.selfId);
    expect(resumed.network!.remotes).toHaveLength(1);
    await expect(a.locator(".multiplayer-note")).toContainText("Connected");
    await a.screenshot({
      path: "docs/milestones/evidence/m1-v2-two-player.png",
    });
    writeFileSync(
      "docs/milestones/evidence/m1-v2-browser.json",
      JSON.stringify(
        {
          browser: browser.version(),
          viewport: a.viewportSize(),
          connectionsA,
          connectionsB,
          initial: initial.network,
          moved: moved.network,
          resumed: resumed.network,
          errors,
        },
        null,
        2,
      ),
    );
    expect(errors).toEqual([]);
  } finally {
    await Promise.all([ac.close(), bc.close(), cc.close()]);
  }
});
for (const nominalRtt of [150, 300])
  test(`N4 ${nominalRtt}ms RTT, lost full snapshots, invalid delta, old epoch and five-second outage`, async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await prepare(context);
    const page = await context.newPage();
    let outbound = 0,
      inbound = 0,
      resyncs = 0,
      dropped = 0,
      outage = false,
      last: any;
    let clientRoute: any;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, delay: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, delay);
      timers.add(t);
    };
    await context.routeWebSocket(/\/play$/, (route) => {
      clientRoute = route;
      const server = route.connectToServer();
      // Real server traffic, deterministic configured RTT and +/-30ms RTT jitter.
      route.onMessage((raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "resync") resyncs++;
        if (outage) return;
        const n = ++outbound;
        if (msg.type === "frames" && n % 100 === 0) {
          dropped++;
          return;
        }
        later(() => server.send(raw), nominalRtt / 2 + ((n % 3) - 1) * 15);
      });
      server.onMessage((raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "snapshot") last = msg;
        if (outage) return;
        const n = ++inbound;
        if (msg.type === "snapshot" && n % 100 === 0) {
          dropped++;
          return;
        }
        later(() => route.send(raw), nominalRtt / 2 + ((n % 3) - 1) * 15);
      });
    });
    try {
      await enter(page, "Wanderer");
      const initial = await snapshot(page);
      await page.keyboard.down("d");
      await page.waitForTimeout(65);
      const predicted = await snapshot(page);
      await page.keyboard.up("d");
      expect(predicted.state.x).toBeGreaterThan(initial.state.x); // Prediction precedes round-trip acknowledgement.
      await page.waitForTimeout(12000);
      expect(dropped).toBeGreaterThan(0);
      clientRoute.send(
        JSON.stringify({ ...last, full: false, baseTick: 999999 }),
      );
      // Protocol 2 ignores invalid deltas and awaits the next periodic full projection.
      await page.waitForTimeout(300);
      expect((await snapshot(page)).state.x).toBeGreaterThan(60);
      const epoch = (await snapshot(page)).network!.epoch;
      clientRoute.send(
        JSON.stringify({
          ...last,
          epoch: epoch - 1,
          tick: 999999,
          actors: last.actors.map((a: any) => ({
            ...a,
            position: { x: 10, y: 10 },
          })),
        }),
      );
      await page.waitForTimeout(100);
      expect((await snapshot(page)).state.x).toBeGreaterThan(60);
      outage = true;
      await page.waitForTimeout(5000);
      expect((await snapshot(page)).network!.status).toContain("Reconnecting");
      outage = false;
      await page.waitForFunction(
        () => window.__MEADOW__?.snapshot().network?.status === "Connected",
      );
      const recovered = await snapshot(page);
      expect(recovered.collision).toBe(false);
      expect(recovered.network!.selfId).toBe(initial.network!.selfId);
      writeFileSync(
        `docs/milestones/evidence/m1-v2-degraded${nominalRtt === 150 ? "" : "-300"}.json`,
        JSON.stringify(
          {
            browser: browser.version(),
            nominalRttMs: nominalRtt,
            jitterRttMs: 30,
            loss: "1% application messages, not IP packets",
            outbound,
            inbound,
            dropped,
            resyncs,
            initial: initial.network,
            recovered: recovered.network,
          },
          null,
          2,
        ),
      );
    } finally {
      for (const timer of timers) clearTimeout(timer);
      await context.close();
    }
  });
