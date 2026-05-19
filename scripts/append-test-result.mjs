import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const resultPath = join(root, "result.md");

const banner = `## Test run — ${new Date().toISOString()}\n\n`;
const vitest = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run"],
  {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  }
);

const out = [
  "```text",
  vitest.stdout || "",
  vitest.stderr || "",
  `exit: ${vitest.status}`,
  "```",
  "\n---\n\n",
].join("\n");

const prev = existsSync(resultPath) ? readFileSync(resultPath, "utf8") : "";
writeFileSync(resultPath, banner + out + prev);
console.log("Appended to result.md");
