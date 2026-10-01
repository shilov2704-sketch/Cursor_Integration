#!/usr/bin/env node
/**
 * Find or build a Teams thread URL from prompt text, env, Cursor metadata,
 * or HubEx Support defaults when a message id is known.
 * Prints JSON: { url, source }. Never prints secrets.
 *
 *   node scripts/extract-teams-thread.mjs --text "..."
 *   node scripts/extract-teams-thread.mjs --text-file tmp/teams-context.txt
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaults = JSON.parse(
  fs.readFileSync(path.join(root, "ado", "teams-channel.json"), "utf8")
);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "";
}

function readStdin() {
  if (process.stdin.isTTY) return "";
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function readFileQuiet(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function defaultPromptFiles() {
  return [
    arg("text-file"),
    path.join(root, "tmp", "teams-context.txt"),
    path.join(process.cwd(), "tmp", "teams-context.txt"),
  ]
    .filter(Boolean)
    .map(readFileQuiet)
    .filter(Boolean);
}

function envSnippets() {
  const keys = Object.keys(process.env).filter((k) =>
    /team|thread|conversat|channel|message|graph|parent|slack|source|cursor|chat|group|activity/i.test(
      k
    )
  );
  return keys
    .filter((k) => !/pat|token|secret|password|key|pass/i.test(k))
    .map((k) => `${k}=${process.env[k]}`)
    .join("\n");
}

function cursorMetadataText() {
  const socket = process.env.CURSOR_AGENT_SOCKET || "/run/cursor/api.sock";
  if (!fs.existsSync(socket)) return "";
  const prefixes = ["", "agent/", "turn/", "workspace/", "source/", "teams/", "slack/"];
  const chunks = [];
  for (const prefix of prefixes) {
    const list = spawnSync(
      "curl",
      ["-fsS", "--unix-socket", socket, `http://cursor-agent/v1/meta-data/${prefix}`],
      { encoding: "utf8", timeout: 4000 }
    );
    if (list.status !== 0 || !list.stdout) continue;
    chunks.push(list.stdout);
    for (const line of list.stdout.split("\n")) {
      const name = line.trim();
      if (!name || name.endsWith("/")) continue;
      const key = `${prefix}${name}`;
      const val = spawnSync(
        "curl",
        ["-fsS", "--unix-socket", socket, `http://cursor-agent/v1/meta-data/${key}`],
        { encoding: "utf8", timeout: 4000 }
      );
      if (val.status === 0 && val.stdout) chunks.push(`${key}=${val.stdout}`);
    }
  }
  return chunks.join("\n");
}

function firstTeamsUrl(text) {
  const match = String(text || "").match(
    /https:\/\/teams\.microsoft\.com\/[^\s"'<>\\]+/i
  );
  if (!match) return "";
  return match[0].replaceAll("&amp;", "&").replace(/[),.;]+$/, "");
}

function findConversationId(text) {
  return (
    arg("conversation-id") ||
    process.env.TEAMS_CONVERSATION_ID ||
    (String(text).match(/19:[0-9a-zA-Z._-]+@thread\.[a-z0-9]+/) || [])[0] ||
    ""
  );
}

function findMessageId(text) {
  const raw = String(text || "");
  return (
    arg("message-id") ||
    process.env.TEAMS_MESSAGE_ID ||
    process.env.TEAMS_PARENT_MESSAGE_ID ||
    (raw.match(/parentMessageId=(\d{13,19})/i) || [])[1] ||
    (raw.match(/[?&]createdTime=(\d{13,19})/i) || [])[1] ||
    (raw.match(/\/l\/message\/[^/?#]+\/(\d{13,19})/i) || [])[1] ||
    (raw.match(/TEAMS_(?:PARENT_)?MESSAGE_ID=(\d{13,19})/i) || [])[1] ||
    ""
  );
}

function buildUrl({ conversationId, messageId, tenantId, groupId, teamName, channelName }) {
  if (!conversationId || !messageId) return "";
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (groupId) params.set("groupId", groupId);
  params.set("parentMessageId", messageId);
  if (teamName) params.set("teamName", teamName);
  if (channelName) params.set("channelName", channelName);
  params.set("createdTime", messageId);
  return `https://teams.microsoft.com/l/message/${conversationId}/${messageId}?${params.toString()}`;
}

const text = [
  arg("text"),
  ...defaultPromptFiles(),
  readStdin(),
  envSnippets(),
  cursorMetadataText(),
]
  .filter(Boolean)
  .join("\n");

const found = firstTeamsUrl(text);
if (found) {
  console.log(JSON.stringify({ url: found, source: "prompt-or-env" }));
  process.exit(0);
}

const conversationId = findConversationId(text) || defaults.conversationId;
const messageId = findMessageId(text);
const url = buildUrl({
  conversationId,
  messageId,
  tenantId: arg("tenant-id") || process.env.TEAMS_TENANT_ID || defaults.tenantId,
  groupId: arg("group-id") || process.env.TEAMS_GROUP_ID || defaults.groupId,
  teamName: defaults.teamName,
  channelName: defaults.channelName,
});

console.log(
  JSON.stringify({
    url: url || null,
    source: url ? "built-from-ids" : "missing",
    conversationId: conversationId || null,
    messageId: messageId || null,
  })
);
