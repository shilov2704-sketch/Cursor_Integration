#!/usr/bin/env node
/**
 * Call HubEx DEV API. Tokens are never printed.
 *
 *   node scripts/hubex-api.mjs GET /Documents
 *   node scripts/hubex-api.mjs --token power GET /path
 *   node scripts/hubex-api.mjs --profile frontend GET /path
 */
import { loadDevEnv, missingSecrets } from "./load-dev-env.mjs";

const argv = process.argv.slice(2);
let tokenKind = "api";
let profile = "backend";
let body = "";
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--token" && argv[i + 1]) {
    tokenKind = argv[++i].toLowerCase();
    continue;
  }
  if (argv[i] === "--profile" && argv[i + 1]) {
    profile = argv[++i].toLowerCase();
    continue;
  }
  if (argv[i] === "--body" && argv[i + 1]) {
    body = argv[++i];
    continue;
  }
  positional.push(argv[i]);
}

const env = loadDevEnv();
const frontend = profile === "frontend";
const baseKey = frontend ? "URL_API_HUBEX" : "URL_DEV_HUBEX";
const missing = missingSecrets(env, [baseKey, "TENANT_ID"]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}. Fill .env (not git) or Cloud Agents Secrets.`);
  process.exit(1);
}

const token =
  tokenKind === "power"
    ? env.POWER_USER_TOKEN
    : tokenKind === "basic"
      ? frontend
        ? env.BASIC_TOKEN
        : env.SECOND_BASIC_TOKEN
      : env.API_USER_TOKEN;

if (!token) {
  console.error(`Token for --token ${tokenKind} is empty. Fill .env, do not paste it here.`);
  process.exit(1);
}

const method = (positional[0] || "GET").toUpperCase();
const rawPath = positional[1] || "/";
const base = String(env[baseKey]).replace(/\/$/, "");
const url = rawPath.startsWith("http")
  ? rawPath
  : `${base}${rawPath.startsWith("/") ? "" : "/"}${rawPath}`;

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: tokenKind === "basic" ? `Basic ${token}` : `Bearer ${token}`,
};
if (env.TENANT_ID) headers.TenantId = env.TENANT_ID;
if (env.TENANT_MEMBER_ID) headers.TenantMemberId = env.TENANT_MEMBER_ID;
if (env.APP_ID) headers.AppId = env.APP_ID;

const res = await fetch(url, {
  method,
  headers,
  body: body && method !== "GET" ? body : undefined,
});

const text = await res.text();
let parsed = text;
try {
  parsed = text ? JSON.parse(text) : null;
} catch {
  parsed = text;
}

console.log(
  JSON.stringify(
    {
      ok: res.ok,
      status: res.status,
      method,
      path: rawPath,
      tenantId: env.TENANT_ID,
      body: parsed,
    },
    null,
    2
  )
);

if (!res.ok) process.exit(1);
