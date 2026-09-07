import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
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
test("M4 two players compete to feed, tame once, follow, stay, recall and resume", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const a = await browser.newContext(),
    b = await browser.newContext(),
    errors: string[] = [];
  try {
    for (const c of [a, b])
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = () =>
          Promise.reject(new DOMException("Windowed verification"));
        localStorage.setItem("meadow-combat-controls-seen-v1", "1");
      });
    const p = await a.newPage(),
      q = await b.newPage();
    for (const page of [p, q]) {
      page.setDefaultTimeout(12000);
      page.on("pageerror", (e) => errors.push(e.message));
    }
    await p.goto("/?debug=1");
    await enter(p, "Rowan");
    await p.keyboard.press("e");
    await expect
      .poll(async () => (await snap(p)).progress?.receipt?.result)
      .toBe("gathered");
    await p.getByRole("button", { name: "Open menu" }).click();
    const invite = await p.getByLabel("Invite a friend").inputValue();
    await p.getByRole("button", { name: "Keep exploring" }).click();
    await q.goto(`${invite}&debug=1`);
    await expect(
      q.getByText("You’re joining a friend’s Meadow. Choose a name and look.", {
        exact: true,
      }),
    ).toBeVisible();
    await q.getByRole("radio", { name: "Iris", exact: true }).check();
    await enter(q, "Iris");
    await walk(q, 63.5, 64.5);
    await q.keyboard.press("e");
    await expect
      .poll(async () => (await snap(q)).progress?.receipt?.result)
      .toBe("gathered");
    await walk(q, 62.5, 64.5);
    await walk(p, 62.5, 64.5);
    const id = (await snap(p)).moss[0].id;
    await expect(p.getByText(/Feed Sweet Berry/)).toBeVisible();
    await Promise.all([p.keyboard.press("e"), q.keyboard.press("e")]);
    await expect
      .poll(async () =>
        [
          (await snap(p)).companionReceipt?.result,
          (await snap(q)).companionReceipt?.result,
        ].sort(),
      )
      .toEqual(["claimed", "fed"]);
    const winner = (await snap(p)).companionReceipt!.result === "fed" ? p : q,
      loser = winner === p ? q : p;
    const winnerId = (await snap(winner)).network!.selfId;
    await winner.screenshot({
      path: "docs/milestones/evidence/m4-feeding.png",
    });
    await winner.waitForTimeout(1100);
    await winner.keyboard.press("e");
    await expect.poll(async () => (await snap(winner)).moss[0].feeds).toBe(2);
    await winner.waitForTimeout(1100);
    await Promise.all([winner.keyboard.press("e"), loser.keyboard.press("e")]);
    await expect
      .poll(async () => (await snap(loser)).moss[0].owner)
      .toBe(winnerId);
    const tamed = await snap(winner);
    expect(tamed.moss).toHaveLength(2);
    expect(tamed.moss[0].id).toBe(id);
    expect(
      tamed.progress!.inventory.some((s) => s?.item === "sweet-berry"),
    ).toBe(false);
    expect(
      (await snap(loser)).progress!.inventory.find(
        (s) => s?.item === "sweet-berry",
      )!.quantity,
    ).toBe(3);
    await expect(winner.getByLabel("Your companion")).toBeVisible();
    await walk(winner, 64.5, 64.5);
    await walk(winner, 64.5, 59.5);
    await expect
      .poll(
        async () => {
          const s = await snap(winner);
          return Math.hypot(
            s.moss[0].position.x - s.state.x,
            s.moss[0].position.y - s.state.y,
          );
        },
        { timeout: 8000 },
      )
      .toBeLessThan(3);
    await winner.screenshot({
      path: "docs/milestones/evidence/m4-following.png",
    });
    await winner.getByRole("button", { name: "Stay [C]", exact: true }).click();
    await expect
      .poll(async () => (await snap(winner)).moss[0].mode)
      .toBe("stay");
    const stayed = (await snap(winner)).moss[0].position;
    await walk(winner, 64.5, 64.5);
    await walk(winner, 80.5, 64.5);
    expect((await snap(winner)).moss[0].position).toEqual(stayed);
    await winner.keyboard.press("r");
    await expect
      .poll(
        async () => {
          const s = await snap(winner);
          return Math.hypot(
            s.moss[0].position.x - s.state.x,
            s.moss[0].position.y - s.state.y,
          );
        },
        { timeout: 5000 },
      )
      .toBeLessThan(3);
    const recalled = await snap(winner);
    await winner.screenshot({
      path: "docs/milestones/evidence/m4-recalled.png",
    });
    await winner.reload();
    await winner
      .getByRole("button", { name: "Resume Meadow", exact: true })
      .click();
    await winner.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
    );
    const resumed = await snap(winner);
    expect(resumed.moss.filter((m) => m.owner === winnerId)).toHaveLength(1);
    expect(resumed.moss[0].id).toBe(id);
    expect(resumed.progress!.inventory).toEqual(tamed.progress!.inventory);
    expect(errors).toEqual([]);
    writeFileSync(
      "docs/milestones/evidence/m4-browser.json",
      JSON.stringify(
        {
          browser: browser.version(),
          independentContexts: 2,
          claimRace: ["claimed", "fed"],
          tamed: tamed.moss[0],
          berriesConsumed: 3,
          loserBerries: 3,
          stayed,
          recalled: recalled.moss[0],
          resumed: resumed.moss[0],
          inventoryRetained: true,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await a.close();
    await b.close();
  }
});
