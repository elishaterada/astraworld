import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const snap = (p: Page) => p.evaluate(() => window.__MEADOW__!.snapshot());
async function enter(p: Page, name: string) {
  await p.getByLabel("What should we call you?").fill(name);
  await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
  await p.waitForFunction(
    () => window.__MEADOW__?.snapshot().network?.status === "Connected",
  );
}
async function walk(p: Page, x: number, y: number) {
  await p.getByRole("application").focus();
  for (const axis of ["x", "y"] as const) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const s = await snap(p),
        delta = (axis === "x" ? x : y) - s.state[axis];
      if (Math.abs(delta) < 0.13) break;
      const key =
        axis === "x" ? (delta > 0 ? "d" : "a") : delta > 0 ? "s" : "w";
      await p.keyboard.down(key);
      await p.waitForTimeout(Math.min(1200, (Math.abs(delta) / 4) * 1000));
      await p.keyboard.up(key);
      await p.waitForTimeout(220);
    }
  }
}
test("M5 fresh pair completes gathering, combat, taming, interrupted dissolution and shared Forest entry", async ({
  browser,
}) => {
  test.setTimeout(150000);
  const access = process.env.HOSTED_ACCESS_FILE
    ? JSON.parse(readFileSync(process.env.HOSTED_ACCESS_FILE, "utf8"))
    : null;
  const extraHTTPHeaders: Record<string, string> = access
    ? {
        "x-vercel-protection-bypass": access.secret,
        "x-vercel-set-bypass-cookie": "true",
      }
    : {};
  const evidence =
    process.env.SLICE_EVIDENCE_PREFIX ?? "docs/milestones/evidence/m5";
  const a = await browser.newContext({ extraHTTPHeaders }),
    b = await browser.newContext({ extraHTTPHeaders });
  const errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed verification"));
        localStorage.setItem("meadow-combat-controls-seen-v1", "1");
      });
    // Real sockets, with 75 ms application delay each direction on the second browser.
    await b.addInitScript(() => {
      const Native = window.WebSocket;
      class Delayed extends Native {
        override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
          setTimeout(() => {
            if (this.readyState === Native.OPEN) super.send(data);
          }, 75);
        }
        override set onmessage(
          handler: ((this: WebSocket, ev: MessageEvent) => unknown) | null,
        ) {
          super.onmessage = handler
            ? (event) => {
                setTimeout(() => handler.call(this, event), 75);
              }
            : null;
        }
        override get onmessage() {
          return super.onmessage;
        }
      }
      window.WebSocket = Delayed;
    });
    const p = await a.newPage(),
      q = await b.newPage();
    p.setDefaultTimeout(10000);
    q.setDefaultTimeout(10000);
    for (const page of [p, q])
      page.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/?debug=1");
    await enter(p, "Rowan");
    await p.keyboard.press("e");
    await expect
      .poll(async () => (await snap(p)).progress?.receipt?.result)
      .toBe("gathered");
    const inventory = (await snap(p)).progress!.inventory;
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await expect(
      q.getByText("You’re joining a friend’s Meadow. Choose a name and look.", {
        exact: true,
      }),
    ).toBeVisible();
    await q
      .locator("label")
      .filter({ has: q.getByRole("radio", { name: "Iris", exact: true }) })
      .click();
    await enter(q, "Iris");
    await walk(q, 64.5, 54);
    await walk(p, 64.5, 54);
    await expect
      .poll(async () => (await snap(p)).slime?.phase, {
        timeout: 8000,
        intervals: [30],
      })
      .toBe("tell");
    await q.waitForFunction(() => {
      const s = window.__MEADOW__!.snapshot();
      return (
        s.slime?.phase === "tell" && s.network!.tick - s.slime.phaseTick < 18
      );
    });
    const tell = await snap(q);
    expect(tell.slime!.phase).toBe("tell");
    await q.screenshot({ path: `${evidence}-telegraph.png` });
    await expect
      .poll(async () => (await snap(p)).combat?.health, { timeout: 6000 })
      .toBeLessThan(100);
    await expect
      .poll(async () => (await snap(q)).network!.remotes[0].combat?.health)
      .toBe((await snap(p)).combat!.health);
    // Dodge from a real warning; remote rendering must show that action too.
    await expect
      .poll(async () => (await snap(p)).slime?.phase, {
        timeout: 5000,
        intervals: [20],
      })
      .toBe("tell");
    await p.getByRole("application").focus();
    await p.keyboard.down("s");
    await p.keyboard.press("Shift");
    await p.waitForTimeout(100);
    await p.keyboard.up("s");
    await expect
      .poll(async () => (await snap(q)).network!.remotes[0].action?.kind)
      .toBe("dodge");
    const dodge = await snap(p);
    expect(dodge.combat!.dodgeReady).toBeGreaterThan(0);
    // Return to the marked circle and let the enemy finish its complete health/death loop.
    await walk(p, 64.5, 54);
    await expect
      .poll(async () => (await snap(p)).combat?.health, {
        timeout: 22000,
        intervals: [70],
      })
      .toBe(0);
    const death = await snap(p);
    await p.screenshot({ path: `${evidence}-recovery.png` });
    await expect
      .poll(async () => (await snap(p)).combat?.health, { timeout: 5000 })
      .toBe(100);
    const respawn = await snap(p);
    expect(respawn.state.y).toBeCloseTo(64.5, 0);
    expect(respawn.progress!.inventory).toEqual(inventory);
    // Approach again and use only input to aim and swing. No state mutation hooks.
    await walk(p, 64.5, 54);
    let capturedBlade = false;
    for (let i = 0; i < 7 && (await snap(p)).slime!.health > 0; i++) {
      const s = await snap(p),
        slime = s.slime!;
      if (
        Math.hypot(slime.position.x - s.state.x, slime.position.y - s.state.y) >
        1.6
      ) {
        await p.waitForTimeout(600);
        continue;
      }
      await p.mouse.move(
        s.actorScreen.x + (slime.position.x - s.state.x) * 48,
        s.actorScreen.y + (slime.position.y - s.state.y) * 34,
      );
      await p.keyboard.press("j");
      await p.waitForFunction(
        () => window.__MEADOW__!.snapshot().visual.attacking,
      );
      if (!capturedBlade) await p.screenshot({ path: `${evidence}-blade.png` });
      capturedBlade = true;
      await p.waitForTimeout(530);
    }
    await expect.poll(async () => (await snap(p)).slime?.health).toBe(0);
    await expect.poll(async () => (await snap(q)).slime?.health).toBe(0);
    const defeated = await snap(p);
    await p.screenshot({ path: `${evidence}-defeated.png` });
    await p.reload();
    await p.getByRole("button", { name: "Resume Meadow" }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect((await snap(p)).slime!.deathTick).toBe(defeated.slime!.deathTick);
    expect((await snap(p)).progress!.inventory).toEqual(inventory);
    await walk(p, 64.5, 58.5);
    await walk(p, 62.5, 58.5);
    await p.keyboard.press("e");
    await expect
      .poll(async () =>
        (await snap(p)).progress!.inventory.some((s) => s?.item === "wood"),
      )
      .toBe(true);
    await walk(p, 64.5, 64.5);
    await walk(p, 62.5, 64.5);
    for (let i = 1; i <= 3; i++) {
      await p.keyboard.press("e");
      await expect.poll(async () => (await snap(p)).moss[0].feeds).toBe(i);
      await p.waitForTimeout(1100);
    }
    const moss = (await snap(p)).moss[0];
    await walk(p, 64.5, 64.5);
    await walk(p, 64.5, 39.5);
    await walk(q, 64.5, 39.5);
    await p.getByRole("application").focus();
    await p.keyboard.down("w");
    await p.waitForTimeout(600);
    await p.keyboard.up("w");
    expect((await snap(p)).state.y).toBeGreaterThanOrEqual(39.23);
    expect((await snap(p)).gate!.open).toBe(false);
    await p.screenshot({ path: `${evidence}-vines.png` });
    await q.getByRole("application").focus();
    await q.keyboard.press("q");
    await expect
      .poll(async () => (await snap(q)).companionReceipt?.result)
      .toBe("forbidden");
    await p.getByRole("application").focus();
    await p.keyboard.press("q");
    await expect
      .poll(async () => (await snap(p)).gate?.channel !== null, {
        intervals: [20],
      })
      .toBe(true);
    await p.screenshot({ path: `${evidence}-channel.png` });
    await p.reload();
    await expect.poll(async () => (await snap(q)).gate?.channel).toBeNull();
    expect((await snap(q)).gate!.open).toBe(false);
    await p.getByRole("button", { name: "Resume Meadow" }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    await p.waitForTimeout(2100);
    await p.keyboard.press("q");
    await expect.poll(async () => (await snap(q)).gate?.open).toBe(true);
    const opened = (await snap(q)).gate!;
    await walk(p, 64.5, 34.5);
    await walk(q, 64.5, 34.5);
    await expect(
      p.getByText("A path made together.", { exact: true }),
    ).toBeVisible();
    await expect(
      q.getByText("A path made together.", { exact: true }),
    ).toBeVisible();
    expect((await snap(p)).collision).toBe(false);
    expect((await snap(q)).collision).toBe(false);
    await p.screenshot({ path: `${evidence}-forest.png` });
    await p.keyboard.press("r");
    await q.reload();
    await q.getByRole("button", { name: "Resume Meadow" }).click();
    await q.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    expect((await snap(q)).gate?.openedTick).toBe(opened.openedTick);
    expect((await snap(q)).moss.find((m) => m.id === moss.id)?.owner).toBe(
      moss.owner,
    );
    expect(errors).toEqual([]);
    writeFileSync(
      `${evidence}-browser.json`,
      JSON.stringify(
        {
          browser: browser.version(),
          independentContexts: 2,
          gate: opened,
          disconnectedChannelCancelled: true,
          bothTraversed: true,
          companion: moss.id,
          addedRttMs: 150,
          delayLayer: "application WebSocket callbacks/send (not TCP loss)",
          tell: { phase: tell.slime?.phase, health: tell.combat?.health },
          dodge: dodge.combat,
          death: death.combat,
          respawn: respawn.combat,
          defeated: defeated.slime,
          inventoryRetained: true,
          reload: true,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await a.close().catch(() => {});
    await b.close().catch(() => {});
  }
});
