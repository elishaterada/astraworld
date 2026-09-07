import pg from "pg";
import { createHash } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
const sourceUrl = process.env.SOURCE_DATABASE_URL,
  targetUrl = process.env.TARGET_DATABASE_URL;
if (
  !sourceUrl ||
  !targetUrl ||
  sourceUrl === targetUrl ||
  new URL(targetUrl).hostname !== "127.0.0.1"
)
  throw Error("Use a distinct disposable loopback target database");
const source = new pg.Client({ connectionString: sourceUrl }),
  target = new pg.Client({ connectionString: targetUrl });
const tables = ["worlds", "members", "commands", "outbox"],
  backupPath = "/tmp/astraworld-m6-restore-private.json";
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? v instanceof Date
        ? v.toISOString()
        : Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
      : v;
const checksum = (v) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
try {
  await source.connect();
  await target.connect();
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const backup = {};
  for (const table of tables)
    backup[table] = (
      await source.query(
        `SELECT * FROM astraworld.${table} WHERE namespace LIKE 'test:%' ORDER BY to_jsonb(${table})::text`,
      )
    ).rows;
  await source.query("COMMIT");
  await writeFile(backupPath, JSON.stringify(backup), { mode: 0o600 });
  const restored = JSON.parse(await readFile(backupPath, "utf8"));
  await target.query("BEGIN");
  await target.query(
    await readFile(
      new URL("../migrations/001_durable_worlds.sql", import.meta.url),
      "utf8",
    ),
  );
  if (
    Number(
      (await target.query("SELECT count(*) FROM astraworld.worlds")).rows[0]
        .count,
    ) !== 0
  )
    throw Error("Restore target must be empty");
  for (const table of tables)
    for (const row of restored[table]) {
      const keys = Object.keys(row);
      if (keys.some((k) => !/^[a-z_]+$/.test(k)))
        throw Error("Unexpected column");
      await target.query(
        `INSERT INTO astraworld.${table} (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
        keys.map((k) => row[k]),
      );
    }
  await target.query("COMMIT");
  const evidence = {
    result: "pass",
    source: "Neon",
    target: "isolated local Postgres",
    tables: {},
  };
  for (const table of tables) {
    const rows = (
      await target.query(
        `SELECT * FROM astraworld.${table} ORDER BY to_jsonb(${table})::text`,
      )
    ).rows;
    if (checksum(rows) !== checksum(backup[table]))
      throw Error(`Restore mismatch: ${table}`);
    evidence.tables[table] = { rows: rows.length, sha256: checksum(rows) };
  }
  await writeFile(
    "docs/milestones/evidence/m6-neon-restore.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
} finally {
  await source.end();
  await target.end();
  await unlink(backupPath).catch(() => {});
}
