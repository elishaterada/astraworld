import { expect, it } from "vitest";
import { issueSession, sameOrigin } from "../apps/game-server/vercel";
it("checks hosted origin before issuing a credential", async () => {
  const request = new Request("https://game.example/api/meadow/session", {
    method: "POST",
    headers: { origin: "https://evil.example" },
    body: "{}",
  });
  expect(sameOrigin(request)).toBe(false);
  expect((await issueSession(request)).status).toBe(403);
});
it("bounds hosted session bodies and rejects extra authority fields", async () => {
  const request = (body: string) =>
    new Request("https://game.example/api/meadow/session", {
      method: "POST",
      headers: { origin: "https://game.example" },
      body,
    });
  expect((await issueSession(request(" ".repeat(8193)))).status).toBe(413);
  expect(
    (
      await issueSession(
        request(JSON.stringify({ name: "Rowan", playerId: "forged" })),
      )
    ).status,
  ).toBe(400);
});
