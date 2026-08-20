#!/usr/bin/env node
/**
 * Create a HubEx Bug (or attach files to an existing one) when Azure DevOps
 * MCP cannot upload attachments. Requires AZURE_DEVOPS_PAT.
 *
 * Create:
 *   node scripts/create-hubex-bug.mjs --template web --title "..." --tenant "Frigoglass" --users "..." --page "..." --steps "..." --result "..." --expected "..." --attach screenshot.png --attach video.mp4
 *
 * Attach to an existing bug (after MCP create):
 *   node scripts/create-hubex-bug.mjs --attach-to 32727 --attach screenshot.png --attach-dir tmp/bug-attachments
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "ado", "bug-templates.json"), "utf8")
);
const API = "7.1";
const MAX_SIMPLE_UPLOAD_BYTES = 60 * 1024 * 1024;

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function args(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1]) {
      out.push(process.argv[i + 1]);
    }
  }
  return out;
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
    .replace("{actual}", values.actual || "не указан")
    .replace("{expected}", values.expected || "не указан");
}

function sanitizeTag(value) {
  return String(value || "")
    .trim()
    .replace(/[;]+/g, " ")
    .replace(/\s+/g, " ");
}

function buildTags(clientName) {
  const tags = [...(config.fixedTags || ["DEV", "Create Cursor agent"])];
  const client = sanitizeTag(clientName);
  const skip = !client || /^не указан/i.test(client);
  if (!skip && !tags.some((t) => t.toLowerCase() === client.toLowerCase())) {
    tags.splice(1, 0, client);
  }
  return tags.join("; ");
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function collectAttachments() {
  const files = [];
  for (const raw of args("attach")) {
    const resolved = path.resolve(raw);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Attachment not found: ${raw}`);
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) files.push(...listFilesRecursive(resolved));
    else files.push(resolved);
  }
  for (const raw of args("attach-dir")) {
    const resolved = path.resolve(raw);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Attachment directory not found: ${raw}`);
    }
    files.push(...listFilesRecursive(resolved));
  }
  return [...new Set(files)];
}

function authHeader(pat) {
  return `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
}

async function adoJson(url, { method, pat, body, contentType, rawBody }) {
  const headers = { Authorization: authHeader(pat) };
  if (rawBody !== undefined) {
    headers["Content-Type"] = contentType || "application/octet-stream";
  } else if (body !== undefined) {
    headers["Content-Type"] = contentType || "application/json-patch+json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error(`Azure DevOps ${method} ${url} failed: ${res.status}`);
  }
  return json;
}

function editUrl(id) {
  return `https://melston.visualstudio.com/${config.project}/_workitems/edit/${id}`;
}

async function unassignWorkItem(id, pat) {
  const url = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/${id}?api-version=${API}`;
  const json = await adoJson(url, {
    method: "PATCH",
    pat,
    body: [{ op: "add", path: "/fields/System.AssignedTo", value: "" }],
  });
  if (json.fields?.["System.AssignedTo"]) {
    throw new Error(`Failed to clear Assigned To on #${id}`);
  }
  return json;
}

async function attachFiles(id, files, pat) {
  const attached = [];
  const relations = [];
  for (const filePath of files) {
    const fileName = path.basename(filePath);
    const bytes = fs.readFileSync(filePath);
    if (bytes.length > MAX_SIMPLE_UPLOAD_BYTES) {
      throw new Error(
        `File too large for simple upload (${fileName}, ${bytes.length} bytes). Max ${MAX_SIMPLE_UPLOAD_BYTES}.`
      );
    }
    const uploadUrl =
      `https://dev.azure.com/${config.organization}/${config.project}` +
      `/_apis/wit/attachments?fileName=${encodeURIComponent(fileName)}&api-version=${API}`;
    const uploaded = await adoJson(uploadUrl, {
      method: "POST",
      pat,
      rawBody: bytes,
      contentType: "application/octet-stream",
    });
    relations.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "AttachedFile",
        url: uploaded.url,
        attributes: { comment: "From Teams thread" },
      },
    });
    attached.push({ fileName, url: uploaded.url });
  }
  if (!relations.length) return attached;
  const patchUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/${id}?api-version=${API}`;
  await adoJson(patchUrl, { method: "PATCH", pat, body: relations });
  return attached;
}

const pat = resolvePat(process.env.AZURE_DEVOPS_PAT || process.env.PERSONAL_ACCESS_TOKEN);
const attachments = collectAttachments();
const attachTo = arg("attach-to");

if (attachTo) {
  const id = Number(attachTo);
  if (!Number.isInteger(id) || id < 1) throw new Error("--attach-to must be a work item id");
  if (process.argv.includes("--unassign")) {
    await unassignWorkItem(id, pat);
  }
  const attached = await attachFiles(id, attachments, pat);
  console.log(JSON.stringify({ id, url: editUrl(id), attached }, null, 2));
  process.exit(0);
}

const templateKey = (arg("template") || "web").toLowerCase();
const template = config.templates[templateKey];
if (!template) {
  throw new Error(`Unknown template "${templateKey}". Use web | backend | mobile.`);
}

const title = arg("title");
if (!title) throw new Error("--title is required");

const tenant = arg("tenant");
const client = arg("client") || tenant;
const tags = buildTags(client);
const repro = html(config.reproStepsHtmlTemplate, {
  tenant,
  users: arg("users"),
  page: arg("page"),
  steps: arg("steps"),
  actual: arg("result") || arg("actual"),
  expected: arg("expected"),
});

const body = [
  { op: "add", path: "/fields/System.Title", value: title },
  { op: "add", path: "/fields/System.AreaPath", value: template.fields["System.AreaPath"] },
  { op: "add", path: "/fields/System.IterationPath", value: template.fields["System.IterationPath"] },
  { op: "add", path: "/fields/System.Tags", value: tags },
  { op: "add", path: "/fields/System.AssignedTo", value: "" },
  { op: "add", path: "/fields/Microsoft.VSTS.TCM.ReproSteps", value: repro },
];

const createUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/$Bug?api-version=${API}`;
const created = await adoJson(createUrl, { method: "POST", pat, body });
let json = created;
if (json.fields?.["System.AssignedTo"]) {
  json = await unassignWorkItem(json.id, pat);
}

const attached = await attachFiles(json.id, attachments, pat);
console.log(
  JSON.stringify(
    {
      id: json.id,
      url: editUrl(json.id),
      template: template.name,
      tags,
      assignedTo: json.fields?.["System.AssignedTo"] || null,
      attached,
    },
    null,
    2
  )
);
