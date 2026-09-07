import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import { existsSync } from "node:fs";
if (existsSync(".env.development.local"))
  process.loadEnvFile(".env.development.local");

// Restart only this repository's existing local database, never a remote service.
if (
  process.env.DATABASE_URL === "postgresql://127.0.0.1:55432/astraworld" &&
  existsSync(".local/postgres/PG_VERSION")
)
  execFileSync(process.execPath, ["scripts/db-local.mjs"], {
    stdio: "inherit",
  });

// Portless owns public URLs and ephemeral ports; the launcher owns only its children.
execFileSync("portless", ["proxy", "start"], { stdio: "inherit" });
const urlFor = (name) =>
  execFileSync("portless", ["get", name], { encoding: "utf8" }).trim();
const web = urlFor("astraworld"),
  a = urlFor("astraworld-game-a"),
  b = urlFor("astraworld-game-b");
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop());
function launch(command, args, overrides = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...overrides },
  });
  children.add(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    children.delete(child);
    if (!stopping) stop(code || 1);
  });
  return child;
}
function listening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(500, () => done(false));
  });
}
if (!process.env.REDIS_URL && !(await listening(6380))) {
  launch("redis-server", [
    "--bind",
    "127.0.0.1",
    "--port",
    "6380",
    "--save",
    "",
    "--appendonly",
    "no",
  ]);
  let ready = false;
  for (let i = 0; i < 50 && !stopping; i++) {
    if (await listening(6380)) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) {
    console.error("Local Redis did not start.");
    stop(1);
  }
}
if (!stopping) {
  const origins = [
    ...new Set([
      web,
      "http://127.0.0.1:3002",
      "http://localhost:3002",
      ...(process.env.WEB_ORIGINS?.split(",") ?? []),
    ]),
  ].join(",");
  for (const [name, owner] of [
    ["astraworld-game-a", "local-a"],
    ["astraworld-game-b", "local-b"],
  ])
    launch("portless", [name, "npm", "run", "game:realtime"], {
      WEB_ORIGINS: origins,
      GATEWAY_ID: owner,
      GAME_PORT: "",
    });
  launch("portless", ["astraworld", "npm", "run", "dev:next"], {
    NEXT_PUBLIC_GAME_GATEWAYS: `${a},${b}`,
  });
  console.log(`\nAstraworld: ${web}\n`);
}
