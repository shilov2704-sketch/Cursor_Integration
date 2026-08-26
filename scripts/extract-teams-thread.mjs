#!/usr/bin/env node
/**
 * Find or build a Teams thread URL from prompt text, env, or HubEx Support defaults.
 * Prints JSON: { url, source }. Never prints secrets.
 *
 *   node scripts/extract-teams-thread.mjs --text "..."
 *   echo "$PROMPT" | node scripts/extract-teams-thread.mjs
 */
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

function envSnippets() {
  const keys = Object.keys(process.env).filter((k) =>
    /team|thread|conversat|channel|message|graph|parent/i.test(k)
  );
  return keys
    .filter((k) => !/pat|token|secret|password|key/i.test(k))
    .map((k) => `${k}=${process.env[k]}`)
    .join("\n");
}

function firstTeamsUrl(text) {
  const match = String(text || "").match(
    /https:\/\/teams\.microsoft\.com\/[^\s"'<>\\]+/i
  );
  if (!match) return "";
  return match[0].replaceAll("&amp;", "&").replace(/[),.;]+$/, "");
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
  return `https://teams.microsoft.com/l/message/${encodeURIComponent(conversationId)}/${messageId}?${params.toString()}`;
}

const text = [arg("text"), readStdin(), envSnippets()].filter(Boolean).join("\n");
const found = firstTeamsUrl(text);
if (found) {
  console.log(JSON.stringify({ url: found, source: "prompt-or-env" }));
  process.exit(0);
}

const conversationId =
  arg("conversation-id") ||
  process.env.TEAMS_CONVERSATION_ID ||
  (text.match(/19:[0-9a-zA-Z._-]+@thread\.[a-z0-9]+/) || [])[0] ||
  defaults.conversationId;

const messageId =
  arg("message-id") ||
  process.env.TEAMS_MESSAGE_ID ||
  process.env.TEAMS_PARENT_MESSAGE_ID ||
  (text.match(/\b1[0-9]{12}\b/) || [])[0] ||
  "";

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
