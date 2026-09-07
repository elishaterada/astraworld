import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const bin =
  process.env.ASTRAWORLD_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
const data = resolve(".local/postgres");
mkdirSync(".local", { recursive: true });
function run(name, args, quiet = false) {
  return execFileSync(join(bin, name), args, {
    encoding: "utf8",
    stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit",
  });
}
if (!existsSync(join(data, "PG_VERSION")))
  run("initdb", ["-D", data, "-A", "trust", "--no-locale", "-E", "UTF8"]);
try {
  run("pg_ctl", ["-D", data, "status"], true);
} catch {
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    resolve(".local/postgres.log"),
    "-o",
    "-h 127.0.0.1 -p 55432",
    "start",
  ]);
}
const found = run(
  "psql",
  [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-d",
    "postgres",
    "-Atc",
    "SELECT 1 FROM pg_database WHERE datname='astraworld'",
  ],
  true,
).trim();
if (found !== "1")
  run("createdb", ["-h", "127.0.0.1", "-p", "55432", "astraworld"]);
if (!existsSync(".env.development.local"))
  writeFileSync(
    ".env.development.local",
    "DATABASE_URL=postgresql://127.0.0.1:55432/astraworld\n",
    { mode: 0o600 },
  );
console.log("Local Postgres is ready. Apply migrations before playing.");
