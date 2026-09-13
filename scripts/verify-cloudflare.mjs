import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = process.env.BASE_URL;
assert(base, "BASE_URL is required");
const checks = [];
const get = async (path, init) => {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    ...init,
  });
  checks.push({ path, status: response.status });
  return response;
};
const home = await get("/?invite=preserve-query&debug=1");
assert.equal(home.status, 200);
const html = await home.text();
assert.match(html, /Astraworld — The Meadow/);
assert.match(html, /What should we call you/);
assert.match(html, /https:\/\/astraworld.elishaterada.com\//);
for (const path of ["/not-a-real-page", "/missing.png", "/api/missing"]) {
  assert.equal((await get(path)).status, 404);
}
for (const version of ["meadow", "meadow-v2"]) {
  assert.equal((await get(`/api/${version}/health`)).status, 200);
  assert.equal(
    (
      await get(`/api/${version}/session`, {
        method: "POST",
        headers: {
          Origin: "https://untrusted.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Invalid" }),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await get(`/api/${version}/session`, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await get(`/api/${version}/session`, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: "x".repeat(9000),
      })
    ).status,
    413,
  );
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
for (const directory of ["art", "assets"]) {
  for (const file of await readdir(`dist/${directory}`)) {
    const path = `/${directory}/${file}`;
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.equal(
      hash(Buffer.from(await response.arrayBuffer())),
      hash(await readFile(`dist${path}`)),
    );
  }
}
const report = {
  base,
  checkedAt: new Date().toISOString(),
  result: "pass",
  checks,
};
if (process.env.EVIDENCE_FILE)
  await writeFile(
    process.env.EVIDENCE_FILE,
    JSON.stringify(report, null, 2) + "\n",
  );
console.log(
  `${checks.length} HTTP, metadata, authority and byte-for-byte asset checks passed for ${base}`,
);
