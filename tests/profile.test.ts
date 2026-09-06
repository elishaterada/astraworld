import { expect, it } from "vitest";
import { validateUsername } from "../app/profile";
it("normalizes a local display name while rejecting blank, long or markup names", () => {
  expect(validateUsername("  Mika   Rose  ")).toEqual({
    name: "Mika Rose",
    error: "",
  });
  expect(validateUsername("みか").error).toBe("");
  for (const name of [" ", "A", "a".repeat(21), "<img src=x>", "a\u0000b"])
    expect(validateUsername(name).error).not.toBe("");
});
