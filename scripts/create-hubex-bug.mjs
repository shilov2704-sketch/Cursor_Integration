#!/usr/bin/env node
/**
 * Create a HubEx Bug or attach thread files to an existing one.
 * Requires AZURE_DEVOPS_PAT.
 *
 * Create:
 *   node scripts/create-hubex-bug.mjs --template web --title "..." --tenant "Frigoglass" --thread-url "https://teams.microsoft.com/l/message/..." --users "..." --page "..." --steps "..." --result "..." --expected "..." --discover --attach screenshot.png
 *
 * After MCP create:
 *   node scripts/create-hubex-bug.mjs --attach-to 32727 --unassign --discover --attach-dir tmp/bug-attachments --thread-url "https://teams.microsoft.com/l/message/..."
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  fs.readFileSync(path.join(root, "ado", "bug-templates.json"), "utf8")
);
const API = "7.1";
const MAX_SIMPLE_UPLOAD_BYTES = 60 * 1024 * 1024;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const MEDIA_EXT = new Set([
  ...IMAGE_EXT,
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".zip",
  ".heic",
]);

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function threadMarkup(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed || /^не указан/i.test(trimmed)) {
    return "<i>не указан</i>";
  }
  const safe = escapeHtml(trimmed);
  return `<a href="${safe}">${safe}</a>`;
}

function imagesMarkup(uploaded) {
  const images = uploaded.filter((f) => f.isImage);
  if (!images.length) return "";
  const imgs = images
    .map(
      (f) =>
        `<p><img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.fileName)}"></p>`
    )
    .join("");
  return `<br><p><b>Вложения из треда:</b></p>${imgs}`;
}

function html(template, values) {
  return template
    .replace("{thread}", threadMarkup(values.threadUrl))
    .replace("{tenant}", values.tenant || "не указан")
    .replace("{users}", values.users || "не указан")
    .replace("{page}", values.page || "не указана")
    .replace("{steps}", values.steps || "не указаны")
    .replace("{actual}", values.actual || "не указан")
    .replace("{expected}", values.expected || "не указан")
    .replace("{images}", values.imagesHtml || "");
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

function listFilesRecursive(dir, { mediaOnly = false } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, { mediaOnly }));
    else if (entry.isFile()) {
      if (!mediaOnly || MEDIA_EXT.has(path.extname(entry.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
  return out;
}

function discoverDirs() {
  const home = os.homedir();
  return [
    path.join(root, "tmp", "bug-attachments"),
    path.join(process.cwd(), "tmp", "bug-attachments"),
    "/tmp/bug-attachments",
    "/tmp/cursor-attachments",
    "/tmp/attachments",
    "/tmp/cursor",
    path.join(home, ".cursor", "attachments"),
    "/opt/cursor/attachments",
    "/workspace/attachments",
    process.env.CURSOR_ATTACHMENTS,
    process.env.TEAMS_ATTACHMENTS,
  ].filter(Boolean);
}

function shouldDiscover() {
  if (process.argv.includes("--no-discover")) return false;
  if (process.argv.includes("--discover")) return true;
  if (process.argv.includes("--attach-to")) return true;
  return process.argv.includes("--list-discovered");
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
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      files.push(...listFilesRecursive(resolved));
    }
  }
  if (shouldDiscover()) {
    for (const dir of discoverDirs()) {
      files.push(...listFilesRecursive(dir, { mediaOnly: true }));
    }
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

function isImagePath(filePath) {
  return IMAGE_EXT.has(path.extname(filePath).toLowerCase());
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

async function uploadFiles(files, pat) {
  const uploaded = [];
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
    const created = await adoJson(uploadUrl, {
      method: "POST",
      pat,
      rawBody: bytes,
      contentType: "application/octet-stream",
    });
    uploaded.push({
      fileName,
      url: created.url,
      isImage: isImagePath(filePath),
    });
  }
  return uploaded;
}

async function patchRelations(id, relations, pat) {
  if (!relations.length) return;
  const patchUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/${id}?api-version=${API}`;
  await adoJson(patchUrl, { method: "PATCH", pat, body: relations });
}

async function linkAttachments(id, uploaded, pat) {
  await patchRelations(
    id,
    uploaded.map((file) => ({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "AttachedFile",
        url: file.url,
        attributes: { comment: "From Teams thread" },
      },
    })),
    pat
  );
}

async function linkThread(id, threadUrl, pat) {
  const trimmed = String(threadUrl || "").trim();
  if (!trimmed || /^не указан/i.test(trimmed) || !/^https?:\/\//i.test(trimmed)) return;
  await patchRelations(
    id,
    [
      {
        op: "add",
        path: "/relations/-",
        value: {
          rel: "Hyperlink",
          url: trimmed,
          attributes: { comment: "Teams thread" },
        },
      },
    ],
    pat
  );
}

async function getWorkItem(id, pat) {
  const url = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/${id}?api-version=${API}`;
  return adoJson(url, { method: "GET", pat });
}

async function patchReproSteps(id, htmlValue, pat) {
  const url = `https://dev.azure.com/${config.organization}/${config.project}/_apis/wit/workitems/${id}?api-version=${API}`;
  await adoJson(url, {
    method: "PATCH",
    pat,
    body: [{ op: "add", path: "/fields/Microsoft.VSTS.TCM.ReproSteps", value: htmlValue }],
  });
}

function insertThreadAfterPage(html, threadLine) {
  const pageRe = /(<p><b>Страница\/форма:<\/b>[\s\S]*?<\/p>)(\s*(?:<br\s*\/?>\s*)*)/i;
  if (pageRe.test(html)) {
    return html.replace(pageRe, `$1 ${threadLine} $2`);
  }
  const actionsRe = /(<p><b>Действия:<\/b><\/p>)/i;
  if (actionsRe.test(html)) {
    return html.replace(actionsRe, `${threadLine} $1`);
  }
  return `${html}${threadLine}`;
}

function withThreadAndImages(repro, threadUrl, uploaded) {
  let next = repro || "";
  const threadLine = `<p><b>Тред Teams:</b> ${threadMarkup(threadUrl)}</p>`;
  const existingThread = /<p><b>Тред Teams:<\/b>[\s\S]*?<\/p>/i;
  if (existingThread.test(next)) {
    if (threadUrl && /Тред Teams:.*не указан/i.test(next)) {
      next = next.replace(existingThread, threadLine);
    }
  } else {
    next = insertThreadAfterPage(next, threadLine);
  }
  if (uploaded.some((f) => f.isImage) && !/Вложения из треда/i.test(next)) {
    next += imagesMarkup(uploaded);
  }
  return next;
}

if (process.argv.includes("--list-discovered")) {
  console.log(JSON.stringify({ files: collectAttachments() }, null, 2));
  process.exit(0);
}

const pat = resolvePat(process.env.AZURE_DEVOPS_PAT || process.env.PERSONAL_ACCESS_TOKEN);
const attachments = collectAttachments();
const uploaded = await uploadFiles(attachments, pat);
const attachTo = arg("attach-to");
const threadUrl = arg("thread-url") || arg("thread") || process.env.TEAMS_THREAD_URL || "";

if (attachTo) {
  const id = Number(attachTo);
  if (!Number.isInteger(id) || id < 1) throw new Error("--attach-to must be a work item id");
  if (process.argv.includes("--unassign")) {
    await unassignWorkItem(id, pat);
  }
  await linkAttachments(id, uploaded, pat);
  await linkThread(id, threadUrl, pat);
  const current = await getWorkItem(id, pat);
  const repro = current.fields?.["Microsoft.VSTS.TCM.ReproSteps"] || "";
  await patchReproSteps(id, withThreadAndImages(repro, threadUrl, uploaded), pat);
  console.log(JSON.stringify({ id, url: editUrl(id), attached: uploaded, threadUrl: threadUrl || null }, null, 2));
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
  threadUrl,
  tenant,
  users: arg("users"),
  page: arg("page"),
  steps: arg("steps"),
  actual: arg("result") || arg("actual"),
  expected: arg("expected"),
  imagesHtml: imagesMarkup(uploaded),
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
await linkAttachments(json.id, uploaded, pat);
await linkThread(json.id, threadUrl, pat);
console.log(
  JSON.stringify(
    {
      id: json.id,
      url: editUrl(json.id),
      template: template.name,
      tags,
      assignedTo: json.fields?.["System.AssignedTo"] || null,
      attached: uploaded,
      threadUrl: threadUrl || null,
    },
    null,
    2
  )
);
