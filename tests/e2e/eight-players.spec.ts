import { visualPerformance } from "./visual-performance";
import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { soakEight } from "./soak-eight";

test("eight real players share movement, facing and waves; ninth is refused and a member resumes", async ({
  browser,
}) => {
  test.setTimeout(process.env.M1_EIGHT_SOAK ? 780000 : 180000);
  const access = process.env.HOSTED_ACCESS_FILE
    ? JSON.parse(readFileSync(process.env.HOSTED_ACCESS_FILE, "utf8"))
    : null;
  const extraHTTPHeaders: Record<string, string> = access
    ? {
        "x-vercel-protection-bypass": access.secret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {};
  const contexts: BrowserContext[] = [],
    pages: Page[] = [],
    errors: string[] = [];
  const evidence =
    process.env.EIGHT_EVIDENCE_PREFIX ??
    `docs/milestones/evidence/m1-eight-${access ? "hosted" : "local"}`;
  const snapshot = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
  const ready = (p: Page) =>
    p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
  const names = ["Rowan", "Mika", "Alex", "Jun", "Sage", "Robin", "Ash", "Sky"];
  const looks = ["Fern", "Ember", "Iris", "Hazel"];
  const createPage = async (index: number) => {
    const c = await browser.newContext({
      extraHTTPHeaders,
      viewport: { width: 1280, height: 800 },
    });
    contexts.push(c);
    await c.addInitScript(
      ({ alternate }) => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed test"));
        const Original = window.WebSocket;
        window.WebSocket = class extends Original {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(
              alternate
                ? String(url)
                    .replace(":3103/", ":3104/")
                    .replace("astraworld-game-a.", "astraworld-game-b.")
                : url,
              protocols,
            );
          }
        };
      },
      { alternate: index % 2 === 1 },
    );
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    pages.push(p);
    return p;
  };
  try {
    const host = await createPage(0);
    await host.goto("/?debug=1");
    await host.getByLabel("What should we call you?").fill(names[0]);
    await host
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await ready(host);
    await host.getByRole("button", { name: "Open menu" }).click();
    const invite = await host.getByLabel("Invite a friend").inputValue();
    await expect(host.getByText(/up to seven friends/)).toBeVisible();
    await host.getByRole("button", { name: "Keep exploring" }).click();
    // Each member has an isolated cookie/sessionStorage context and its own issued credential.
    for (let i = 1; i < 8; i++) {
      const p = await createPage(i);
      await p.goto(`${invite}&debug=1`);
      await expect(
        p.getByText(
          "You’re joining a friend’s Meadow. Choose a name and look.",
          { exact: true },
        ),
      ).toBeVisible();
      await p.getByLabel("What should we call you?").fill(names[i]);
      await p.getByRole("radio", { name: looks[i % looks.length] }).check();
      await p
        .getByRole("button", { name: "Enter Meadow", exact: true })
        .click();
      await ready(p);
    }
    for (const p of pages)
      await expect
        .poll(async () => (await snapshot(p)).network!.remotes.length, {
          timeout: 15000,
        })
        .toBe(7);
    await expect
      .poll(async () =>
        (await snapshot(host)).network!.remotes.every(
          (a) => a.visual !== undefined,
        ),
      )
      .toBe(true);
    const initial = await Promise.all(pages.map(snapshot));
    for (let i = 0; i < 8; i++) {
      expect(initial[i].character).toBe(looks[i % looks.length].toLowerCase());
      for (const remote of initial[i].network!.remotes) {
        const owner = initial.find((s) => s.network!.selfId === remote.id)!;
        expect(remote.character).toBe(owner.character);
        expect(remote.visual).toBeDefined();
      }
    }
    expect(new Set(initial.map((s) => s.network!.selfId)).size).toBe(8);
    expect(new Set(initial.map((s) => `${s.state.x},${s.state.y}`)).size).toBe(
      8,
    );
    for (const s of initial) {
      expect(s.collision).toBe(false);
      expect(
        new Set([s.username, ...s.network!.remotes.map((a) => a.name)]),
      ).toEqual(new Set(names));
    }
    for (const p of pages)
      await expect(p.getByLabel("8 players", { exact: true })).toHaveText(
        "8/8",
      );
    if (process.env.VISUAL_3D_PERF) {
      test.setTimeout(150000);
      await visualPerformance(pages);
      expect(errors).toEqual([]);
      return;
    }
    if (process.env.M1_EIGHT_SOAK) {
      await soakEight(pages);
      expect(errors).toEqual([]);
      return;
    }
    // Move every real client together, then confirm every observer agrees on all eight positions.
    await Promise.all(pages.map((p) => p.getByRole("application").focus()));
    await Promise.all(pages.map((p) => p.keyboard.down("d")));
    await host.waitForTimeout(650);
    await Promise.all(pages.map((p) => p.keyboard.up("d")));
    await host.waitForTimeout(1200);
    const moved = await Promise.all(pages.map(snapshot));
    for (let i = 0; i < 8; i++) {
      expect(moved[i].state.x - initial[i].state.x).toBeGreaterThan(1.5);
      expect(moved[i].collision).toBe(false);
    }
    for (const p of pages)
      await expect
        .poll(async () => {
          const s = await snapshot(p);
          return s.network!.remotes.every((remote) => {
            const owner = moved.find((m) => m.network!.selfId === remote.id)!;
            return (
              Math.hypot(
                remote.position.x - owner.state.x,
                remote.position.y - owner.state.y,
              ) < 0.2
            );
          });
        })
        .toBe(true);
    await Promise.all(pages.map((p) => p.mouse.move(100, 400)));
    await host.waitForTimeout(400);
    await Promise.all(pages.map((p) => p.keyboard.press("Space")));
    for (const p of pages)
      await expect
        .poll(async () => {
          const s = await snapshot(p);
          return (
            s.network!.facing === 4 &&
            s.visual.rotation === -Math.PI / 2 &&
            s.network!.remotes.every(
              (a) =>
                a.facing === 4 &&
                a.visual?.rotation === -Math.PI / 2 &&
                a.action?.kind === "wave",
            )
          );
        })
        .toBe(true);
    await host.screenshot({ path: `${evidence}.png` });
    const ninth = await createPage(8);
    await ninth.goto(`${invite}&debug=1`);
    await expect(
      ninth.getByText(
        "You’re joining a friend’s Meadow. Choose a name and look.",
        { exact: true },
      ),
    ).toBeVisible();
    await ninth.getByLabel("What should we call you?").fill("Ninth");
    await ninth
      .getByRole("button", { name: "Enter Meadow", exact: true })
      .click();
    await expect(ninth.locator("#name-error")).toContainText("8 adventurers");
    const before = await snapshot(pages[7]);
    await pages[7].reload();
    await pages[7]
      .getByRole("button", { name: "Resume Meadow", exact: true })
      .click();
    await ready(pages[7]);
    const resumeAtConnected = await snapshot(pages[7]);
    expect(
      Math.hypot(
        resumeAtConnected.network!.authoritative.x - before.state.x,
        resumeAtConnected.network!.authoritative.y - before.state.y,
      ),
    ).toBeLessThan(0.2);
    // Network readiness can arrive between rendering frames. Verify the accepted position first,
    // then wait for the renderer to display it instead of sampling its initial spawn frame.
    const renderWaitStarted = Date.now();
    await expect
      .poll(
        async () => {
          const s = await snapshot(pages[7]);
          return Math.max(
            Math.hypot(s.state.x - before.state.x, s.state.y - before.state.y),
            Math.hypot(
              s.rendered.x - before.state.x,
              s.rendered.y - before.state.y,
            ),
          );
        },
        { timeout: 3000 },
      )
      .toBeLessThan(0.2);
    const resumeRenderWaitMs = Date.now() - renderWaitStarted;
    const resumed = await snapshot(pages[7]);
    expect(resumed.network!.selfId).toBe(before.network!.selfId);
    expect(resumed.collision).toBe(false);
    expect(resumed.character).toBe("hazel");
    expect(
      Math.hypot(
        resumed.state.x - before.state.x,
        resumed.state.y - before.state.y,
      ),
    ).toBeLessThan(0.2);
    expect(resumed.network!.generation).toBeGreaterThan(
      before.network!.generation,
    );
    await expect
      .poll(async () => (await snapshot(host)).network!.remotes.length)
      .toBe(7);
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          members: 8,
          characters: looks,
          allAppearancesSynchronized: true,
          renderedFacingVerified: true,
          resumedHazel: true,
          independentContexts: 9,
          ninthRejected: true,
          resumedSameIdentity: true,
          resumeRenderWaitMs,
          resumeAtConnected: {
            state: resumeAtConnected.state,
            authoritative: resumeAtConnected.network!.authoritative,
          },
          gateways: [...new Set(initial.map((s) => s.network!.gateway))],
          movementTiles: moved.map((s, i) => s.state.x - initial[i].state.x),
          allObserversSawSevenPeers: true,
          allFacingAndWaveSynchronized: true,
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
