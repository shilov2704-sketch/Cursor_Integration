#!/usr/bin/env node
/**
 * Write .env from Cloud Agent secrets / process.env. Does not print values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_ENV_KEYS } from "./load-dev-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

const lines = ["# Generated from environment. Do not commit.", ""];
let written = 0;
for (const key of DEV_ENV_KEYS) {
  const value = process.env[key];
  if (value == null || value === "") continue;
  lines.push(`${key}=${value}`);
  written += 1;
}

if (written === 0 && fs.existsSync(envPath)) {
  process.exit(0);
}

if (written === 0) {
  const example = path.join(root, ".env.example");
  if (fs.existsSync(example)) fs.copyFileSync(example, envPath);
  process.exit(0);
}

fs.writeFileSync(envPath, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
console.log(`Wrote ${written} keys to .env (values hidden)`);
