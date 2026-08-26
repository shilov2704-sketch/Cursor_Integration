#!/usr/bin/env node
/**
 * Load HubEx DEV credentials from process.env and optional local .env.
 * Never logs secret values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEV_ENV_KEYS = [
  "AZURE_DEVOPS_PAT",
  "API_USER_TOKEN",
  "SECOND_BASIC_TOKEN",
  "POWER_USER_TOKEN",
  "TENANT_ID",
  "TENANT_MEMBER_ID",
  "APP_ID",
  "URL_DEV_HUBEX",
  "USER_EMAIL",
  "USER_PHONE",
  "TEST_USER",
  "TEST_PASS",
  "TEST_PHONE",
  "TEST_TENANT",
  "HOST_URL",
  "URL_API_HUBEX",
  "BASIC_TOKEN",
];

export const SECRET_KEYS = new Set([
  "AZURE_DEVOPS_PAT",
  "API_USER_TOKEN",
  "SECOND_BASIC_TOKEN",
  "POWER_USER_TOKEN",
  "USER_EMAIL",
  "USER_PHONE",
  "TENANT_MEMBER_ID",
  "TEST_USER",
  "TEST_PASS",
  "TEST_PHONE",
  "BASIC_TOKEN",
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseDotEnv(text) {
  const out = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadDevEnv() {
  const fromFile = {};
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    Object.assign(fromFile, parseDotEnv(fs.readFileSync(envPath, "utf8")));
  }
  const env = {};
  for (const key of DEV_ENV_KEYS) {
    const value = process.env[key] || fromFile[key] || "";
    env[key] = value;
    if (value && !process.env[key]) process.env[key] = value;
  }
  return env;
}

export function redact(value) {
  const text = String(value ?? "");
  if (!text) return "";
  if (text.length <= 8) return "***";
  return `${text.slice(0, 2)}…${text.slice(-2)}`;
}

export function envStatus(env = loadDevEnv()) {
  const status = {};
  for (const key of DEV_ENV_KEYS) {
    const present = Boolean(String(env[key] || "").trim());
    status[key] = SECRET_KEYS.has(key)
      ? { present, preview: present ? redact(env[key]) : null }
      : { present, value: present && !SECRET_KEYS.has(key) ? env[key] : null };
  }
  return status;
}

export function missingSecrets(env = loadDevEnv(), keys = ["API_USER_TOKEN", "URL_DEV_HUBEX", "TENANT_ID"]) {
  return keys.filter((key) => !String(env[key] || "").trim());
}
