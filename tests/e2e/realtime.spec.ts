import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

for (const latency of [0, 150])
  test(`immediate movement, facing, wave and bounded sync (${latency * 2} ms added RTT)`, async ({
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
    const contexts = await Promise.all([
      browser.newContext({ extraHTTPHeaders }),
      browser.newContext({ extraHTTPHeaders }),
    ]);
    const errors: string[] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let droppedWave = false;
    let outage = false;
    const defer = (f: () => void) => {
      const t = setTimeout(() => {
        timers.delete(t);
        try {
          f();
        } catch {}
      }, latency);
      timers.add(t);
    };
    try {
      for (let i = 0; i < 2; i++) {
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
                window.addEventListener("meadow-test-disconnect", () =>
                  this.close(),
                );
              }
            };
          },
          { second: i === 1 },
        );
        await contexts[i].routeWebSocket(/\/play$/, (route) => {
          const server = route.connectToServer();
          route.onMessage((message) => {
            if (outage) return;
            // Lose one complete application message; retries must preserve its discrete wave.
            if (
              latency &&
              !droppedWave &&
              String(message).includes('"wave":true')
            ) {
              droppedWave = true;
              return;
            }
            defer(() => server.send(message));
          });
          server.onMessage((message) => {
            if (!outage) defer(() => route.send(message));
          });
        });
      }
      const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
      for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
      const snapshot = (p: typeof a) =>
        p.evaluate(() => window.__MEADOW__!.snapshot());
      const ready = (p: typeof a) =>
        p.waitForFunction(
          () => window.__MEADOW__?.snapshot().network?.status === "Connected",
        );
      await a.goto("/?debug=1");
      await a.getByLabel("What should we call you?").fill("Rowan");
      await a.getByRole("radio", { name: "Ember" }).check();
      await a
        .getByRole("button", { name: "Enter Meadow", exact: true })
        .click();
      await ready(a);
      await a.getByRole("button", { name: "Open menu" }).click();
      const invite = await a.getByLabel("Invite a friend").inputValue();
      await a.getByRole("button", { name: "Keep exploring" }).click();
      await b.goto(`${invite}&debug=1`);
      await b.getByLabel("What should we call you?").fill("Mika");
      await b.getByRole("radio", { name: "Iris" }).check();
      await b
        .getByRole("button", { name: "Enter Meadow", exact: true })
        .click();
      await ready(b);
      await expect
        .poll(async () => (await snapshot(b)).network?.remotes.length)
        .toBe(1);
      await a.getByRole("application").focus();
      await a.waitForTimeout(600);
      const initial = await snapshot(a),
        sent = initial.network!.sent;
      await a.keyboard.down("d");
      await a.waitForTimeout(60);
      const immediate = await snapshot(a);
      expect(immediate.state.x - initial.state.x).toBeGreaterThan(0.1);
      if (latency)
        expect(
          Math.abs(
            immediate.network!.authoritative.x -
              initial.network!.authoritative.x,
          ),
        ).toBeLessThan(0.1);
      await a.waitForTimeout(440);
      await a.keyboard.up("d");
      await a.waitForTimeout(800);
      const stopped = await snapshot(a);
      expect(stopped.state.x - initial.state.x).toBeGreaterThan(1.5);
      expect(stopped.collision).toBe(false);
      await expect
        .poll(async () =>
          Math.abs(
            (await snapshot(b)).network!.remotes[0].position.x -
              stopped.state.x,
          ),
        )
        .toBeLessThan(0.15);
      await a.mouse.move(100, initial.height / 2);
      await a.waitForTimeout(50);
      expect((await snapshot(a)).network!.facing).toBe(4);
      await expect
        .poll(async () => (await snapshot(b)).network?.remotes[0]?.facing)
        .toBe(4);
      expect((await snapshot(a)).state).toEqual(stopped.state);
      await a.keyboard.press("Space");
      await a.waitForTimeout(40);
      expect((await snapshot(a)).network!.action?.kind).toBe("wave");
      await expect
        .poll(async () => (await snapshot(b)).network?.remotes[0]?.action?.kind)
        .toBe("wave");
      const waved = await snapshot(b);
      if (latency) expect(droppedWave).toBe(true);
      await b.screenshot({
        path: `docs/milestones/evidence/m1-v2-${access ? "hosted" : "local"}-${latency}-wave.png`,
      });
      await a.waitForTimeout(1000);
      expect((await snapshot(b)).network!.remotes[0].moving).toBe(false);
      const beforeReconnect = await snapshot(a);
      await a.evaluate(() =>
        window.dispatchEvent(new Event("meadow-test-disconnect")),
      );
      await expect
        .poll(async () => (await snapshot(a)).network!.generation, {
          timeout: 10000,
        })
        .toBeGreaterThan(beforeReconnect.network!.generation);
      await ready(a);
      expect((await snapshot(a)).network!.selfId).toBe(initial.network!.selfId);
      expect(
        Math.abs((await snapshot(a)).state.x - stopped.state.x),
      ).toBeLessThan(0.15);
      if (!latency) {
        outage = true;
        await a.keyboard.down("w");
        await a.waitForTimeout(1400);
        const frozen = await snapshot(a);
        expect(frozen.state.y - stopped.state.y).toBeGreaterThan(-3.3);
        expect(frozen.network!.status).toContain("Reconnecting");
        await a.waitForTimeout(3700);
        expect((await snapshot(a)).state).toEqual(frozen.state);
        await a.keyboard.up("w");
        outage = false;
        await ready(a);
        expect((await snapshot(a)).collision).toBe(false);
      }
      const final = await snapshot(a);
      expect(final.network!.sent - sent).toBeLessThan(240);
      expect(errors).toEqual([]);
      writeFileSync(
        `docs/milestones/evidence/m1-v2-${access ? "hosted" : "local"}-${latency}.json`,
        JSON.stringify(
          {
            browser: browser.version(),
            addedRoundTripMs: latency * 2,
            applicationMessageDropped: droppedWave,
            fiveSecondApplicationOutage: !latency,
            immediateMovementTiles: immediate.state.x - initial.state.x,
            movementTiles: stopped.state.x - initial.state.x,
            gateways: [initial.network!.gateway, waved.network!.gateway],
            remoteFacing: waved.network!.remotes[0].facing,
            remoteAction: waved.network!.remotes[0].action,
            reconnectedGeneration: final.network!.generation,
            messagesSent: final.network!.sent - sent,
            errors,
          },
          null,
          2,
        ),
      );
    } finally {
      for (const t of timers) clearTimeout(t);
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
