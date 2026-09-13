import { readFile, writeFile } from "node:fs/promises";
import { renderToString } from "react-dom/server";
import Sandbox from "../app/sandbox";

const html = await readFile("dist/index.html", "utf8");
await writeFile(
  "dist/index.html",
  html.replace("<!--prerender-->", renderToString(<Sandbox />)),
);
