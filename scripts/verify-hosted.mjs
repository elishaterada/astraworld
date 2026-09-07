import { chromium } from "@playwright/test";
import fs from "node:fs";
import assert from "node:assert/strict";
const url = process.env.HOSTED_URL ?? "https://astraworld-teradas.vercel.app";
const access = process.env.HOSTED_ACCESS_FILE
  ? JSON.parse(fs.readFileSync(process.env.HOSTED_ACCESS_FILE, "utf8"))
  : null;
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=metal"],
});
const contexts = [],
  errors = [],
  samples = [],
  socketCloses = [0, 0];
const file =
  process.env.HOSTED_EVIDENCE ??
  "docs/milestones/evidence/m1-hosted-final.json";
let failure = null;
try {
  for (let i = 0; i < 2; i++) {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: access
        ? {
            "x-vercel-protection-bypass": access.secret,
            "x-vercel-set-bypass-cookie": "true",
          }
        : {},
    });
    contexts.push(c);
    await c.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(
          new DOMException("Windowed verification", "NotAllowedError"),
        );
    });
  }
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const [a, b] = pages;
  for (const [i, p] of pages.entries()) {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("websocket", (s) => s.on("close", () => socketCloses[i]++));
  }
  const ready = async (p, name) => {
    await p.getByLabel("What should we call you?").fill(name);
    await p.getByRole("button", { name: "Enter Meadow", exact: true }).click();
    await p.waitForFunction(
      () => window.__MEADOW__?.snapshot().network?.status === "Connected",
      null,
      { timeout: 45000 },
    );
  };
  const state = (p) =>
    p.evaluate(() => {
      const s = window.__MEADOW__.snapshot();
      return { state: s.state, collision: s.collision, network: s.network };
    });
  await a.goto(`${url}/?debug=1`);
  await ready(a, "Rowan");
  await a.getByRole("button", { name: "Open menu" }).click();
  const invite = await a.getByLabel("Invite a friend").inputValue();
  await a.getByRole("button", { name: "Keep exploring" }).click();
  await b.goto(`${invite}&debug=1`);
  await ready(b, "Mika");
  await a.waitForFunction(
    () => window.__MEADOW__?.snapshot().network?.remotes.length === 1,
  );
  const initial = await state(a);
  await a.getByRole("application").focus();
  await a.keyboard.down("d");
  await a.waitForTimeout(1000);
  await a.keyboard.up("d");
  await a.waitForTimeout(400);
  const moved = await state(a);
  const distance =
    moved.network.authoritative.x - initial.network.authoritative.x;
  assert(
    distance > 3.2 && distance < 4.9,
    `Unexpected movement distance ${distance}`,
  );
  console.log("Two hosted players connected; server movement verified.");
  const started = Date.now(),
    duration = Number(process.env.HOSTED_SECONDS ?? 150);
  for (let i = 0; i < duration; i++) {
    if (i === 45 && process.env.HOSTED_OVERLAP === "1") {
      await b.reload();
      await ready(b, "Mika");
      console.log("Second player reloaded through the current deployment.");
    }
    const pair = await Promise.all(pages.map(state));
    samples.push({ elapsedMs: Date.now() - started, players: pair });
    if (i % 30 === 0)
      console.log(
        JSON.stringify({
          seconds: i,
          status: pair.map((s) => s.network.status),
          epoch: pair.map((s) => s.network.epoch),
          gateway: pair.map((s) => s.network.gateway),
        }),
      );
    await a.waitForTimeout(1000);
  }
  const epochs = new Set(
      samples.flatMap((s) => s.players.map((p) => p.network.epoch)),
    ),
    gateways = new Set(
      samples.flatMap((s) => s.players.map((p) => p.network.gateway)),
    );
  let maxGapMs = 0;
  for (let player = 0; player < 2; player++) {
    let gap = null,
      lastEpoch = 0;
    const id = samples[0].players[player].network.selfId;
    for (const s of samples) {
      const p = s.players[player];
      assert.equal(p.collision, false);
      assert.equal(p.network.selfId, id);
      assert(p.network.epoch >= lastEpoch);
      lastEpoch = p.network.epoch;
      if (p.network.status !== "Connected" || p.network.remotes.length !== 1) {
        gap ??= s.elapsedMs;
      } else if (gap !== null) {
        maxGapMs = Math.max(maxGapMs, s.elapsedMs - gap);
        gap = null;
      }
    }
    assert.equal(gap, null, "Player did not recover before test ended");
  }
  for (const s of samples)
    if (s.players[0].network.epoch === s.players[1].network.epoch)
      assert.equal(s.players[0].network.owner, s.players[1].network.owner);
  assert(maxGapMs < 15000, `Recovery gap ${maxGapMs}ms`);
  assert(epochs.size >= 3);
  assert.equal(errors.length, 0);
  if (process.env.HOSTED_OVERLAP === "1")
    assert(
      new Set([...gateways].map((g) => g.split("-")[0])).size >= 2,
      "Did not observe different deployment gateways",
    );
  await a.screenshot({ path: "docs/milestones/evidence/m1-hosted-final.png" });
  console.log(
    JSON.stringify({
      maxGapMs,
      epochs: [...epochs],
      gateways: [...gateways],
      socketCloses,
      distance,
      errors,
    }),
  );
} catch (error) {
  failure = error.message;
  console.error(failure);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        url,
        browser: browser.version(),
        samples,
        socketCloses,
        errors,
        failure,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
