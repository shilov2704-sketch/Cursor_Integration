#!/usr/bin/env node
/**
 * Create a HubEx Bug from templates when Azure DevOps MCP is unavailable
 * (Cursor Cloud Agent / Teams). Requires AZURE_DEVOPS_PAT in the environment.
 *
 * Usage:
 *   node scripts/create-hubex-bug.mjs --template web --title "..." --tenant "..." --users "..." --page "..." --steps "..." --result "..."
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "ado", "bug-templates.json"), "utf8")
);

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function resolvePat(raw) {
  if (!raw) {
    throw new Error(
      "AZURE_DEVOPS_PAT is missing. Add it in Cursor Cloud Agents → Secrets (not GitHub Secrets)."
    );
  }
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (/^[^:]+:.+$/.test(decoded) && decoded.includes("@")) {
      return decoded.slice(decoded.indexOf(":") + 1);
    }
  } catch {
    // use raw token
  }
  return raw;
}

function html(template, values) {
  return template
    .replace("{tenant}", values.tenant || "не указан")
    .replace("{users}", values.users || "не указан")
    .replace("{page}", values.page || "не указана")
    .replace("{steps}", values.steps || "не указаны")
    .replace("{actual}", values.result || "не указан");
}

const templateKey = (arg("template") || "web").toLowerCase();
const template = config.templates[templateKey];
if (!template) {
  throw new Error(`Unknown template "${templateKey}". Use web | backend | mobile.`);
}

const title = arg("title");
if (!title) throw new Error("--title is required");

const pat = resolvePat(process.env.AZURE_DEVOPS_PAT || process.env.PERSONAL_ACCESS_TOKEN);
const auth = Buffer.from(`:${pat}`).toString("base64");
const repro = html(config.reproStepsHtmlTemplate, {
  tenant: arg("tenant"),
  users: arg("users"),
  page: arg("page"),
  steps: arg("steps"),
  result: arg("result"),
});

const body = [
  { op: "add", path: "/fields/System.Title", value: title },
  { op: "add", path: "/fields/System.AreaPath", value: template.fields["System.AreaPath"] },
  { op: "add", path: "/fields/System.IterationPath", value: template.fields["System.IterationPath"] },
  { op: "add", path: "/fields/System.Tags", value: template.fields["System.Tags"] },
  { op: "add", path: "/fields/Microsoft.VSTS.TCM.ReproSteps", value: repro },
];

const url = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/$Bug?api-version=7.1`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json-patch+json",
  },
  body: JSON.stringify(body),
});

const json = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

const id = json.id;
const editUrl = `https://melston.visualstudio.com/${config.project}/_workitems/edit/${id}`;
console.log(JSON.stringify({ id, url: editUrl, template: template.name }, null, 2));
