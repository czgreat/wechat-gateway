import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { ProxyAgent } from "undici";

import express from "express";
import QRCode from "qrcode";
import initSqlJs from "sql.js";
import yazl from "yazl";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const DATA_DIR = process.env.DATA_DIR?.trim() || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const OPENCLAW_STATE_DIR =
  process.env.OPENCLAW_STATE_DIR?.trim() || path.join(DATA_DIR, "openclaw");
const DEFAULT_API_BASE_URL =
  process.env.CLAWBOT_API_BASE_URL?.trim() || "https://ilinkai.weixin.qq.com";
const DEFAULT_CDN_BASE_URL =
  process.env.CLAWBOT_CDN_BASE_URL?.trim() ||
  "https://novac2c.cdn.weixin.qq.com/c2c";
const DEFAULT_BOT_TYPE = process.env.CLAWBOT_BOT_TYPE?.trim() || "3";
const DEFAULT_PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.trim() || "";
const PUBLIC_PORT = process.env.PUBLIC_PORT?.trim() || "";
const SKIP_REMOTE_BOOT = process.env.GATEWAY_SKIP_REMOTE_BOOT?.trim() === "1";
const CHANNEL_VERSION = `wechat-clawbot-gateway/${process.env.APP_VERSION?.trim() || "6.0"}`;
const MAX_LOG_ITEMS = 200;
const MAX_CONVERSATION_ITEMS = 50;
const MAX_DISPATCH_ITEMS = 500;
const COMMAND_CONTEXT_TTL_MS = 10 * 60_000;
const PERSONAL_CAPTURE_LIST_LIMIT = 12;
const PERSONAL_CAPTURE_EXPORT_LIMIT = 200;
const PERSONAL_CAPTURE_AI_BASE_URL = "http://localhost:23550/v1";
const PERSONAL_CAPTURE_AI_API_KEY =
  "";
const PERSONAL_CAPTURE_AI_MODELS = ["gpt-5.5", "deepseek-v3.2", "gpt-5.2"];
const PERSONAL_CAPTURE_AI_TIMEOUT_MS = 45_000;
const PERSONAL_CAPTURE_AI_MAX_ITEMS = 80;
const PERSONAL_CAPTURE_AI_MAX_ACTIONS = 60;
const QR_POLL_TIMEOUT_MS = 35_000;
const BOT_RETRY_DELAY_MS = 15_000;
const OUTGOING_WEBHOOK_TIMEOUT_MS = 15_000;
const SUPPRESS_WECHAT_REPLY = "__SUPPRESS_WECHAT_REPLY__";

process.env.OPENCLAW_STATE_DIR = OPENCLAW_STATE_DIR;
const { start } = await import("weixin-agent-sdk");

const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const TARGETS_FILE = path.join(DATA_DIR, "targets.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");
const INTEGRATIONS_FILE = path.join(DATA_DIR, "integrations.json");
const DISPATCHES_FILE = path.join(DATA_DIR, "dispatches.json");
const COMMAND_CONTEXTS_FILE = path.join(DATA_DIR, "command_contexts.json");
const BOTS_FILE = path.join(DATA_DIR, "bots.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const NOTIFICATION_RULES_FILE = path.join(DATA_DIR, "notification_rules.json");
const SQLITE_DB_FILE = path.join(DATA_DIR, "message_history.sqlite3");

const OPENCLAW_WEIXIN_DIR = path.join(OPENCLAW_STATE_DIR, "openclaw-weixin");
const OPENCLAW_ACCOUNT_DIR = path.join(OPENCLAW_WEIXIN_DIR, "accounts");
const OPENCLAW_ACCOUNT_INDEX_FILE = path.join(
  OPENCLAW_WEIXIN_DIR,
  "accounts.json",
);

const UploadMediaType = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
  VOICE: 4,
};

const MessageType = {
  BOT: 2,
};

const MessageItemType = {
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
};

const MessageState = {
  FINISH: 2,
};

const WECHAT_FILE_SAFE_BYTES = 24.5 * 1024 * 1024;
const COMPRESSIBLE_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "xml",
  "yaml",
  "yml",
  "log",
  "sql",
  "html",
  "htm",
  "js",
  "ts",
  "jsx",
  "tsx",
  "css",
  "scss",
  "less",
  "py",
  "java",
  "kt",
  "go",
  "rs",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "sh",
  "toml",
  "ini",
  "conf",
  "properties",
]);
const NON_COMPRESSIBLE_FILE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "mp3",
  "wav",
  "m4a",
  "mp4",
  "mov",
  "mkv",
  "avi",
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "xz",
  "apk",
  "ipa",
  "exe",
  "msi",
  "dmg",
  "iso",
  "bin",
]);

const KNOWN_ADAPTER_TYPES = [
  "generic",
  "moviepilot",
  "moviepilot-rest",
  "video-downloader",
  "uptime-kuma",
  "grafana",
  "alertmanager",
];

const ADAPTER_LABELS = {
  generic: "通用集成",
  moviepilot: "MoviePilot",
  "moviepilot-rest": "MoviePilot REST",
  "video-downloader": "视频下载",
  "uptime-kuma": "Uptime Kuma",
  grafana: "Grafana",
  alertmanager: "Alertmanager",
};

const BUILTIN_COMMAND_ALIASES = {
  generic: ["ops"],
  moviepilot: [],
  "moviepilot-rest": ["mp"],
  "video-downloader": [],
  "uptime-kuma": ["mon"],
  grafana: ["mon"],
  alertmanager: ["mon"],
};

const SUBTITLE_COMMAND_ALIAS = "zm";
const PERSONAL_CAPTURE_COMMAND_ALIAS = "dz";
const LEGACY_SUBTITLE_COMMAND_ALIASES = new Set(["zimu", "字幕", "下载"]);
const SUBTITLE_HELP_ACTIONS = new Set(["", "help", "帮助"]);
const PERSONAL_CAPTURE_KIND_LABELS = {
  inbox: "未整理",
  todo: "待做",
  idea: "想法",
  memo: "备忘",
};
const PERSONAL_CAPTURE_STATUS_LABELS = {
  open: "未完成",
  done: "已完成",
  ignored: "已忽略",
  archived: "已归档",
};

const RESERVED_COMMANDS = new Set([
  "ping",
  "ip",
  "help",
  "helpall",
  "status",
  "version",
  "ver",
  "integrations",
  "connectivity",
  "check",
  "dz",
  "todo",
  "状态",
  "版本",
  "集成",
  "连通",
  "待做",
]);

const DEFAULT_NOTIFICATION_RULES = [
  {
    id: "default-homeassistant",
    name: "Home Assistant 通知",
    source: "homeassistant",
    keywords: ["homeassistant", "home assistant", "ha"],
    capabilities: ["ha_notice"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-bilisync",
    name: "BiliSync 通知",
    source: "bilisync",
    keywords: ["bilisync", "bili-sync", "b站", "up主"],
    capabilities: ["bili_sync"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-ops",
    name: "运维通知",
    source: "ops",
    keywords: ["ops", "glances", "告警", "运维", "监控"],
    capabilities: ["ops"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-jianfei",
    name: "减肥通知",
    source: "jianfei",
    keywords: ["jianfei", "减肥", "体重", "热量", "步数", "饮食"],
    capabilities: ["diet"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-codex",
    name: "Codex 通知",
    source: "codex",
    keywords: ["codex"],
    capabilities: ["codex"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-beike",
    name: "贝壳通知",
    source: "beike",
    keywords: ["beike", "贝壳"],
    capabilities: ["beike"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-pricereader",
    name: "好价通知",
    source: "pricereader",
    keywords: ["pricereader", "好价", "低价", "降价"],
    capabilities: ["pricereader"],
    allowDefaultRecipient: true,
  },
  {
    id: "default-moviepilot",
    name: "MoviePilot 通知",
    source: "moviepilot",
    keywords: ["moviepilot", "订阅", "入库", "下载", "影视", "mp"],
    capabilities: ["moviepilot"],
    allowDefaultRecipient: true,
  },
];

const store = {
  config: {
    webhookToken: "",
    baseUrl: DEFAULT_API_BASE_URL,
    botType: DEFAULT_BOT_TYPE,
    publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
    updatedAt: "",
  },
  targets: {
    items: [],
  },
  bots: {
    items: [],
  },
  logs: {
    items: [],
  },
  conversations: {
    items: {},
  },
  integrations: {
    items: [],
  },
  users: {
    items: [],
  },
  notificationRules: {
    items: [],
  },
  dispatches: {
    items: [],
  },
  commandContexts: {
    items: {},
  },
};

const runtime = {
  status: "not_logged_in",
  currentAccountId: "",
  qrCodeText: "",
  qrCodeDataUrl: "",
  qrStatus: "",
  qrMessage: "",
  lastError: "",
  loginSessionId: "",
  loginTask: null,
  botTask: null,
  botAbortController: null,
  reconnectTimer: null,
  deliveryWindowReminderTimer: null,
  startedAt: new Date().toISOString(),
  bots: {},
};

const CUSTOM_COMMANDS = new Map([
  // 在这里追加自定义命令，示例：
  // [
  //   "重启MP",
  //   async () => "MoviePilot 重启逻辑已触发",
  // ],
]);

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

const SQL = await initSqlJs({
  locateFile(file) {
    return path.join(__dirname, "node_modules", "sql.js", "dist", file);
  },
});

const sqliteState = {
  db: null,
  loaded: false,
};

function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : `${url}/`;
}

function buildBaseInfo() {
  return {
    channel_version: CHANNEL_VERSION,
  };
}

function createWebhookToken() {
  return crypto.randomBytes(24).toString("hex");
}

function createClientId() {
  return `wechat-gateway:${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeAccountId(raw) {
  return raw.trim().toLowerCase().replace(/[@.]/g, "-");
}

function randomWechatUin() {
  const value = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(value), "utf-8").toString("base64");
}

function truncateText(value, maxLength = 160) {
  if (!value) {
    return "";
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

const BEIJING_MINUTE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const QUEUED_CATEGORY_LABELS = {
  bili_sync: "BiliSync",
  beike: "贝壳",
  codex: "Codex",
  diet: "减肥",
  generic: "其他",
  ha_notice: "Home Assistant",
  moviepilot: "MoviePilot",
  mp_error: "MoviePilot 错误",
  mp_noise: "MoviePilot 低优先级",
  mp_notice: "MoviePilot",
  ops: "运维",
  pricereader: "好价",
};

function formatBeijingMinute(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const parts = Object.fromEntries(
    BEIJING_MINUTE_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  if (!parts.month || !parts.day || !parts.hour || !parts.minute) {
    return BEIJING_MINUTE_FORMATTER.format(date);
  }

  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatBeijingReplayMarker(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const parts = Object.fromEntries(
    BEIJING_MINUTE_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  if (!parts.month || !parts.day || !parts.hour || !parts.minute) {
    return "";
  }

  return `${parts.hour}:${parts.minute}  ${parts.month}/${parts.day}`;
}

const GENERIC_SOURCE_DISPLAY_LABELS = {
  alertmanager: "Alertmanager",
  beike: "贝壳",
  bilisync: "BiliSync",
  codex: "Codex",
  generic: "通用Webhook",
  grafana: "Grafana",
  homeassistant: "Home Assistant",
  jianfei: "减肥",
  moviepilot: "MoviePilot",
  ops: "运维",
  pricereader: "好价",
  uptimekuma: "Uptime Kuma",
};

function normalizeGenericSourceKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function inferGenericSourceKey(payload, title, content, linkUrl) {
  const explicitSource = pickFirstString(payload.source, payload.sourceLabel);
  const normalizedExplicit = normalizeGenericSourceKey(explicitSource);
  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  const haystack = [title, content, linkUrl]
    .map((item) => String(item || "").toLowerCase())
    .join("\n");

  if (/beike|贝壳/.test(haystack)) {
    return "beike";
  }
  if (/pricereader|好价|低价|降价/.test(haystack)) {
    return "pricereader";
  }
  if (/codex|codex\./.test(haystack)) {
    return "codex";
  }
  if (/jianfei|减肥|体重|热量|步数|饮食/.test(haystack)) {
    return "jianfei";
  }
  if (/moviepilot|订阅|入库|下载|影视|\bmp\b/.test(haystack)) {
    return "moviepilot";
  }
  if (/homeassistant|home assistant|\bha\b/.test(haystack)) {
    return "homeassistant";
  }
  if (/bilisync|bili-sync|b站|up主/.test(haystack)) {
    return "bilisync";
  }
  if (/\bops\b|glances|运维|监控|告警/.test(haystack)) {
    return "ops";
  }

  return "generic";
}

function getGenericSourceDisplayLabel(sourceKey, fallbackLabel = "") {
  return GENERIC_SOURCE_DISPLAY_LABELS[normalizeGenericSourceKey(sourceKey)] || fallbackLabel || "通用Webhook";
}

function uniqueList(values) {
  return Array.from(new Map(values.map((value) => [value, value])).values());
}

function parseStringList(value) {
  if (Array.isArray(value)) {
    return uniqueList(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    );
  }

  if (typeof value === "string") {
    return uniqueList(
      value
        .split(/[\r\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }

  return [];
}

function safeJsonPreview(value, maxLength = 1400) {
  try {
    const text = JSON.stringify(value, null, 2);
    if (!text) {
      return "";
    }

    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  } catch {
    return "";
  }
}

function parseJsonText(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonTextWithFenceFallback(value) {
  const direct = parseJsonText(value);
  if (direct) {
    return direct;
  }

  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fenced = parseJsonText(fencedMatch[1]);
    if (fenced) {
      return fenced;
    }
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return parseJsonText(objectMatch[0]);
  }

  return null;
}

function normalizeIntegrationId(raw) {
  return String(raw ?? "").trim();
}

function normalizeIntegrationAlias(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeUserId(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeBotId(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeCommandAlias(raw) {
  return String(raw ?? "").trim().replace(/^\/+/, "").toLowerCase();
}

function normalizeAdapterType(raw) {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return KNOWN_ADAPTER_TYPES.includes(value) ? value : "generic";
}

function isVideoDownloaderAdapter(adapterType) {
  return normalizeAdapterType(adapterType) === "video-downloader";
}

function supportsInteractiveIntegrationSession(adapterType) {
  return isVideoDownloaderAdapter(adapterType);
}

function parseUserIdList(value) {
  return uniqueList(
    parseStringList(value)
      .map((item) => normalizeUserId(item))
      .filter(Boolean),
  );
}

function parseBotIdList(value) {
  return uniqueList(
    parseStringList(value)
      .map((item) => normalizeBotId(item))
      .filter(Boolean),
  );
}

function normalizeCapability(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCapabilityList(value) {
  return uniqueList(
    parseStringList(value)
      .map((item) => normalizeCapability(item))
      .filter(Boolean),
  );
}

function normalizeNotificationRuleId(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeNotificationRuleMatch(raw) {
  return String(raw ?? "").trim().toLowerCase();
}

function parseNotificationKeywordList(value) {
  return uniqueList(
    parseStringList(value)
      .map((item) => normalizeNotificationRuleMatch(item))
      .filter(Boolean),
  );
}

function getDefaultCommandAliasesForAdapter(adapterType) {
  return BUILTIN_COMMAND_ALIASES[adapterType] ?? [];
}

function getEffectiveCommandAliases(integration) {
  return uniqueList(
    [
      integration.alias,
      ...getDefaultCommandAliasesForAdapter(integration.adapterType),
      ...integration.commandAliases,
    ]
      .map((item) => normalizeCommandAlias(item))
      .filter(Boolean),
  );
}

function isAiSubtitleIntegration(integration) {
  return normalizeIntegrationAlias(integration?.alias || "") === "ai-subtitle";
}

function findSubtitleIntegration() {
  const enabledVideoIntegrations = getEnabledIntegrations().filter((item) =>
    isVideoDownloaderAdapter(item.adapterType),
  );
  if (!enabledVideoIntegrations.length) {
    return null;
  }

  const aiSubtitleIntegration = enabledVideoIntegrations.find((item) =>
    isAiSubtitleIntegration(item),
  );
  if (aiSubtitleIntegration) {
    return aiSubtitleIntegration;
  }

  const explicitZmIntegration = enabledVideoIntegrations.find((item) =>
    getEffectiveCommandAliases(item).includes(SUBTITLE_COMMAND_ALIAS),
  );
  if (explicitZmIntegration) {
    return explicitZmIntegration;
  }

  return enabledVideoIntegrations.length === 1 ? enabledVideoIntegrations[0] : null;
}

function extractFirstHttpUrl(raw) {
  const text = String(raw || "");
  const match = /https?:\/\/\S+/i.exec(text);
  if (!match) {
    return "";
  }

  return match[0].replace(/[>"'）】》」』】。，、；：！？,.!?:;]+$/u, "");
}

function normalizeSubtitleCommandModePrefix(raw) {
  const normalized = String(raw || "")
    .trim()
    .replace(/^[\s:：,，;；|/\\-]+/u, "")
    .replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  let match = normalized.match(/^(md\s*word|word\s*md)(?:\s|$)/i);
  if (match) {
    return "md word";
  }

  match = normalized.match(/^(音频|audio)(?:\s|$)/i);
  if (match) {
    return "音频";
  }

  match = normalized.match(/^(下载|download)(?:\s|$)/i);
  if (match) {
    return "下载";
  }

  match = normalized.match(/^(word)(?:\s|$)/i);
  if (match) {
    return "word";
  }

  match = normalized.match(/^(md)(?:\s|$)/i);
  if (match) {
    return "md";
  }

  return "";
}

function normalizeSubtitleCommandText(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/\s+/g, " ");
  const httpUrlMatch = /https?:\/\/\S+/i.exec(normalized);
  if (httpUrlMatch) {
    const url = extractFirstHttpUrl(normalized);
    const modePrefix = normalizeSubtitleCommandModePrefix(
      normalized.slice(0, httpUrlMatch.index).trim(),
    );
    return modePrefix ? `${modePrefix} ${url}` : url;
  }

  let match = normalized.match(/^md\s*word\s*(.+)$/i);
  if (!match) {
    match = normalized.match(/^word\s*md\s*(.+)$/i);
  }
  if (match) {
    return `md word ${match[1].trim()}`;
  }

  match = normalized.match(/^(音频|audio)\s*(.+)$/i);
  if (match) {
    return `音频 ${match[2].trim()}`;
  }

  match = normalized.match(/^(下载|download)\s*(.+)$/i);
  if (match) {
    return `下载 ${match[2].trim()}`;
  }

  match = normalized.match(/^(word)\s*(.+)$/i);
  if (match) {
    return `word ${match[2].trim()}`;
  }

  match = normalized.match(/^(md)\s*(.+)$/i);
  if (match) {
    return `md ${match[2].trim()}`;
  }

  return normalized;
}

function looksLikeSubtitleCommandRemainder(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return true;
  }

  if (/^(help|帮助)$/i.test(trimmed)) {
    return true;
  }

  if (extractFirstHttpUrl(trimmed)) {
    return true;
  }

  if (
    /^(md\s*word|word\s*md|md|word|下载|download|音频|audio)\b/i.test(trimmed) ||
    /^(下载|download|音频|audio)/i.test(trimmed)
  ) {
    return true;
  }

  return /^(https?:\/\/|ftp:\/\/|magnet:|www\.)/i.test(trimmed);
}

function parseSubtitleGatewayCommand(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (!lower.startsWith(SUBTITLE_COMMAND_ALIAS)) {
    return null;
  }

  const remainder = trimmed.slice(SUBTITLE_COMMAND_ALIAS.length);
  if (!remainder.trim()) {
    return {
      rawText: SUBTITLE_COMMAND_ALIAS,
      commandText: "",
    };
  }

  const rawRemainder = remainder.trimStart();
  if (!looksLikeSubtitleCommandRemainder(rawRemainder)) {
    return null;
  }

  return {
    rawText: `${SUBTITLE_COMMAND_ALIAS} ${rawRemainder}`.trim(),
    commandText: normalizeSubtitleCommandText(rawRemainder),
  };
}

function maskToken(token) {
  const value = String(token || "");
  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isPrivateIpv4(address) {
  if (address.startsWith("10.")) {
    return true;
  }

  if (address.startsWith("192.168.")) {
    return true;
  }

  if (address.startsWith("172.")) {
    const secondOctet = Number.parseInt(address.split(".")[1] ?? "", 10);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
}

function getLanIp() {
  if (process.env.HOST_LAN_IP?.trim()) {
    return process.env.HOST_LAN_IP.trim();
  }

  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      let score = 0;
      if (isPrivateIpv4(entry.address)) {
        score += 4;
      }
      if (/^(eth|en|wlan|wl|bond|br)/i.test(name)) {
        score += 3;
      }
      if (/docker|veth|lo/i.test(name)) {
        score -= 10;
      }

      candidates.push({ address: entry.address, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return (
    candidates[0]?.address ??
    "未检测到宿主机 LAN IP，可在 docker-compose.yml 里设置 HOST_LAN_IP"
  );
}

function getFallbackPublicBaseUrl() {
  if (store.config.publicBaseUrl?.trim()) {
    return store.config.publicBaseUrl.trim().replace(/\/+$/, "");
  }

  const lanIp = getLanIp();
  if (!lanIp || lanIp.startsWith("未")) {
    return "";
  }

  const port = PUBLIC_PORT || String(PORT);
  return `http://${lanIp}${port ? `:${port}` : ""}`;
}

function getIntegrationPath(alias) {
  const normalizedAlias = normalizeIntegrationAlias(alias);
  return {
    inboundPath: `/api/integrations/${normalizedAlias}/push`,
    replyPath: `/api/integrations/${normalizedAlias}/reply`,
  };
}

function buildIntegrationUrls(integration) {
  const baseUrl = getFallbackPublicBaseUrl();
  const { inboundPath, replyPath } = getIntegrationPath(integration.alias);
  return {
    inboundPath,
    replyPath,
    inboundUrl: baseUrl
      ? `${baseUrl}${inboundPath}?token=${encodeURIComponent(integration.incomingToken)}`
      : "",
    replyUrl: baseUrl
      ? `${baseUrl}${replyPath}?token=${encodeURIComponent(integration.replyToken)}`
      : "",
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function stringifyJson(value) {
  if (value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function isRecoverableSqliteError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /database disk image is malformed|file is not a database|database corruption|sqlite quick_check failed/i.test(
    message,
  );
}

function canAttemptSqliteReindex(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /index|quick_check failed|malformed/i.test(message);
}

async function backupCorruptSqliteFile(reason = "") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${SQLITE_DB_FILE}.corrupt-${timestamp}.bak`;
  try {
    await fs.copyFile(SQLITE_DB_FILE, backupPath);
    if (reason) {
      await fs.writeFile(`${backupPath}.reason.txt`, `${reason}\n`, "utf-8");
    }
    console.error(`[sqlite] backed up corrupt database to ${backupPath}`);
  } catch (error) {
    console.error(
      `[sqlite] failed to back up corrupt database: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function applySqliteSchema(db) {
  db.run(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS delivery_windows (
      key TEXT PRIMARY KEY,
      bot_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      last_user_message_at TEXT,
      proactive_count INTEGER NOT NULL DEFAULT 0,
      last_proactive_message_at TEXT,
      closing_reminder_sent_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_delivery_windows_target ON delivery_windows(bot_id, target_id);

    CREATE TABLE IF NOT EXISTS log_entries (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      summary TEXT NOT NULL,
      extra_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_log_entries_created_at ON log_entries(created_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      source TEXT,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_target_created_at ON messages(bot_id, target_id, created_at);

    CREATE TABLE IF NOT EXISTS personal_captures (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      text TEXT NOT NULL,
      completed_at TEXT,
      archived_at TEXT,
      extra_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_personal_captures_target_created_at
      ON personal_captures(bot_id, target_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_personal_captures_target_status_kind
      ON personal_captures(bot_id, target_id, status, kind, created_at DESC);

    CREATE TABLE IF NOT EXISTS pending_notifications (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      bot_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      source TEXT,
      category TEXT,
      priority TEXT,
      title TEXT,
      content TEXT,
      rendered_text TEXT,
      image_url TEXT,
      file_url TEXT,
      file_name TEXT,
      state TEXT NOT NULL,
      raw_payload_json TEXT,
      extra_json TEXT,
      released_at TEXT,
      release_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pending_notifications_target ON pending_notifications(bot_id, target_id, state, created_at);
  `);

  try {
    db.run(`ALTER TABLE pending_notifications ADD COLUMN rendered_text TEXT`);
  } catch {
    // Column already exists on upgraded databases.
  }
  try {
    db.run(`ALTER TABLE pending_notifications ADD COLUMN file_url TEXT`);
  } catch {
    // Column already exists on upgraded databases.
  }
  try {
    db.run(`ALTER TABLE pending_notifications ADD COLUMN file_name TEXT`);
  } catch {
    // Column already exists on upgraded databases.
  }
  try {
    db.run(`ALTER TABLE delivery_windows ADD COLUMN closing_reminder_sent_at TEXT`);
  } catch {
    // Column already exists on upgraded databases.
  }
}

function verifySqliteIntegrity(db) {
  const result = db.exec("PRAGMA quick_check(1)");
  const status = String(result[0]?.values?.[0]?.[0] || "").trim().toLowerCase();
  if (status && status !== "ok") {
    throw new Error(`sqlite quick_check failed: ${status}`);
  }
}

function tryRepairSqliteDbInPlace(db, error) {
  if (!canAttemptSqliteReindex(error)) {
    return false;
  }

  try {
    db.run("REINDEX");
    verifySqliteIntegrity(db);
    console.error("[sqlite] recovered database in place via REINDEX");
    return true;
  } catch (repairError) {
    console.error(
      `[sqlite] REINDEX recovery failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`,
    );
    return false;
  }
}

function readRecoverableRows(db, sql, mapper) {
  try {
    return (db.exec(sql)[0]?.values || []).map(mapper);
  } catch (error) {
    console.error(
      `[sqlite] failed to recover rows for query: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

function collectRecoverableSqliteState(db) {
  return {
    logEntries: readRecoverableRows(
      db,
      `SELECT id, created_at, kind, summary, extra_json FROM log_entries`,
      (row) => ({
        id: row[0],
        createdAt: row[1],
        kind: row[2],
        summary: row[3],
        extraJson: row[4] || "",
      }),
    ),
    messages: readRecoverableRows(
      db,
      `SELECT id, created_at, bot_id, target_id, direction, source, text FROM messages`,
      (row) => ({
        id: row[0],
        createdAt: row[1],
        botId: row[2],
        targetId: row[3],
        direction: row[4],
        source: row[5] || "",
        text: row[6] || "",
      }),
    ),
    personalCaptures: readRecoverableRows(
      db,
      `SELECT id, created_at, updated_at, bot_id, target_id, kind, status, text, completed_at, archived_at, extra_json
       FROM personal_captures`,
      (row) => ({
        id: row[0],
        createdAt: row[1],
        updatedAt: row[2],
        botId: row[3],
        targetId: row[4],
        kind: row[5],
        status: row[6],
        text: row[7] || "",
        completedAt: row[8] || "",
        archivedAt: row[9] || "",
        extraJson: row[10] || "",
      }),
    ),
    pendingNotifications: readRecoverableRows(
      db,
      `SELECT id, created_at, bot_id, target_id, source, category, priority, title, content, rendered_text, image_url, file_url, file_name, state, raw_payload_json, extra_json, released_at, release_reason
       FROM pending_notifications`,
      (row) => ({
        id: row[0],
        createdAt: row[1],
        botId: row[2],
        targetId: row[3],
        source: row[4] || "",
        category: row[5] || "",
        priority: row[6] || "",
        title: row[7] || "",
        content: row[8] || "",
        renderedText: row[9] || "",
        imageUrl: row[10] || "",
        fileUrl: row[11] || "",
        fileName: row[12] || "",
        state: row[13] || "",
        rawPayloadJson: row[14] || "",
        extraJson: row[15] || "",
        releasedAt: row[16] || "",
        releaseReason: row[17] || "",
      }),
    ),
    deliveryWindows: readRecoverableRows(
      db,
      `SELECT key, bot_id, target_id, last_user_message_at, proactive_count, last_proactive_message_at, closing_reminder_sent_at, updated_at
       FROM delivery_windows`,
      (row) => ({
        key: row[0],
        botId: row[1],
        targetId: row[2],
        lastUserMessageAt: row[3] || "",
        proactiveCount: Number(row[4] || 0),
        lastProactiveMessageAt: row[5] || "",
        closingReminderSentAt: row[6] || "",
        updatedAt: row[7] || "",
      }),
    ),
  };
}

function restoreRecoverableSqliteState(db, state = {}) {
  db.run("BEGIN");
  try {
    for (const item of state.logEntries || []) {
      db.run(
        `INSERT OR REPLACE INTO log_entries
          (id, created_at, kind, summary, extra_json)
         VALUES (?, ?, ?, ?, ?)`,
        [item.id, item.createdAt, item.kind, item.summary, item.extraJson],
      );
    }

    for (const item of state.messages || []) {
      db.run(
        `INSERT OR REPLACE INTO messages
          (id, created_at, bot_id, target_id, direction, source, text)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.createdAt, item.botId, item.targetId, item.direction, item.source, item.text],
      );
    }

    for (const item of state.personalCaptures || []) {
      db.run(
        `INSERT OR REPLACE INTO personal_captures
          (id, created_at, updated_at, bot_id, target_id, kind, status, text, completed_at, archived_at, extra_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.createdAt,
          item.updatedAt,
          item.botId,
          item.targetId,
          item.kind,
          item.status,
          item.text,
          item.completedAt,
          item.archivedAt,
          item.extraJson,
        ],
      );
    }

    for (const item of state.pendingNotifications || []) {
      db.run(
        `INSERT OR REPLACE INTO pending_notifications
          (id, created_at, bot_id, target_id, source, category, priority, title, content, rendered_text, image_url, file_url, file_name, state, raw_payload_json, extra_json, released_at, release_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.createdAt,
          item.botId,
          item.targetId,
          item.source,
          item.category,
          item.priority,
          item.title,
          item.content,
          item.renderedText,
          item.imageUrl,
          item.fileUrl,
          item.fileName,
          item.state,
          item.rawPayloadJson,
          item.extraJson,
          item.releasedAt,
          item.releaseReason,
        ],
      );
    }

    for (const item of state.deliveryWindows || []) {
      db.run(
        `INSERT OR REPLACE INTO delivery_windows
          (key, bot_id, target_id, last_user_message_at, proactive_count, last_proactive_message_at, closing_reminder_sent_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.key,
          item.botId,
          item.targetId,
          item.lastUserMessageAt,
          item.proactiveCount,
          item.lastProactiveMessageAt,
          item.closingReminderSentAt,
          item.updatedAt,
        ],
      );
    }

    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

async function ensureSqliteDb() {
  if (sqliteState.loaded && sqliteState.db) {
    return sqliteState.db;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  let dbBuffer = null;
  try {
    dbBuffer = await fs.readFile(SQLITE_DB_FILE);
  } catch {
    dbBuffer = null;
  }

  const createDb = (buffer) =>
    buffer?.length ? new SQL.Database(new Uint8Array(buffer)) : new SQL.Database();

  try {
    sqliteState.db = createDb(dbBuffer);
    sqliteState.loaded = true;
    applySqliteSchema(sqliteState.db);
    verifySqliteIntegrity(sqliteState.db);
  } catch (error) {
    if (!dbBuffer?.length || !isRecoverableSqliteError(error)) {
      throw error;
    }

    if (sqliteState.db && tryRepairSqliteDbInPlace(sqliteState.db, error)) {
      await persistSqliteDb();
      return sqliteState.db;
    }

    const recoveredState = sqliteState.db
      ? collectRecoverableSqliteState(sqliteState.db)
      : {
          logEntries: [],
          messages: [],
          personalCaptures: [],
          pendingNotifications: [],
          deliveryWindows: [],
        };

    console.error(
      `[sqlite] detected corrupt database, rebuilding from recoverable state: ${error instanceof Error ? error.message : String(error)}`,
    );
    await backupCorruptSqliteFile(error instanceof Error ? error.message : String(error));
    sqliteState.db = new SQL.Database();
    sqliteState.loaded = true;
    applySqliteSchema(sqliteState.db);
    restoreRecoverableSqliteState(sqliteState.db, recoveredState);
    await persistSqliteDb();
  }

  await persistSqliteDb();
  return sqliteState.db;
}

async function persistSqliteDb() {
  if (!sqliteState.db) {
    return;
  }
  const data = sqliteState.db.export();
  await fs.writeFile(SQLITE_DB_FILE, Buffer.from(data));
}

function parseJsonObject(value) {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function listRecentLogEntries(limit = 10) {
  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT id, created_at, kind, summary, extra_json
     FROM log_entries
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  );
  return (result[0]?.values || []).map((row) => ({
    id: row[0],
    createdAt: row[1],
    kind: row[2],
    summary: row[3],
    ...parseJsonObject(row[4]),
  }));
}

async function listConversationMap(limitPerConversation = MAX_CONVERSATION_ITEMS) {
  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT id, created_at, bot_id, target_id, direction, source, text
     FROM (
       SELECT
         id,
         created_at,
         bot_id,
         target_id,
         direction,
         source,
         text,
         ROW_NUMBER() OVER (
           PARTITION BY bot_id, target_id
           ORDER BY created_at DESC
         ) AS rn
       FROM messages
     )
     WHERE rn <= ?
     ORDER BY bot_id ASC, target_id ASC, created_at ASC`,
    [limitPerConversation],
  );
  const conversations = {};
  for (const row of result[0]?.values || []) {
    const entry = {
      id: row[0],
      createdAt: row[1],
      botId: row[2],
      targetId: row[3],
      direction: row[4],
      source: row[5],
      text: row[6],
    };
    const key = makeTargetKey(entry.botId, entry.targetId);
    conversations[key] = conversations[key] || [];
    conversations[key].push(entry);
  }
  return conversations;
}

function countTextCodePoints(value) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }

  if (typeof Intl?.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text)).length;
  }

  return Array.from(text).length;
}

function isIgnorablePersonalCaptureText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return true;
  }

  return countTextCodePoints(text) <= 1;
}

function normalizePersonalCaptureKind(raw) {
  const value = normalizeCommandAlias(raw);
  const map = {
    "": "inbox",
    inbox: "inbox",
    note: "inbox",
    capture: "inbox",
    收件箱: "inbox",
    未整理: "inbox",
    todo: "todo",
    待做: "todo",
    task: "todo",
    idea: "idea",
    想法: "idea",
    灵感: "idea",
    memo: "memo",
    note_memo: "memo",
    备忘: "memo",
    随手记: "memo",
    便签: "memo",
  };
  return map[value] || "inbox";
}

function normalizePersonalCaptureStatus(raw) {
  const value = normalizeCommandAlias(raw);
  const map = {
    "": "open",
    open: "open",
    todo: "open",
    active: "open",
    未完成: "open",
    进行中: "open",
    done: "done",
    completed: "done",
    已完成: "done",
    完成: "done",
    ignored: "ignored",
    ignore: "ignored",
    忽略: "ignored",
    已忽略: "ignored",
    archived: "archived",
    archive: "archived",
    归档: "archived",
    已归档: "archived",
    archive_box: "archived",
    归档箱: "archived",
  };
  return map[value] || "open";
}

function getPersonalCaptureKindLabel(kind) {
  return PERSONAL_CAPTURE_KIND_LABELS[normalizePersonalCaptureKind(kind)] || "未整理";
}

function getPersonalCaptureStatusLabel(status) {
  return PERSONAL_CAPTURE_STATUS_LABELS[normalizePersonalCaptureStatus(status)] || "未完成";
}

async function appendPersonalCapture({
  botId = "",
  targetId,
  text,
  kind = "inbox",
  status = "open",
  extra = {},
}) {
  const normalizedTargetId = String(targetId || "").trim();
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const content = String(text || "").trim();
  if (!normalizedBotId || !normalizedTargetId || !content) {
    return null;
  }

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    botId: normalizedBotId,
    targetId: normalizedTargetId,
    kind: normalizePersonalCaptureKind(kind),
    status: normalizePersonalCaptureStatus(status),
    text: truncateText(content, 2000),
    completedAt: "",
    archivedAt: "",
    extra,
  };

  const db = await ensureSqliteDb();
  db.run(
    `INSERT INTO personal_captures
      (id, created_at, updated_at, bot_id, target_id, kind, status, text, completed_at, archived_at, extra_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.createdAt,
      entry.updatedAt,
      entry.botId,
      entry.targetId,
      entry.kind,
      entry.status,
      entry.text,
      "",
      "",
      stringifyJson(extra),
    ],
  );
  await persistSqliteDb();
  return entry;
}

async function getPersonalCaptureById(id) {
  const captureId = String(id || "").trim();
  if (!captureId) {
    return null;
  }

  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT id, created_at, updated_at, bot_id, target_id, kind, status, text, completed_at, archived_at, extra_json
     FROM personal_captures
     WHERE id = ?
     LIMIT 1`,
    [captureId],
  );
  const row = result[0]?.values?.[0];
  if (!row) {
    return null;
  }

  return {
    id: row[0],
    createdAt: row[1],
    updatedAt: row[2],
    botId: row[3],
    targetId: row[4],
    kind: row[5],
    status: row[6],
    text: row[7],
    completedAt: row[8] || "",
    archivedAt: row[9] || "",
    extra: parseJsonObject(row[10]),
  };
}

async function updatePersonalCapture(id, patch = {}) {
  const existing = await getPersonalCaptureById(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const nextKind = patch.kind ? normalizePersonalCaptureKind(patch.kind) : existing.kind;
  const nextStatus = patch.status ? normalizePersonalCaptureStatus(patch.status) : existing.status;
  const nextCompletedAt =
    nextStatus === "done"
      ? patch.completedAt || existing.completedAt || now
      : patch.completedAt !== undefined
        ? patch.completedAt || ""
        : existing.completedAt || "";
  const nextArchivedAt =
    nextStatus === "archived"
      ? patch.archivedAt || existing.archivedAt || now
      : patch.archivedAt !== undefined
        ? patch.archivedAt || ""
        : existing.archivedAt || "";
  const nextExtra =
    patch.extra && typeof patch.extra === "object"
      ? { ...(existing.extra || {}), ...patch.extra }
      : existing.extra || {};

  const db = await ensureSqliteDb();
  db.run(
    `UPDATE personal_captures
     SET updated_at = ?, kind = ?, status = ?, completed_at = ?, archived_at = ?, extra_json = ?
     WHERE id = ?`,
    [
      now,
      nextKind,
      nextStatus,
      nextCompletedAt,
      nextArchivedAt,
      stringifyJson(nextExtra),
      existing.id,
    ],
  );
  await persistSqliteDb();
  return {
    ...existing,
    updatedAt: now,
    kind: nextKind,
    status: nextStatus,
    completedAt: nextCompletedAt,
    archivedAt: nextArchivedAt,
    extra: nextExtra,
  };
}

function normalizePersonalCaptureListStatus(raw) {
  const normalized = normalizeCommandAlias(raw);
  if (!normalized || ["open", "todo", "未完成", "进行中"].includes(normalized)) {
    return "open";
  }
  if (["done", "已完成", "完成"].includes(normalized)) {
    return "done";
  }
  if (["ignored", "ignore", "忽略", "已忽略"].includes(normalized)) {
    return "ignored";
  }
  if (["archived", "archive", "归档", "已归档", "归档箱"].includes(normalized)) {
    return "archived";
  }
  if (["all", "全部"].includes(normalized)) {
    return "all";
  }
  return normalizePersonalCaptureStatus(raw);
}

async function listPersonalCaptures({
  botId = "",
  targetId,
  status = "open",
  kind = "",
  limit = PERSONAL_CAPTURE_LIST_LIMIT,
}) {
  const normalizedTargetId = String(targetId || "").trim();
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  if (!normalizedBotId || !normalizedTargetId) {
    return [];
  }

  const normalizedStatus = normalizePersonalCaptureListStatus(status);
  const normalizedKind = kind ? normalizePersonalCaptureKind(kind) : "";
  const db = await ensureSqliteDb();
  const clauses = ["bot_id = ?", "target_id = ?"];
  const params = [normalizedBotId, normalizedTargetId];
  if (normalizedStatus !== "all") {
    clauses.push("status = ?");
    params.push(normalizedStatus);
  }
  if (normalizedKind) {
    clauses.push("kind = ?");
    params.push(normalizedKind);
  }
  clauses.push("1 = 1");
  params.push(limit);
  const result = db.exec(
    `SELECT id, created_at, updated_at, bot_id, target_id, kind, status, text, completed_at, archived_at, extra_json
     FROM personal_captures
     WHERE ${clauses.join(" AND ")}
     ORDER BY
       CASE status
         WHEN 'open' THEN 0
         WHEN 'done' THEN 1
         WHEN 'ignored' THEN 2
         ELSE 3
       END ASC,
       CASE kind
         WHEN 'inbox' THEN 0
         WHEN 'todo' THEN 1
         WHEN 'idea' THEN 2
         ELSE 3
       END ASC,
       created_at DESC
     LIMIT ?`,
    params,
  );

  return (result[0]?.values || []).map((row) => ({
    id: row[0],
    createdAt: row[1],
    updatedAt: row[2],
    botId: row[3],
    targetId: row[4],
    kind: row[5],
    status: row[6],
    text: row[7],
    completedAt: row[8] || "",
    archivedAt: row[9] || "",
    extra: parseJsonObject(row[10]),
  }));
}

async function summarizePersonalCaptureCounts(botId = "", targetId) {
  const normalizedTargetId = String(targetId || "").trim();
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  if (!normalizedBotId || !normalizedTargetId) {
    return {
      total: 0,
      open: 0,
      done: 0,
      archived: 0,
    };
  }

  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT status, COUNT(*)
     FROM personal_captures
     WHERE bot_id = ? AND target_id = ?
     GROUP BY status`,
    [normalizedBotId, normalizedTargetId],
  );
  const summary = {
    total: 0,
    open: 0,
    done: 0,
    ignored: 0,
    archived: 0,
  };
  for (const row of result[0]?.values || []) {
    const status = normalizePersonalCaptureStatus(row[0]);
    const count = Number(row[1] || 0);
    summary[status] = count;
    summary.total += count;
  }
  return summary;
}

function formatPersonalCaptureDigest(entries = []) {
  return entries
    .map((item, index) => {
      const marker = formatBeijingMinute(item.createdAt);
      return `${index + 1}. [${getPersonalCaptureKindLabel(item.kind)}] ${marker} ${truncateText(item.text, 88)}`;
    })
    .join("\n");
}

function buildPersonalCaptureExportText(entries = [], summary = {}) {
  const lines = [
    "这是用户从微信个人收件箱整理出的原始条目。",
    `统计：共 ${summary.total || entries.length} 条，未完成 ${summary.open || 0} 条，已完成 ${summary.done || 0} 条，已忽略 ${summary.ignored || 0} 条，已归档 ${summary.archived || 0} 条。`,
    "",
  ];

  entries.forEach((item, index) => {
    lines.push(
      `${index + 1}. [kind=${item.kind}] [status=${item.status}] [createdAt=${item.createdAt}] [updatedAt=${item.updatedAt}] ${item.text}`,
    );
  });

  return lines.join("\n");
}

function buildPersonalCaptureOpenAiExports({
  botId = "",
  targetId,
  entries = [],
  summary = {},
}) {
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const normalizedTargetId = String(targetId || "").trim();
  const exportText = buildPersonalCaptureExportText(entries, summary);
  const developerPrompt =
    "你是一个个人效率助手。请基于用户从微信收件箱收集的原始条目，整理成待做、想法、备忘和可忽略项，并明确标记哪些只是建议、哪些需要人工确认，不要臆造事实。";

  return {
    schema: "wechat-gateway-personal-captures/v1",
    generatedAt: new Date().toISOString(),
    scope: {
      botId: normalizedBotId,
      targetId: normalizedTargetId,
    },
    summary,
    records: entries.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      kind: item.kind,
      status: item.status,
      text: item.text,
      completedAt: item.completedAt || "",
      archivedAt: item.archivedAt || "",
    })),
    openai: {
      responses: {
        model: "<your-openai-model>",
        instructions: developerPrompt,
        input: [
          {
            role: "user",
            content: exportText,
          },
        ],
      },
      chatCompletions: {
        model: "<your-openai-model>",
        messages: [
          {
            role: "developer",
            content: developerPrompt,
          },
          {
            role: "user",
            content: exportText,
          },
        ],
      },
    },
  };
}

async function importLegacyLogsToSqlite(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }
  const db = await ensureSqliteDb();
  db.run("BEGIN");
  try {
    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const { id, createdAt, kind, summary, ...extra } = item;
      db.run(
        `INSERT OR IGNORE INTO log_entries
          (id, created_at, kind, summary, extra_json)
         VALUES (?, ?, ?, ?, ?)`,
        [
          id || crypto.randomUUID(),
          createdAt || new Date().toISOString(),
          String(kind || "system"),
          String(summary || ""),
          stringifyJson(extra),
        ],
      );
    }
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
  await persistSqliteDb();
}

async function importLegacyConversationsToSqlite(items = {}) {
  if (!items || typeof items !== "object") {
    return;
  }
  const db = await ensureSqliteDb();
  db.run("BEGIN");
  try {
    for (const [conversationKey, list] of Object.entries(items)) {
      const parsedKey = parseTargetKey(conversationKey);
      for (const item of Array.isArray(list) ? list : []) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const botId = normalizeBotId(item.botId) || parsedKey.botId || getDefaultBotId();
        const targetId = String(item.targetId || parsedKey.targetId || "").trim();
        const text = String(item.text || "").trim();
        if (!botId || !targetId || !text) {
          continue;
        }
        db.run(
          `INSERT OR IGNORE INTO messages
            (id, created_at, bot_id, target_id, direction, source, text)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id || crypto.randomUUID(),
            item.createdAt || new Date().toISOString(),
            botId,
            targetId,
            String(item.direction || "outbound"),
            String(item.source || "chat"),
            text,
          ],
        );
      }
    }
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
  await persistSqliteDb();
}

async function appendLog(kind, summary, extra = {}) {
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    kind,
    summary: truncateText(summary, 200),
    ...extra,
  };

  store.logs.items.push(entry);
  if (store.logs.items.length > MAX_LOG_ITEMS) {
    store.logs.items = store.logs.items.slice(-MAX_LOG_ITEMS);
  }

  const db = await ensureSqliteDb();
  db.run(
    `INSERT OR REPLACE INTO log_entries
      (id, created_at, kind, summary, extra_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.createdAt,
      entry.kind,
      entry.summary,
      stringifyJson(extra),
    ],
  );
  await persistSqliteDb();
  console.log(`[${entry.kind}] ${entry.summary}`);
  return entry;
}

async function appendConversationMessage({
  botId = "",
  targetId,
  direction,
  text,
  source = "chat",
}) {
  const normalizedTargetId = targetId?.trim();
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const content = text?.trim();
  if (!normalizedBotId || !normalizedTargetId || !content) {
    return null;
  }

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    botId: normalizedBotId,
    targetId: normalizedTargetId,
    direction,
    source,
    text: truncateText(content, 2000),
  };

  const db = await ensureSqliteDb();
  db.run(
    `INSERT OR REPLACE INTO messages
      (id, created_at, bot_id, target_id, direction, source, text)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.createdAt,
      entry.botId,
      entry.targetId,
      entry.direction,
      entry.source,
      entry.text,
    ],
  );
  await persistSqliteDb();
  return entry;
}

function makeTargetKey(botId, targetId) {
  return `${normalizeBotId(botId)}::${String(targetId || "").trim()}`;
}

function parseTargetKey(value) {
  const text = String(value || "").trim();
  if (!text.includes("::")) {
    return { botId: "", targetId: text };
  }
  const [rawBotId, ...rest] = text.split("::");
  return {
    botId: normalizeBotId(rawBotId),
    targetId: rest.join("::").trim(),
  };
}

async function upsertTarget(botId, targetId) {
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const value = targetId?.trim();
  if (!value) {
    return { isNew: false, target: null };
  }
  if (!normalizedBotId) {
    return { isNew: false, target: null };
  }

  const existing = store.targets.items.find(
    (item) => item.targetId === value && item.botId === normalizedBotId,
  );
  const now = new Date().toISOString();

  if (existing) {
    existing.lastSeenAt = now;
    await writeJson(TARGETS_FILE, store.targets);
    return { isNew: false, target: existing };
  }

  const next = {
    botId: normalizedBotId,
    targetId: value,
    firstSeenAt: now,
    lastSeenAt: now,
  };

  store.targets.items.push(next);
  store.targets.items.sort((a, b) => makeTargetKey(a.botId, a.targetId).localeCompare(makeTargetKey(b.botId, b.targetId), "zh-CN"));
  await writeJson(TARGETS_FILE, store.targets);
  await appendLog("system", `已持久化新的微信目标地址: ${normalizedBotId} -> ${value}`, {
    botId: normalizedBotId,
    targetId: value,
  });
  return { isNew: true, target: next };
}

function getBotById(botId) {
  const normalizedId = normalizeBotId(botId);
  return store.bots.items.find((item) => item.botId === normalizedId) ?? null;
}

function getDefaultBot() {
  return (
    store.bots.items.find((item) => item.enabled !== false && item.isDefaultSender) ??
    store.bots.items.find((item) => item.enabled !== false) ??
    null
  );
}

function getDefaultBotId() {
  return getDefaultBot()?.botId || "";
}

function ensureBotRuntime(botId) {
  const normalizedBotId = normalizeBotId(botId);
  if (!normalizedBotId) {
    return null;
  }

  if (!runtime.bots[normalizedBotId]) {
    runtime.bots[normalizedBotId] = {
      status: "not_logged_in",
      currentAccountId: "",
      qrCodeText: "",
      qrCodeDataUrl: "",
      qrStatus: "",
      qrMessage: "",
      lastError: "",
      loginSessionId: "",
      loginTask: null,
      botTask: null,
      botAbortController: null,
      reconnectTimer: null,
    };
  }

  return runtime.bots[normalizedBotId];
}

function syncLegacyRuntimeFromDefaultBot() {
  const defaultBotId = getDefaultBotId();
  const botRuntime = defaultBotId ? ensureBotRuntime(defaultBotId) : null;
  if (!botRuntime) {
    runtime.status = "not_logged_in";
    runtime.currentAccountId = "";
    runtime.qrCodeText = "";
    runtime.qrCodeDataUrl = "";
    runtime.qrStatus = "";
    runtime.qrMessage = "";
    runtime.lastError = "";
    runtime.loginSessionId = "";
    runtime.loginTask = null;
    runtime.botTask = null;
    runtime.botAbortController = null;
    return;
  }

  runtime.status = botRuntime.status;
  runtime.currentAccountId = botRuntime.currentAccountId;
  runtime.qrCodeText = botRuntime.qrCodeText;
  runtime.qrCodeDataUrl = botRuntime.qrCodeDataUrl;
  runtime.qrStatus = botRuntime.qrStatus;
  runtime.qrMessage = botRuntime.qrMessage;
  runtime.lastError = botRuntime.lastError;
  runtime.loginSessionId = botRuntime.loginSessionId;
  runtime.loginTask = botRuntime.loginTask;
  runtime.botTask = botRuntime.botTask;
  runtime.botAbortController = botRuntime.botAbortController;
}

function buildBotState(bot) {
  const botRuntime = ensureBotRuntime(bot.botId);
  return {
    botId: bot.botId,
    name: bot.name,
    accountId: bot.accountId || botRuntime?.currentAccountId || null,
    enabled: bot.enabled !== false,
    isDefaultSender: bot.isDefaultSender === true,
    createdAt: bot.createdAt || "",
    updatedAt: bot.updatedAt || "",
    status: botRuntime?.status || "not_logged_in",
    qrCodeDataUrl: botRuntime?.qrCodeDataUrl || null,
    qrCodeText: botRuntime?.qrCodeText || null,
    qrStatus: botRuntime?.qrStatus || null,
    message: botRuntime?.qrMessage || "",
    lastError: botRuntime?.lastError || "",
  };
}

async function saveBotsStore() {
  let hasDefault = false;
  store.bots.items = store.bots.items
    .map((item, index) => {
      const normalizedItem = {
        ...item,
        botId: normalizeBotId(item.botId),
      };
      if (!normalizedItem.botId) {
        return null;
      }
      if (normalizedItem.enabled !== false && normalizedItem.isDefaultSender && !hasDefault) {
        hasDefault = true;
      } else {
        normalizedItem.isDefaultSender = false;
      }
      if (!hasDefault && normalizedItem.enabled !== false && index === 0) {
        normalizedItem.isDefaultSender = true;
        hasDefault = true;
      }
      return normalizedItem;
    })
    .filter(Boolean)
    .sort((a, b) => a.botId.localeCompare(b.botId, "zh-CN"));

  await writeJson(BOTS_FILE, store.bots);
  syncLegacyRuntimeFromDefaultBot();
}

function normalizeBotPayload(rawPayload, existing = null) {
  const now = new Date().toISOString();
  const botId = normalizeBotId(rawPayload.botId || rawPayload.id || existing?.botId || "");
  if (!botId) {
    throw new Error("机器人 ID 不能为空，且只能包含字母、数字、中划线和下划线");
  }

  return {
    botId,
    name:
      typeof rawPayload.name === "string" && rawPayload.name.trim()
        ? rawPayload.name.trim()
        : existing?.name || botId,
    accountId:
      typeof rawPayload.accountId === "string"
        ? normalizeAccountId(rawPayload.accountId)
        : existing?.accountId || "",
    enabled:
      typeof rawPayload.enabled === "boolean"
        ? rawPayload.enabled
        : existing?.enabled ?? true,
    isDefaultSender:
      typeof rawPayload.isDefaultSender === "boolean"
        ? rawPayload.isDefaultSender
        : existing?.isDefaultSender ?? botId === "cz",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

async function saveBot(rawPayload) {
  const existing = getBotById(rawPayload.botId || rawPayload.id || "");
  const next = normalizeBotPayload(rawPayload, existing);
  if (existing) {
    Object.assign(existing, next);
  } else {
    store.bots.items.push(next);
  }

  if (next.isDefaultSender) {
    for (const item of store.bots.items) {
      if (item.botId !== next.botId) {
        item.isDefaultSender = false;
      }
    }
  }

  await saveBotsStore();
  await appendLog("system", `机器人已保存: ${next.botId}`, {
    botId: next.botId,
    accountId: next.accountId,
  });
  return getBotById(next.botId);
}

async function deleteBot(botId) {
  const existing = getBotById(botId);
  if (!existing) {
    return false;
  }

  store.bots.items = store.bots.items.filter((item) => item.botId !== existing.botId);
  delete runtime.bots[existing.botId];
  await saveBotsStore();
  await appendLog("system", `机器人已删除: ${existing.botId}`, {
    botId: existing.botId,
  });
  return true;
}

function getUserById(userId) {
  const normalizedId = normalizeUserId(userId);
  return store.users.items.find((item) => item.userId === normalizedId) ?? null;
}

function getUsersByTarget(botId, targetId) {
  const normalizedBotId = normalizeBotId(botId);
  const value = String(targetId || "").trim();
  if (!normalizedBotId || !value) {
    return [];
  }
  return store.users.items.filter((item) =>
    Array.isArray(item.bindings) &&
    item.bindings.some(
      (binding) =>
        normalizeBotId(binding.botId) === normalizedBotId &&
        String(binding.targetId || "").trim() === value,
    ),
  );
}

function normalizeTargetBinding(rawBinding) {
  if (!rawBinding || typeof rawBinding !== "object") {
    return null;
  }
  const botId = normalizeBotId(rawBinding.botId || rawBinding.id || "");
  const targetId = String(rawBinding.targetId || "").trim();
  if (!botId || !targetId) {
    return null;
  }
  return { botId, targetId };
}

function parseTargetBindings(rawPayload, existing = null) {
  const explicitBindings = [];

  if (Array.isArray(rawPayload.bindings)) {
    for (const item of rawPayload.bindings) {
      const normalized = normalizeTargetBinding(item);
      if (normalized) {
        explicitBindings.push(normalized);
      }
    }
  }

  for (const item of parseStringList(rawPayload.targetKeys)) {
    const parsed = parseTargetKey(item);
    const normalized = normalizeTargetBinding(parsed);
    if (normalized) {
      explicitBindings.push(normalized);
    }
  }

  if (!explicitBindings.length) {
    const legacyTargetId =
      typeof rawPayload.targetId === "string"
        ? rawPayload.targetId.trim()
        : existing?.targetId || "";
    const legacyBotId =
      typeof rawPayload.botId === "string"
        ? normalizeBotId(rawPayload.botId)
        : "";
    if (legacyTargetId) {
      explicitBindings.push({
        botId: legacyBotId || getDefaultBotId(),
        targetId: legacyTargetId,
      });
    }
  }

  if (!explicitBindings.length && Array.isArray(existing?.bindings)) {
    return uniqueList(
      existing.bindings
        .map((item) => normalizeTargetBinding(item))
        .filter(Boolean)
        .map((item) => makeTargetKey(item.botId, item.targetId)),
    ).map((item) => parseTargetKey(item));
  }

  return uniqueList(explicitBindings.map((item) => makeTargetKey(item.botId, item.targetId))).map(
    (item) => parseTargetKey(item),
  );
}

async function saveUsersStore() {
  store.users.items.sort((a, b) => a.userId.localeCompare(b.userId, "zh-CN"));
  await writeJson(USERS_FILE, store.users);
}

function normalizeUserPayload(rawPayload, existing = null) {
  const now = new Date().toISOString();
  const userId = normalizeUserId(
    rawPayload.userId || rawPayload.id || rawPayload.name || existing?.userId || "",
  );
  if (!userId) {
    throw new Error("家庭用户 ID 不能为空，且只能包含字母、数字、中划线和下划线");
  }

  return {
    userId,
    name:
      typeof rawPayload.name === "string" && rawPayload.name.trim()
        ? rawPayload.name.trim()
        : existing?.name || userId,
    enabled:
      typeof rawPayload.enabled === "boolean"
        ? rawPayload.enabled
        : existing?.enabled ?? true,
    bindings: parseTargetBindings(rawPayload, existing),
    capabilities: parseCapabilityList(
      rawPayload.capabilities ?? rawPayload.capability ?? existing?.capabilities ?? [],
    ),
    isDefaultRecipient:
      typeof rawPayload.isDefaultRecipient === "boolean"
        ? rawPayload.isDefaultRecipient
        : existing?.isDefaultRecipient ?? userId === "cz",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

async function saveUser(rawPayload) {
  const existing = getUserById(rawPayload.userId || rawPayload.id || "");
  const next = normalizeUserPayload(rawPayload, existing);

  for (const binding of next.bindings) {
    const targetIdConflict = store.users.items.find(
      (item) =>
        item.userId !== next.userId &&
        Array.isArray(item.bindings) &&
        item.bindings.some(
          (existingBinding) =>
            existingBinding.botId === binding.botId &&
            existingBinding.targetId === binding.targetId,
        ),
    );
    if (targetIdConflict) {
      throw new Error(
        `该微信目标已绑定给家庭用户: ${targetIdConflict.userId} (${binding.botId})`,
      );
    }
  }

  if (existing) {
    Object.assign(existing, next);
  } else {
    store.users.items.push(next);
  }

  await saveUsersStore();
  await appendLog("system", `家庭用户已保存: ${next.userId}`, {
    userId: next.userId,
    bindings: next.bindings,
  });
  return next;
}

async function deleteUser(userId) {
  const existing = getUserById(userId);
  if (!existing) {
    return false;
  }
  store.users.items = store.users.items.filter((item) => item.userId !== existing.userId);
  await saveUsersStore();
  await appendLog("system", `家庭用户已删除: ${existing.userId}`, {
    userId: existing.userId,
    bindings: existing.bindings,
  });
  return true;
}

function normalizeBotBindingTargets(bindings, botIds = []) {
  const allowedBotIds = parseBotIdList(botIds);
  const recipients = [];
  for (const binding of bindings || []) {
    const normalized = normalizeTargetBinding(binding);
    if (!normalized) {
      continue;
    }
    if (allowedBotIds.length && !allowedBotIds.includes(normalized.botId)) {
      continue;
    }
    recipients.push({
      botId: normalized.botId,
      targetId: normalized.targetId,
    });
  }
  return recipients;
}

function uniqueRecipients(recipients) {
  const unique = new Map();
  for (const item of recipients || []) {
    if (!item?.botId || !item?.targetId) {
      continue;
    }
    unique.set(makeTargetKey(item.botId, item.targetId), {
      botId: item.botId,
      targetId: item.targetId,
    });
  }
  return Array.from(unique.values());
}

function resolveTargetsForUserIds(userIds, options = {}) {
  const normalizedUserIds = parseUserIdList(userIds);
  const recipients = [];
  const missingUserIds = [];

  for (const userId of normalizedUserIds) {
    const user = getUserById(userId);
    const matchedRecipients =
      user && user.enabled !== false
        ? normalizeBotBindingTargets(user.bindings, options.botIds)
        : [];
    if (!user || !matchedRecipients.length) {
      missingUserIds.push(userId);
      continue;
    }
    recipients.push(...matchedRecipients);
  }

  return {
    recipients: uniqueRecipients(recipients),
    missingUserIds,
  };
}

function resolveTargetsForCapabilities(capabilities, options = {}) {
  const normalizedCapabilities = parseCapabilityList(capabilities);
  const recipients = [];
  const missingCapabilities = [];

  for (const capability of normalizedCapabilities) {
    const matchedUsers = store.users.items.filter(
      (item) =>
        item.enabled !== false &&
        Array.isArray(item.bindings) &&
        item.bindings.length &&
        Array.isArray(item.capabilities) &&
        item.capabilities.includes(capability),
    );

    if (!matchedUsers.length) {
      missingCapabilities.push(capability);
      continue;
    }

    for (const user of matchedUsers) {
      recipients.push(...normalizeBotBindingTargets(user.bindings, options.botIds));
    }

    if (!normalizeBotBindingTargets(matchedUsers.flatMap((item) => item.bindings), options.botIds).length) {
      missingCapabilities.push(capability);
    }
  }

  return {
    recipients: uniqueRecipients(recipients),
    missingCapabilities,
  };
}

function getDefaultRecipients(botIds = []) {
  return uniqueRecipients(
    store.users.items.flatMap((item) =>
      item.enabled !== false && item.isDefaultRecipient
        ? normalizeBotBindingTargets(item.bindings, botIds)
        : [],
    ),
  );
}

function getNotificationRuleById(ruleId) {
  const normalizedId = normalizeNotificationRuleId(ruleId);
  return store.notificationRules.items.find((item) => item.id === normalizedId) ?? null;
}

async function saveNotificationRulesStore() {
  store.notificationRules.items.sort((a, b) => a.id.localeCompare(b.id, "zh-CN"));
  await writeJson(NOTIFICATION_RULES_FILE, store.notificationRules);
}

function mergeDefaultNotificationRules(items = []) {
  const byId = new Map();
  for (const item of items || []) {
    if (item?.id) {
      byId.set(item.id, item);
    }
  }
  for (const item of DEFAULT_NOTIFICATION_RULES) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

function normalizeNotificationRulePayload(rawPayload, existing = null) {
  const now = new Date().toISOString();
  const fallbackId = normalizeNotificationRuleId(
    rawPayload.name || rawPayload.source || existing?.id || crypto.randomUUID(),
  );
  const id = normalizeNotificationRuleId(
    rawPayload.id || rawPayload.ruleId || existing?.id || fallbackId,
  );
  if (!id) {
    throw new Error("通知规则 ID 不能为空");
  }

  return {
    id,
    name:
      typeof rawPayload.name === "string" && rawPayload.name.trim()
        ? rawPayload.name.trim()
        : existing?.name || id,
    source: normalizeNotificationRuleMatch(
      rawPayload.source ?? rawPayload.matchSource ?? existing?.source ?? "",
    ),
    category: normalizeNotificationRuleMatch(
      rawPayload.category ?? rawPayload.event ?? existing?.category ?? "",
    ),
    botIds: parseBotIdList(rawPayload.botIds ?? rawPayload.botId ?? existing?.botIds ?? []),
    keywords: parseNotificationKeywordList(rawPayload.keywords ?? existing?.keywords ?? []),
    userIds: parseUserIdList(rawPayload.userIds ?? rawPayload.userId ?? existing?.userIds ?? []),
    capabilities: parseCapabilityList(
      rawPayload.capabilities ?? rawPayload.capability ?? existing?.capabilities ?? [],
    ),
    allowDefaultRecipient:
      typeof rawPayload.allowDefaultRecipient === "boolean"
        ? rawPayload.allowDefaultRecipient
        : existing?.allowDefaultRecipient ?? true,
    enabled:
      typeof rawPayload.enabled === "boolean"
        ? rawPayload.enabled
        : existing?.enabled ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

async function saveNotificationRule(rawPayload) {
  const existing = getNotificationRuleById(rawPayload.id || rawPayload.ruleId || "");
  const next = normalizeNotificationRulePayload(rawPayload, existing);

  if (existing) {
    Object.assign(existing, next);
  } else {
    store.notificationRules.items.push(next);
  }

  await saveNotificationRulesStore();
  await appendLog("system", `通知规则已保存: ${next.id}`, {
    ruleId: next.id,
  });
  return next;
}

async function deleteNotificationRule(ruleId) {
  const existing = getNotificationRuleById(ruleId);
  if (!existing) {
    return false;
  }

  store.notificationRules.items = store.notificationRules.items.filter(
    (item) => item.id !== existing.id,
  );
  await saveNotificationRulesStore();
  await appendLog("system", `通知规则已删除: ${existing.id}`, {
    ruleId: existing.id,
  });
  return true;
}

function getNotificationRoutingContext(payload, options = {}) {
  const sourceCandidates = uniqueList(
    [
      payload?.source,
      payload?.sourceLabel,
      options.defaultSource,
      options.integrationAlias,
      options.integrationName,
      options.adapterType,
      options.parsed?.sourceLabel,
    ]
      .map((item) => normalizeNotificationRuleMatch(item))
      .filter(Boolean),
  );

  const categoryCandidates = uniqueList(
    [
      payload?.category,
      payload?.event,
      payload?.type,
      options.defaultCategory,
      options.parsed?.event,
    ]
      .map((item) => normalizeNotificationRuleMatch(item))
      .filter(Boolean),
  );

  const haystack = [
    payload?.source,
    payload?.sourceLabel,
    payload?.category,
    payload?.event,
    payload?.title,
    payload?.content,
    options.defaultSource,
    options.integrationAlias,
    options.integrationName,
    options.adapterType,
    options.parsed?.sourceLabel,
    options.parsed?.event,
    options.parsed?.title,
    options.parsed?.content,
  ]
    .map((item) => String(item || "").toLowerCase())
    .join("\n");

  return {
    sourceCandidates,
    categoryCandidates,
    haystack,
  };
}

function matchNotificationRule(rule, payload, options = {}) {
  if (!rule || rule.enabled === false) {
    return false;
  }

  const context = getNotificationRoutingContext(payload, options);
  const hasSourceMatch = rule.source
    ? context.sourceCandidates.includes(rule.source)
    : false;
  const hasKeywordMatch = rule.keywords.length
    ? rule.keywords.some((item) => context.haystack.includes(item))
    : false;

  if (rule.source && rule.keywords.length && !hasSourceMatch && !hasKeywordMatch) {
    return false;
  }
  if (rule.source && !rule.keywords.length && !hasSourceMatch) {
    return false;
  }
  if (!rule.source && rule.keywords.length && !hasKeywordMatch) {
    return false;
  }
  if (rule.category && !context.categoryCandidates.includes(rule.category)) {
    return false;
  }
  if (!rule.source && !rule.keywords.length && !rule.category) {
    return false;
  }

  return true;
}

function resolveRecipientsFromNotificationRules(payload, options = {}) {
  const matchedRules = store.notificationRules.items.filter((item) =>
    matchNotificationRule(item, payload, options),
  );

  if (!matchedRules.length) {
    return {
      matchedRuleIds: [],
      recipients: [],
      allowDefaultRecipient: false,
    };
  }

  const recipients = uniqueList(
    matchedRules.flatMap((rule) =>
      uniqueRecipients([
        ...resolveTargetsForUserIds(rule.userIds, { botIds: rule.botIds }).recipients,
        ...resolveTargetsForCapabilities(rule.capabilities, { botIds: rule.botIds }).recipients,
      ]).map((item) => makeTargetKey(item.botId, item.targetId)),
    ),
  );

  return {
    matchedRuleIds: matchedRules.map((item) => item.id),
    recipients: recipients.map((item) => parseTargetKey(item)),
    botIds: parseBotIdList(matchedRules.flatMap((item) => item.botIds || [])),
    allowDefaultRecipient: matchedRules.some((item) => item.allowDefaultRecipient !== false),
  };
}

function inferCapabilitiesForPassiveNotification(payload, options = {}) {
  if (options.defaultCapabilities?.length) {
    return parseCapabilityList(options.defaultCapabilities);
  }

  const haystack = [
    payload?.source,
    payload?.sourceLabel,
    payload?.event,
    payload?.title,
    payload?.content,
    options.integrationAlias,
    options.integrationName,
  ]
    .map((item) => String(item || "").toLowerCase())
    .join("\n");

  const inferred = [];

  if (/homeassistant|home assistant|\bha\b/.test(haystack)) {
    inferred.push("ha_notice");
  }
  if (/bilisync|bili-sync|b站|up主/.test(haystack)) {
    inferred.push("bili_sync");
  }
  if (/\bops\b|glances|运维|监控|告警/.test(haystack)) {
    inferred.push("ops");
  }
  if (/codex/.test(haystack)) {
    inferred.push("codex");
  }
  if (/jianfei|减肥|体重|热量|步数|饮食/.test(haystack)) {
    inferred.push("diet");
  }
  if (/moviepilot|订阅|入库|下载|影视|mp\b/.test(haystack)) {
    inferred.push("moviepilot");
  }

  return uniqueList(inferred);
}

function getDispatchByCorrelationId(correlationId) {
  return [...store.dispatches.items]
    .reverse()
    .find((item) => item.correlationId === correlationId);
}

async function createDispatchRecord(record) {
  if (!store.dispatches || typeof store.dispatches !== "object") {
    store.dispatches = { items: [] };
  }
  if (!Array.isArray(store.dispatches.items)) {
    store.dispatches.items = [];
  }

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "queued",
    responseSummary: "",
    error: "",
    ...record,
  };

  store.dispatches.items.push(entry);
  if (store.dispatches.items.length > MAX_DISPATCH_ITEMS) {
    store.dispatches.items = store.dispatches.items.slice(-MAX_DISPATCH_ITEMS);
  }

  await writeJson(DISPATCHES_FILE, store.dispatches);
  return entry;
}

async function updateDispatchRecord(correlationId, patch) {
  if (!store.dispatches || typeof store.dispatches !== "object") {
    store.dispatches = { items: [] };
  }
  if (!Array.isArray(store.dispatches.items)) {
    store.dispatches.items = [];
  }

  const item = store.dispatches.items.find(
    (entry) => entry.correlationId === correlationId,
  );
  if (!item) {
    return null;
  }

  Object.assign(item, patch, {
    updatedAt: new Date().toISOString(),
  });
  await writeJson(DISPATCHES_FILE, store.dispatches);
  return item;
}

function getMoviePilotContextBucket(targetId) {
  if (!targetId) return null;
  const bucket = store.commandContexts.items[targetId];
  return bucket && typeof bucket === "object" ? bucket : null;
}

function makePersonalCaptureContextKey(botId, targetId) {
  const key = makeTargetKey(botId, targetId);
  return key ? `personalCapture:${key}` : "";
}

function getMoviePilotIntegrationContextBucket(integrationId) {
  if (!integrationId) return null;
  const bucket = store.commandContexts.items[`integration:${integrationId}`];
  return bucket && typeof bucket === "object" ? bucket : null;
}

function getInteractiveIntegrationSessionBucket(targetId) {
  if (!targetId) return null;
  const bucket = store.commandContexts.items[targetId];
  return bucket && typeof bucket === "object" ? bucket.interactiveIntegration : null;
}

function getPersonalCaptureListContextBucket(botId, targetId) {
  const key = makePersonalCaptureContextKey(botId, targetId);
  if (!key) return null;
  const bucket = store.commandContexts.items[key];
  return bucket && typeof bucket === "object" ? bucket.personalCaptureList : null;
}

async function saveMoviePilotContext(targetId, integrationId, patch) {
  if (!targetId) return;

  const now = new Date().toISOString();
  const current = getMoviePilotContextBucket(targetId) || {};
  store.commandContexts.items[targetId] = {
    ...current,
    ...patch,
    updatedAt: now,
  };

  if (integrationId) {
    const integrationCurrent = getMoviePilotIntegrationContextBucket(integrationId) || {};
    store.commandContexts.items[`integration:${integrationId}`] = {
      ...integrationCurrent,
      ...patch,
      updatedAt: now,
    };
  }

  await writeJson(COMMAND_CONTEXTS_FILE, store.commandContexts);
}

function validateMoviePilotContext(context) {
  if (!context || typeof context !== "object") {
    return null;
  }

  if (context.expiresAt) {
    const expiresAt = new Date(context.expiresAt).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
      return null;
    }
  }

  return context;
}

function validateInteractiveIntegrationSession(session) {
  if (!session || typeof session !== "object" || !session.integrationId) {
    return null;
  }

  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
      return null;
    }
  }

  return session;
}

async function saveInteractiveIntegrationSession(targetId, integrationId) {
  if (!targetId || !integrationId) return;

  const now = new Date().toISOString();
  const current = getMoviePilotContextBucket(targetId) || {};
  store.commandContexts.items[targetId] = {
    ...current,
    interactiveIntegration: {
      integrationId,
      createdAt: current.interactiveIntegration?.createdAt || now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + COMMAND_CONTEXT_TTL_MS).toISOString(),
    },
  };

  await writeJson(COMMAND_CONTEXTS_FILE, store.commandContexts);
}

async function clearInteractiveIntegrationSession(targetId) {
  if (!targetId) return;

  const current = getMoviePilotContextBucket(targetId);
  if (!current?.interactiveIntegration) {
    return;
  }

  const next = { ...current };
  delete next.interactiveIntegration;

  if (Object.keys(next).length) {
    store.commandContexts.items[targetId] = next;
  } else {
    delete store.commandContexts.items[targetId];
  }

  await writeJson(COMMAND_CONTEXTS_FILE, store.commandContexts);
}

function validatePersonalCaptureListContext(context) {
  if (!context || typeof context !== "object" || !Array.isArray(context.items)) {
    return null;
  }

  if (context.expiresAt) {
    const expiresAt = new Date(context.expiresAt).getTime();
    if (!Number.isNaN(expiresAt) && expiresAt < Date.now()) {
      return null;
    }
  }

  return context;
}

async function savePersonalCaptureListContext(botId, targetId, items = [], view = "open") {
  const key = makePersonalCaptureContextKey(botId, targetId);
  if (!key) return;
  const now = new Date().toISOString();
  const current = store.commandContexts.items[key] || {};
  store.commandContexts.items[key] = {
    ...current,
    personalCaptureList: {
      items: Array.isArray(items)
        ? items.map((item) => ({
            id: item.id,
            kind: item.kind,
            status: item.status,
            createdAt: item.createdAt,
          }))
        : [],
      view,
      createdAt: current.personalCaptureList?.createdAt || now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + COMMAND_CONTEXT_TTL_MS).toISOString(),
    },
  };

  await writeJson(COMMAND_CONTEXTS_FILE, store.commandContexts);
}

function getActiveInteractiveIntegration(targetId) {
  const session = validateInteractiveIntegrationSession(
    getInteractiveIntegrationSessionBucket(targetId),
  );
  if (!session) {
    return null;
  }

  const integration = getIntegrationById(session.integrationId);
  if (!integration || !integration.enabled) {
    return null;
  }

  return supportsInteractiveIntegrationSession(integration.adapterType) &&
    !isAiSubtitleIntegration(integration)
    ? integration
    : null;
}

function getValidMoviePilotContext(targetId, integrationId, key) {
  const direct = validateMoviePilotContext(getMoviePilotContextBucket(targetId)?.[key]);
  if (direct) {
    return direct;
  }

  if ((store.targets.items?.length || 0) <= 1 && integrationId) {
    return validateMoviePilotContext(
      getMoviePilotIntegrationContextBucket(integrationId)?.[key],
    );
  }

  return null;
}

async function getSavedAccountIds() {
  const data = await readJson(OPENCLAW_ACCOUNT_INDEX_FILE, []);
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());
}

async function getPrimaryAccountId() {
  const ids = await getSavedAccountIds();
  return ids[0] ?? "";
}

function getBotAccountId(botId) {
  return getBotById(botId)?.accountId || "";
}

function getAccountFilePath(accountId) {
  return path.join(OPENCLAW_ACCOUNT_DIR, `${normalizeAccountId(accountId)}.json`);
}

async function readWeixinAccount(accountId) {
  if (!accountId) {
    return null;
  }

  const normalizedId = normalizeAccountId(accountId);
  const account = await readJson(getAccountFilePath(normalizedId), null);
  if (!account?.token) {
    return null;
  }

  return {
    accountId: normalizedId,
    token: String(account.token),
    baseUrl: account.baseUrl?.trim() || store.config.baseUrl || DEFAULT_API_BASE_URL,
    userId: account.userId?.trim() || "",
    cdnBaseUrl: DEFAULT_CDN_BASE_URL,
  };
}

async function saveWeixinAccount(loginResult, botId = "") {
  const normalizedId = normalizeAccountId(loginResult.accountId);
  const payload = {
    token: loginResult.botToken,
    baseUrl: loginResult.baseUrl || store.config.baseUrl || DEFAULT_API_BASE_URL,
    userId: loginResult.userId || "",
    savedAt: new Date().toISOString(),
  };

  await writeJson(getAccountFilePath(normalizedId), payload);
  const savedIds = await getSavedAccountIds();
  await writeJson(OPENCLAW_ACCOUNT_INDEX_FILE, uniqueList([...savedIds, normalizedId]));

  const normalizedBotId = normalizeBotId(botId);
  if (normalizedBotId) {
    const bot = await saveBot({
      botId: normalizedBotId,
      accountId: normalizedId,
    });
    const botRuntime = ensureBotRuntime(bot.botId);
    if (botRuntime) {
      botRuntime.currentAccountId = normalizedId;
      botRuntime.status = "logged_in";
      syncLegacyRuntimeFromDefaultBot();
    }
  } else {
    runtime.currentAccountId = normalizedId;
  }
  return normalizedId;
}

async function getActiveAccount(botId = "") {
  const normalizedBotId = normalizeBotId(botId);
  const accountId =
    (normalizedBotId ? getBotAccountId(normalizedBotId) : "") ||
    (normalizedBotId ? ensureBotRuntime(normalizedBotId)?.currentAccountId || "" : "") ||
    runtime.currentAccountId ||
    getBotAccountId(getDefaultBotId()) ||
    (await getPrimaryAccountId());
  const account = await readWeixinAccount(accountId);
  if (account) {
    if (normalizedBotId) {
      const botRuntime = ensureBotRuntime(normalizedBotId);
      if (botRuntime) {
        botRuntime.currentAccountId = account.accountId;
      }
    }
    runtime.currentAccountId = account.accountId;
    syncLegacyRuntimeFromDefaultBot();
  }
  return account;
}

function buildWeixinHeaders(body, token) {
  const headers = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "Content-Length": String(Buffer.byteLength(body, "utf-8")),
    "X-WECHAT-UIN": randomWechatUin(),
  };

  if (token?.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  return headers;
}

async function weixinApiRequest({
  endpoint,
  payload,
  token,
  baseUrl,
  timeoutMs = 15_000,
  label,
}) {
  const url = new URL(endpoint, ensureTrailingSlash(baseUrl));
  const body = JSON.stringify({
    ...payload,
    base_info: buildBaseInfo(),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      url,
      withOptionalProxy(url, {
        method: "POST",
        headers: buildWeixinHeaders(body, token),
        body,
        signal: controller.signal,
      }),
    );

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`${label} ${response.status}: ${rawText}`);
    }

    return rawText;
  } finally {
    clearTimeout(timer);
  }
}

async function weixinApiJson(options) {
  const rawText = await weixinApiRequest(options);
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function buildTextItem(text) {
  return {
    type: MessageItemType.TEXT,
    text_item: {
      text,
    },
  };
}

function buildImageItem(uploaded) {
  return {
    type: MessageItemType.IMAGE,
    image_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aesKeyHex).toString("base64"),
        encrypt_type: 1,
      },
      mid_size: uploaded.fileSizeCiphertext,
    },
  };
}

function buildFileItem(uploaded) {
  return {
    type: MessageItemType.FILE,
    file_item: {
      media: {
        encrypt_query_param: uploaded.downloadEncryptedQueryParam,
        aes_key: Buffer.from(uploaded.aesKeyHex).toString("base64"),
        encrypt_type: 1,
      },
      file_name: uploaded.fileName,
      len: String(uploaded.fileSize),
    },
  };
}

function getFileExtension(fileName = "") {
  const extension = path.extname(String(fileName || "").trim()).toLowerCase();
  return extension.startsWith(".") ? extension.slice(1) : extension;
}

function normalizeOutboundFileName(fileName = "", fallback = "attachment.bin") {
  const raw = path.basename(String(fileName || "").trim()) || fallback;
  return raw.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 180) || fallback;
}

function inferFileNameFromUrl(fileUrl = "") {
  try {
    const pathname = new URL(String(fileUrl || "")).pathname;
    const decoded = decodeURIComponent(path.basename(pathname));
    return normalizeOutboundFileName(decoded);
  } catch {
    return "";
  }
}

function shouldZipCompressFile(fileName = "") {
  const extension = getFileExtension(fileName);
  return extension ? COMPRESSIBLE_FILE_EXTENSIONS.has(extension) : false;
}

function isKnownLowCompressionFile(fileName = "") {
  const extension = getFileExtension(fileName);
  return extension ? NON_COMPRESSIBLE_FILE_EXTENSIONS.has(extension) : false;
}

async function createZipBufferFromFile({ buffer, fileName }) {
  const zipFile = new yazl.ZipFile();
  const outputChunks = [];
  const normalizedEntryName = normalizeOutboundFileName(fileName, "attachment.bin");

  return new Promise((resolve, reject) => {
    zipFile.outputStream.on("data", (chunk) => outputChunks.push(chunk));
    zipFile.outputStream.on("end", () => resolve(Buffer.concat(outputChunks)));
    zipFile.outputStream.on("error", reject);

    zipFile.addBuffer(buffer, normalizedEntryName, { compress: true });
    zipFile.end();
  });
}

async function sendWeixinItems({ account, to, items, contextToken = "", label }) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }

  const payload = {
    msg: {
      from_user_id: "",
      to_user_id: to,
      client_id: createClientId(),
      message_type: MessageType.BOT,
      message_state: MessageState.FINISH,
      item_list: items,
      context_token: contextToken || undefined,
    },
  };

  await weixinApiRequest({
    endpoint: "ilink/bot/sendmessage",
    payload,
    token: account.token,
    baseUrl: account.baseUrl,
    label,
  });
}

async function sendWeixinText({ account, to, text, contextToken = "" }) {
  const content = text?.trim();
  if (!content) {
    return;
  }

  await sendWeixinItems({
    account,
    to,
    contextToken,
    label: "sendText",
    items: [buildTextItem(content)],
  });
}

async function sendWeixinImage({ account, to, uploaded, contextToken = "" }) {
  if (!uploaded) {
    return;
  }

  await sendWeixinItems({
    account,
    to,
    contextToken,
    label: "sendImage",
    items: [buildImageItem(uploaded)],
  });
}

async function sendWeixinFile({ account, to, uploaded, contextToken = "" }) {
  if (!uploaded) {
    return;
  }

  await sendWeixinItems({
    account,
    to,
    contextToken,
    label: "sendFile",
    items: [buildFileItem(uploaded)],
  });
}

function encryptAesEcb(buffer, key) {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
}

function aesEcbPaddedSize(plainTextSize) {
  return Math.ceil((plainTextSize + 1) / 16) * 16;
}

function buildCdnUploadUrl({ uploadParam, fileKey, cdnBaseUrl }) {
  return `${cdnBaseUrl}/upload?encrypted_query_param=${encodeURIComponent(
    uploadParam,
  )}&filekey=${encodeURIComponent(fileKey)}`;
}

function resolveWeixinUploadUrl({ uploadParam, uploadFullUrl, fileKey, cdnBaseUrl }) {
  const directUrl = String(uploadFullUrl || "").trim();
  if (directUrl) {
    return directUrl;
  }

  const encryptedParam = String(uploadParam || "").trim();
  if (!encryptedParam) {
    return "";
  }

  return buildCdnUploadUrl({
    uploadParam: encryptedParam,
    fileKey,
    cdnBaseUrl,
  });
}

function getProxyDispatcher(targetUrl) {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
  if (!httpsProxy) return undefined;

  // 检查 NO_PROXY 规则
  const noProxy = (process.env.NO_PROXY || "").split(",").map(s => s.trim()).filter(Boolean);
  try {
    const hostname = new URL(targetUrl).hostname;
    for (const rule of noProxy) {
      if (hostname === rule || hostname.endsWith(`.${rule}`)) return undefined;
    }
  } catch { /* 忽略 URL 解析失败 */ }

  return new ProxyAgent(httpsProxy);
}

function withOptionalProxy(targetUrl, options = {}) {
  const lookupTarget =
    targetUrl instanceof URL ? targetUrl.toString() : String(targetUrl);
  const dispatcher = getProxyDispatcher(lookupTarget);
  return dispatcher ? { ...options, dispatcher } : options;
}

async function fetchRemoteBinary(url) {
  const dispatcher = getProxyDispatcher(url);
  const fetchOptions = dispatcher ? { dispatcher } : {};
  console.log(`[fetchRemoteBinary] 下载: ${url} (代理: ${dispatcher ? '是' : '直连'})`);

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(
      `远程媒体下载失败: ${response.status} ${response.statusText} (${url})`,
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "",
  };
}

async function fetchRemoteFileResource(fileUrl, fileName = "") {
  const remote = await fetchRemoteBinary(fileUrl);
  return {
    buffer: remote.buffer,
    contentType: remote.contentType,
    fileName: normalizeOutboundFileName(fileName || inferFileNameFromUrl(fileUrl) || "attachment.bin"),
    sourceUrl: String(fileUrl || "").trim(),
  };
}

async function getWeixinUploadUrl({
  account,
  to,
  rawSize,
  rawFileMd5,
  fileSize,
  fileKey,
  aesKeyHex,
  mediaType = UploadMediaType.IMAGE,
}) {
  return weixinApiJson({
    endpoint: "ilink/bot/getuploadurl",
    payload: {
      filekey: fileKey,
      media_type: mediaType,
      to_user_id: to,
      rawsize: rawSize,
      rawfilemd5: rawFileMd5,
      filesize: fileSize,
      no_need_thumb: true,
      aeskey: aesKeyHex,
    },
    token: account.token,
    baseUrl: account.baseUrl,
    label: "getUploadUrl",
  });
}

async function uploadBufferToCdn({ buffer, uploadUrl, aesKey }) {
  const encrypted = encryptAesEcb(buffer, aesKey);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        uploadUrl,
        withOptionalProxy(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: new Uint8Array(encrypted),
        }),
      );

      if (response.status >= 400 && response.status < 500) {
        const detail = response.headers.get("x-error-message") || (await response.text());
        throw new Error(`CDN 上传被拒绝: ${response.status} ${detail}`);
      }

      if (response.status !== 200) {
        const detail = response.headers.get("x-error-message") || response.statusText;
        throw new Error(`CDN 上传异常: ${response.status} ${detail}`);
      }

      const downloadEncryptedQueryParam =
        response.headers.get("x-encrypted-param") || "";
      if (!downloadEncryptedQueryParam) {
        throw new Error("CDN 上传成功但缺少 x-encrypted-param");
      }

      return downloadEncryptedQueryParam;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(500);
      }
    }
  }

  throw lastError ?? new Error("CDN 上传失败");
}

async function uploadBufferToWeixin({
  account,
  to,
  buffer,
  mediaType = UploadMediaType.IMAGE,
}) {
  const rawSize = buffer.length;
  const rawFileMd5 = crypto.createHash("md5").update(buffer).digest("hex");
  const fileSize = aesEcbPaddedSize(rawSize);
  const fileKey = crypto.randomBytes(16).toString("hex");
  const aesKey = crypto.randomBytes(16);
  const aesKeyHex = aesKey.toString("hex");

  const uploadInfo = await getWeixinUploadUrl({
    account,
    to,
    rawSize,
    rawFileMd5,
    fileSize,
    fileKey,
    aesKeyHex,
    mediaType,
  });

  const uploadUrl = resolveWeixinUploadUrl({
    uploadParam: uploadInfo?.upload_param,
    uploadFullUrl: uploadInfo?.upload_full_url,
    fileKey,
    cdnBaseUrl: account.cdnBaseUrl,
  });
  if (!uploadUrl) {
    throw new Error("微信未返回 upload_param 或 upload_full_url，无法发送图片");
  }

  const downloadEncryptedQueryParam = await uploadBufferToCdn({
    buffer,
    uploadUrl,
    aesKey,
  });

  return {
    fileKey,
    fileSize,
    fileSizeCiphertext: fileSize,
    aesKeyHex,
    downloadEncryptedQueryParam,
  };
}

async function uploadImageFromUrlToWeixin({ account, to, imageUrl }) {
  const remote = await fetchRemoteBinary(imageUrl);
  return {
    ...(await uploadBufferToWeixin({
      account,
      to,
      buffer: remote.buffer,
      mediaType: UploadMediaType.IMAGE,
    })),
    sourceContentType: remote.contentType,
  };
}

async function uploadFileAttachmentToWeixin({ account, to, buffer, fileName }) {
  return {
    ...(await uploadBufferToWeixin({
      account,
      to,
      buffer,
      mediaType: UploadMediaType.FILE,
    })),
    fileName: normalizeOutboundFileName(fileName, "attachment.bin"),
  };
}

async function sendWeixinTextAndImage({
  account,
  to,
  text,
  imageUrl,
  contextToken = "",
}) {
  const content = text?.trim();
  const uploaded = await uploadImageFromUrlToWeixin({ account, to, imageUrl });
  if (content) {
    await sendWeixinText({
      account,
      to,
      text: content,
      contextToken,
    });
  }
  await sendWeixinImage({
    account,
    to,
    uploaded,
    contextToken,
  });
}

async function sendWeixinTextAndFile({
  account,
  to,
  text,
  file,
  contextToken = "",
}) {
  const content = text?.trim();
  if (content) {
    await sendWeixinText({
      account,
      to,
      text: content,
      contextToken,
    });
  }
  await sendWeixinFile({
    account,
    to,
    uploaded: file,
    contextToken,
  });
}

async function fetchQrCode() {
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(store.config.botType)}`,
    ensureTrailingSlash(store.config.baseUrl),
  );

  const response = await fetch(url, withOptionalProxy(url));
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`获取二维码失败: ${response.status} ${detail}`);
  }

  return response.json();
}

async function pollQrStatus(qrCodeToken) {
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrCodeToken)}`,
    ensureTrailingSlash(store.config.baseUrl),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QR_POLL_TIMEOUT_MS);

  try {
    const response = await fetch(
      url,
      withOptionalProxy(url, {
        headers: {
          "iLink-App-ClientVersion": "1",
        },
        signal: controller.signal,
      }),
    );
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`二维码状态轮询失败: ${response.status} ${rawText}`);
    }

    return JSON.parse(rawText);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "wait" };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function applyQrCode(botId, qrResponse, message = "请使用微信扫码登录") {
  const botRuntime = ensureBotRuntime(botId);
  if (!botRuntime) {
    return;
  }
  botRuntime.qrCodeText = qrResponse.qrcode_img_content || "";
  botRuntime.qrCodeDataUrl = botRuntime.qrCodeText
    ? await QRCode.toDataURL(botRuntime.qrCodeText, {
        margin: 1,
        width: 300,
      })
    : "";
  botRuntime.qrStatus = "wait";
  botRuntime.qrMessage = message;
  syncLegacyRuntimeFromDefaultBot();
}

function clearQrCode(botId) {
  const botRuntime = ensureBotRuntime(botId);
  if (!botRuntime) {
    return;
  }
  botRuntime.qrCodeText = "";
  botRuntime.qrCodeDataUrl = "";
  botRuntime.qrStatus = "";
  botRuntime.qrMessage = "";
  syncLegacyRuntimeFromDefaultBot();
}

async function stopBotMonitor(botId = "") {
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const botRuntime = ensureBotRuntime(normalizedBotId);
  if (!botRuntime) {
    return;
  }

  if (botRuntime.reconnectTimer) {
    clearTimeout(botRuntime.reconnectTimer);
    botRuntime.reconnectTimer = null;
  }

  if (botRuntime.botAbortController) {
    botRuntime.botAbortController.abort();
    botRuntime.botAbortController = null;
  }
  syncLegacyRuntimeFromDefaultBot();
}

async function scheduleBotRestart(botId = "") {
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const botRuntime = ensureBotRuntime(normalizedBotId);
  if (!botRuntime || botRuntime.reconnectTimer) {
    return;
  }

  botRuntime.reconnectTimer = setTimeout(() => {
    botRuntime.reconnectTimer = null;
    void startBotMonitor(normalizedBotId);
  }, BOT_RETRY_DELAY_MS);
}

function buildIntegrationState(integration) {
  const urls = buildIntegrationUrls(integration);
  return {
    ...integration,
    adapterLabel: ADAPTER_LABELS[integration.adapterType] || integration.adapterType,
    effectiveCommandAliases: getEffectiveCommandAliases(integration),
    maskedIncomingToken: maskToken(integration.incomingToken),
    maskedReplyToken: maskToken(integration.replyToken),
    ...urls,
  };
}

function getEnabledIntegrations() {
  return store.integrations.items.filter((item) => item.enabled);
}

const CONNECTIVITY_TARGETS = [
  { id: "tmdb_image", label: "TMDB 图片 CDN", url: "https://image.tmdb.org/t/p/w92/wwemzKWzjKYJFfCeiB57q3r4Bcm.png", method: "HEAD" },
  { id: "thetvdb", label: "TheTVDB", url: "https://thetvdb.com", method: "HEAD" },
  { id: "fanart", label: "Fanart.tv", url: "https://fanart.tv", method: "HEAD" },
  { id: "github", label: "GitHub", url: "https://github.com", method: "HEAD" },
  { id: "ghcr", label: "GitHub Container", url: "https://ghcr.io", method: "HEAD" },
  { id: "dockerhub", label: "Docker Hub", url: "https://hub.docker.com", method: "HEAD" },
  { id: "baidu", label: "百度", url: "https://www.baidu.com", method: "HEAD" },
  { id: "bilibili", label: "Bilibili", url: "https://www.bilibili.com", method: "HEAD" },
  { id: "google", label: "Google", url: "https://www.google.com/generate_204", method: "GET" },
  { id: "telegram", label: "Telegram API", url: "https://api.telegram.org", method: "HEAD" },
  { id: "openai", label: "OpenAI API", url: "https://api.openai.com", method: "HEAD" },
  { id: "cloudflare", label: "Cloudflare", url: "https://1.1.1.1/cdn-cgi/trace", method: "GET" },
  { id: "pypi", label: "PyPI", url: "https://pypi.org", method: "HEAD" },
];

function formatElapsedDuration(startedAt) {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) {
    return "-";
  }

  let remainingSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const days = Math.floor(remainingSeconds / 86_400);
  remainingSeconds -= days * 86_400;
  const hours = Math.floor(remainingSeconds / 3_600);
  remainingSeconds -= hours * 3_600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds - minutes * 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || (!days && !hours)) parts.push(`${seconds}s`);
  return parts.slice(0, 3).join(" ");
}

function formatGatewayCommandSummary() {
  return [
    "常用命令",
    "查状态：状态",
    "看版本：版本",
    "看连通：连通",
    "影视帮助：mp",
    "字幕帮助：zm",
    "随手记：dz",
    "收不到通知时：直接回复 1",
    "更多命令：helpall",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatGatewayCommandDetailSummary() {
  const integrationLines = getEnabledIntegrations()
    .map((item) => {
      if (isVideoDownloaderAdapter(item.adapterType)) {
        return "";
      }
      const aliases = getEffectiveCommandAliases(item);
      if (!aliases.length) {
        return "";
      }
      const label = item.name || item.alias || item.adapterType;
      const example =
        item.adapterType === "moviepilot-rest" || aliases.includes("mp")
          ? "例如：mp / mp 搜索 关键字"
          : "";
      return [
        `${label}：${aliases.join(", ")}`,
        example,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean);

  return [
    "详细命令",
    "",
    "基础命令",
    "ping         查看网关是否在线",
    "ip           查看当前局域网 IP",
    "状态         查看当前状态",
    "版本         查看版本和运行时长",
    "集成         查看已启用集成",
    "连通         检查外部连通性",
    "help         常用命令",
    "helpall      详细命令",
    "",
    "通知恢复",
    "收不到通知时：直接回复任意内容，例如 1",
    "如果看到最后 1 条提醒，回复后即可继续接收",
    "",
    "字幕命令",
    "zm                 显示字幕帮助",
    "zm <链接>          生成字幕",
    "zm md <链接>       输出 Markdown",
    "zm word <链接>     输出 Word",
    "zm md word <链接>  同时输出 Markdown 和 Word",
    "zm 下载 <链接>     只下载视频",
    "zm 音频 <链接>     提取音频并回传微信",
    "",
    "个人收件箱",
    "dz                  查看未完成条目",
    "dz help             查看 dz 帮助",
    "dz all              查看全部条目",
    "dz ai <要求>        让 AI 处理当前 dz 列表",
    "dz 导出             查看导出和 AI 接口说明",
    "待做                同 dz",
    "",
    integrationLines.length ? "集成命令" : "",
    ...integrationLines,
  ]
    .filter(Boolean)
    .join("\n");
}

async function runConnectivityChecks() {
  const results = await Promise.all(
    CONNECTIVITY_TARGETS.map(async (target) => {
      try {
        const dispatcher = getProxyDispatcher(target.url);
        const start = Date.now();
        const response = await fetch(target.url, {
          method: target.method,
          ...(dispatcher ? { dispatcher } : {}),
          signal: AbortSignal.timeout(10_000),
          redirect: "follow",
        });
        return {
          id: target.id,
          label: target.label,
          ok: response.status < 500,
          status: response.status,
          proxy: !!dispatcher,
          ms: Date.now() - start,
        };
      } catch (error) {
        return {
          id: target.id,
          label: target.label,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          proxy: !!(process.env.HTTPS_PROXY || process.env.HTTP_PROXY),
          ms: -1,
        };
      }
    }),
  );

  const passCount = results.filter((item) => item.ok).length;
  return {
    ok: passCount === results.length,
    passCount,
    total: results.length,
    results,
  };
}

function formatConnectivityCommandResult(summary) {
  const measureWidth = (value) =>
    Array.from(String(value || "")).reduce(
      (total, char) => total + (/[\u0000-\u00ff]/.test(char) ? 1 : 2),
      0,
    );
  const padLabel = (label, width) => {
    const diff = Math.max(0, width - measureWidth(label));
    return `${label}${" ".repeat(diff + 2)}`;
  };
  const labelWidth = Math.max(...summary.results.map((item) => measureWidth(item.label)), 0);

  return [
    `${summary.ok ? "连通性正常" : "连通性异常"}：${summary.passCount}/${summary.total} 项通过`,
    ...summary.results.map((item) =>
      `${(item.ok ? "OK" : "FAIL").padEnd(5)}${padLabel(item.label, labelWidth)}${
        item.ms >= 0 ? `${item.ms}ms` : "timeout"
      }${
        item.ok ? "" : `  ${item.error || `HTTP ${item.status ?? "?"}`}`
      }`,
    ),
  ].join("\n");
}

function formatIntegrationsCommandResult() {
  const enabled = getEnabledIntegrations();
  if (!enabled.length) {
    return "当前无启用集成。";
  }

  return [
    `启用集成：${enabled.length}`,
    ...enabled.slice(0, 8).map((item) => {
      const aliases = getEffectiveCommandAliases(item).join(", ") || "-";
      return `${item.name} | ${ADAPTER_LABELS[item.adapterType] || item.adapterType} | 命令: ${aliases}`;
    }),
  ].join("\n");
}

function getIntegrationById(id) {
  const normalizedId = normalizeIntegrationId(id);
  return store.integrations.items.find((item) => item.id === normalizedId) ?? null;
}

function getIntegrationByAlias(alias) {
  const normalizedAlias = normalizeIntegrationAlias(alias);
  return store.integrations.items.find((item) => item.alias === normalizedAlias) ?? null;
}

function findIntegrationsByCommandAlias(commandAlias) {
  const normalizedAlias = normalizeCommandAlias(commandAlias);
  return getEnabledIntegrations().filter((integration) =>
    getEffectiveCommandAliases(integration).includes(normalizedAlias),
  );
}

function readProvidedToken(req) {
  const header = req.get("authorization") || "";
  const [, headerToken = ""] = header.match(/^Bearer\s+(.+)$/i) || [];
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  const bodyToken = typeof req.body?.token === "string" ? req.body.token : "";
  return headerToken || queryToken || bodyToken;
}

function requireExpectedToken(req, res, expectedToken, label) {
  const providedToken = readProvidedToken(req);
  if (!providedToken) {
    res.status(401).json({
      error: `缺少 ${label}，请在 Header 携带 Authorization 或在 URL 追加 ?token=`,
    });
    return false;
  }

  if (!safeEqual(providedToken, expectedToken)) {
    res.status(401).json({ error: `${label} 无效` });
    return false;
  }

  return true;
}

function normalizeIntegrationPayload(rawPayload, existing = null) {
  const now = new Date().toISOString();
  const alias = normalizeIntegrationAlias(
    rawPayload.alias || rawPayload.name || existing?.alias || "",
  );
  if (!alias) {
    throw new Error("集成别名不能为空，且只能包含字母、数字和中划线");
  }
  const normalizedAlias = normalizeCommandAlias(alias);
  if (RESERVED_COMMANDS.has(normalizedAlias)) {
    throw new Error(`集成别名不能使用保留关键字: ${alias}`);
  }

  const commandAliases = uniqueList(
    parseStringList(rawPayload.commandAliases)
      .map((item) => normalizeCommandAlias(item))
      .filter(Boolean),
  );
  const reservedAlias = commandAliases.find((item) => RESERVED_COMMANDS.has(item));
  if (reservedAlias) {
    throw new Error(`命令别名不能使用保留关键字: ${reservedAlias}`);
  }

  const outgoingUrl =
    typeof rawPayload.outgoingUrl === "string"
      ? rawPayload.outgoingUrl.trim()
      : existing?.outgoingUrl || "";
  if (outgoingUrl) {
    try {
      new URL(outgoingUrl);
    } catch {
      throw new Error("外发 Webhook URL 格式无效");
    }
  }

  return {
    id: existing?.id || crypto.randomUUID(),
    name:
      pickFirstString(rawPayload.name, existing?.name, alias) || alias,
    alias,
    adapterType: normalizeAdapterType(rawPayload.adapterType || existing?.adapterType),
    enabled:
      typeof rawPayload.enabled === "boolean"
        ? rawPayload.enabled
        : existing?.enabled ?? true,
    incomingToken:
      pickFirstString(rawPayload.incomingToken, existing?.incomingToken) ||
      createWebhookToken(),
    replyToken:
      pickFirstString(rawPayload.replyToken, existing?.replyToken) ||
      createWebhookToken(),
    outgoingUrl,
    outgoingBearerToken: pickFirstString(
      rawPayload.outgoingBearerToken,
      existing?.outgoingBearerToken,
    ),
    commandAliases,
    defaultTargetIds: parseStringList(rawPayload.defaultTargetIds),
    notes: pickFirstString(rawPayload.notes, existing?.notes),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

async function saveIntegration(rawPayload) {
  const integrationId = normalizeIntegrationId(rawPayload.id || "");
  const existing = integrationId ? getIntegrationById(integrationId) : null;
  const next = normalizeIntegrationPayload(rawPayload, existing);
  const aliasConflict = store.integrations.items.find(
    (item) => item.alias === next.alias && item.id !== next.id,
  );
  if (aliasConflict) {
    throw new Error(`集成别名 ${next.alias} 已存在`);
  }

  if (existing) {
    Object.assign(existing, next);
  } else {
    store.integrations.items.push(next);
  }

  store.integrations.items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  await writeJson(INTEGRATIONS_FILE, store.integrations);
  await appendLog("system", `集成配置已保存: ${next.name}`, {
    integrationId: next.id,
  });
  return next;
}

async function deleteIntegration(id) {
  const existing = getIntegrationById(id);
  if (!existing) {
    return false;
  }

  store.integrations.items = store.integrations.items.filter((item) => item.id !== id);
  await writeJson(INTEGRATIONS_FILE, store.integrations);
  await appendLog("system", `集成配置已删除: ${existing.name}`, {
    integrationId: existing.id,
  });
  return true;
}

function buildOutboundReplyWebhookUrl(integration) {
  return buildIntegrationUrls(integration).replyUrl;
}

async function callOutgoingIntegration({
  integration,
  botId = "",
  targetId,
  rawText,
  commandText,
  source = "wechat-command",
}) {
  if (!integration.outgoingUrl) {
    throw new Error("该集成尚未配置外发 Webhook URL");
  }

  const correlationId = crypto.randomUUID();
  const payload = {
    correlationId,
    integrationId: integration.id,
    integrationAlias: integration.alias,
    source: "wechat",
    botId: normalizeBotId(botId) || getDefaultBotId(),
    targetId,
    rawText,
    commandText,
    receivedAt: new Date().toISOString(),
    replyWebhookUrl: buildOutboundReplyWebhookUrl(integration),
  };

  await createDispatchRecord({
    correlationId,
    integrationId: integration.id,
    integrationAlias: integration.alias,
    integrationName: integration.name,
    botId: normalizeBotId(botId) || getDefaultBotId(),
    targetId,
    rawText,
    commandText,
    source,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OUTGOING_WEBHOOK_TIMEOUT_MS);

  try {
    const headers = {
      "Content-Type": "application/json",
      "X-WeChat-Gateway-Correlation-Id": correlationId,
    };
    if (integration.outgoingBearerToken) {
      headers.Authorization = `Bearer ${integration.outgoingBearerToken}`;
    }

    const dispatcher = getProxyDispatcher(integration.outgoingUrl);
    const response = await fetch(integration.outgoingUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    const rawResponse = await response.text();
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${truncateText(rawResponse || response.statusText, 300)}`,
      );
    }

    await updateDispatchRecord(correlationId, {
      status: "accepted",
      responseSummary: truncateText(rawResponse || "accepted", 200),
    });
    await appendLog(
      "system",
      `微信命令已转发到 ${integration.name}: ${truncateText(commandText || rawText, 120)}`,
      {
        botId: normalizeBotId(botId) || getDefaultBotId(),
        targetId,
        integrationId: integration.id,
        correlationId,
      },
    );
    return {
      correlationId,
      accepted: true,
      responseSummary: truncateText(rawResponse || "accepted", 200),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDispatchRecord(correlationId, {
      status: "failed",
      error: message,
    });
    throw new Error(`转发到 ${integration.name} 失败: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function callVideoDownloaderIntegration({
  integration,
  botId = "",
  targetId,
  rawText,
  commandText,
  source = "wechat-command",
}) {
  if (!integration.outgoingUrl) {
    throw new Error("该集成尚未配置外发 Webhook URL");
  }

  const correlationId = crypto.randomUUID();
  const payload = {
    correlationId,
    integrationId: integration.id,
    integrationAlias: integration.alias,
    source: "wechat",
    botId: normalizeBotId(botId) || getDefaultBotId(),
    targetId,
    rawText,
    commandText,
    receivedAt: new Date().toISOString(),
    replyWebhookUrl: buildOutboundReplyWebhookUrl(integration),
  };

  await createDispatchRecord({
    correlationId,
    integrationId: integration.id,
    integrationAlias: integration.alias,
    integrationName: integration.name,
    botId: normalizeBotId(botId) || getDefaultBotId(),
    targetId,
    rawText,
    commandText,
    source,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OUTGOING_WEBHOOK_TIMEOUT_MS);

  try {
    const headers = {
      "Content-Type": "application/json",
      "X-WeChat-Gateway-Correlation-Id": correlationId,
    };
    if (integration.outgoingBearerToken) {
      headers.Authorization = `Bearer ${integration.outgoingBearerToken}`;
    }

    const dispatcher = getProxyDispatcher(integration.outgoingUrl);
    const response = await fetch(integration.outgoingUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    });
    const rawResponse = await response.text();
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${truncateText(rawResponse || response.statusText, 300)}`,
      );
    }

    const parsedResponse = parseJsonText(rawResponse) || {};
    const replyText =
      pickFirstString(
        parsedResponse.replyText,
        parsedResponse.message,
        parsedResponse.summary,
      ) || truncateText(rawResponse || "accepted", 500);
    const sessionAction = normalizeCommandAlias(parsedResponse.sessionAction || "activate");
    const suppressWeixinReply = parsedResponse.suppressWeixinReply === true;

    await updateDispatchRecord(correlationId, {
      status: "accepted",
      responseSummary: truncateText(replyText || rawResponse || "accepted", 200),
    });
    await appendLog(
      "system",
      `视频命令已转发到 ${integration.name}: ${truncateText(commandText || rawText, 120)}`,
      {
        botId: normalizeBotId(botId) || getDefaultBotId(),
        targetId,
        integrationId: integration.id,
        correlationId,
      },
    );
    return {
      correlationId,
      accepted: true,
      responseSummary: truncateText(replyText || rawResponse || "accepted", 200),
      replyText,
      sessionAction,
      suppressWeixinReply,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDispatchRecord(correlationId, {
      status: "failed",
      error: message,
    });
    throw new Error(`转发到 ${integration.name} 失败: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function getMoviePilotBaseUrl(integration) {
  const outgoingUrl = pickFirstString(integration.outgoingUrl);
  if (!outgoingUrl) {
    throw new Error("MoviePilot base URL is not configured.");
  }

  let parsed;
  try {
    parsed = new URL(outgoingUrl);
  } catch {
    throw new Error("MoviePilot URL is invalid.");
  }

  return `${parsed.protocol}//${parsed.host}`;
}

function getMoviePilotToken(integration) {
  const directToken = pickFirstString(integration.outgoingBearerToken);
  if (directToken) {
    return directToken;
  }

  const outgoingUrl = pickFirstString(integration.outgoingUrl);
  if (!outgoingUrl) {
    return "";
  }

  try {
    return new URL(outgoingUrl).searchParams.get("token")?.trim() || "";
  } catch {
    return "";
  }
}

function getMoviePilotSource(integration) {
  return normalizeCommandAlias(integration.alias || "clawbot") || "clawbot";
}

async function moviePilotApiRequest({
  integration,
  endpoint,
  method = "GET",
  query = {},
  body = undefined,
}) {
  const baseUrl = getMoviePilotBaseUrl(integration);
  const token = getMoviePilotToken(integration);
  if (!token) {
    throw new Error("MoviePilot token is not configured.");
  }

  const url = new URL(endpoint, ensureTrailingSlash(baseUrl));
  url.searchParams.set("token", token);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const dispatcher = getProxyDispatcher(url.toString());
  const headers = {};
  let requestBody = undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody,
    ...(dispatcher ? { dispatcher } : {}),
  });
  const rawText = await response.text();
  let parsed = rawText;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // keep text
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === "object"
        ? parsed.message || safeJsonPreview(parsed, 400)
        : truncateText(String(parsed || response.statusText), 400);
    throw new Error(`MoviePilot API ${response.status}: ${detail}`);
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.prototype.hasOwnProperty.call(parsed, "success") &&
    parsed.success === false
  ) {
    throw new Error(parsed.message || "MoviePilot API returned success=false");
  }

  return parsed;
}

function unwrapMoviePilotResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if (Object.prototype.hasOwnProperty.call(payload, "data")) {
      return payload.data;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "value")) {
      return payload.value;
    }
  }

  return payload;
}

function pickMoviePilotTitle(item) {
  return (
    pickFirstString(
      item?.title,
      item?.name,
      item?.title_year,
      item?.original_title,
      item?.site_name,
    ) || "Untitled"
  );
}

function pickMoviePilotYear(item) {
  return pickFirstString(item?.year, item?.release_date, item?.first_air_date);
}

function pickMoviePilotMediaId(item) {
  return (
    pickFirstString(
      item?.media_id,
      item?.mediaid,
      item?.id && item?.tmdb_id ? `tmdb:${item.tmdb_id}` : "",
      item?.tmdb_id ? `tmdb:${item.tmdb_id}` : "",
      item?.tmdbid ? `tmdb:${item.tmdbid}` : "",
      item?.douban_id ? `douban:${item.douban_id}` : "",
      item?.doubanid ? `douban:${item.doubanid}` : "",
      item?.bangumi_id ? `bangumi:${item.bangumi_id}` : "",
      item?.bangumiid ? `bangumi:${item.bangumiid}` : "",
    ) || "-"
  );
}

function buildMoviePilotContext(targetId, query, items, extra = {}) {
  return {
    targetId,
    query,
    items: Array.isArray(items) ? items : [],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + COMMAND_CONTEXT_TTL_MS).toISOString(),
    ...extra,
  };
}

function parsePositiveIndex(rawValue) {
  const value = String(rawValue || "").trim();
  if (!/^\d+$/.test(value)) return null;
  const index = Number.parseInt(value, 10);
  return index > 0 ? index : null;
}

function parseMoviePilotIndex(rawValue) {
  return parsePositiveIndex(rawValue);
}

function mapMoviePilotAction(rawAction) {
  const action = normalizeCommandAlias(rawAction);
  const map = {
    "": "help",
    help: "help",
    "\u5e2e\u52a9": "help",
    media: "search_media",
    search: "search_media",
    "\u641c\u7d22": "search_media",
    person: "search_person",
    "\u4eba\u7269": "search_person",
    detail: "detail",
    "\u8be6\u60c5": "detail",
    torrent: "torrent",
    "\u7247\u6e90": "torrent",
    "\u8d44\u6e90": "torrent",
    exact: "exact",
    "\u7cbe\u786e": "exact",
    download: "download",
    "\u4e0b\u8f7d": "download",
    subscribe: "subscribe",
    "\u8ba2\u9605": "subscribe",
    follow: "follow",
    "\u8ffd\u66f4": "follow",
    unsubscribe: "unsubscribe",
    "\u53d6\u6d88\u8ba2\u9605": "unsubscribe",
    list: "sub_list",
    "\u8ba2\u9605\u5217\u8868": "sub_list",
    refresh: "sub_refresh",
    "\u5237\u65b0\u8ba2\u9605": "sub_refresh",
    check: "sub_check",
    "\u68c0\u67e5\u8ba2\u9605": "sub_check",
    stop: "stop",
    "\u505c\u6b62": "stop",
    "\u4e2d\u6b62": "stop",
  };
  return map[action] || action;
}

function splitCompactMoviePilotCommand(text) {
  const compact = String(text || "").trim();
  const match = compact.match(/^(\u5e2e\u52a9|\u641c\u7d22|\u8be6\u60c5|\u7247\u6e90|\u8d44\u6e90|\u4e0b\u8f7d|\u8ba2\u9605|\u8ffd\u66f4|\u53d6\u6d88\u8ba2\u9605|\u505c\u6b62|\u4e2d\u6b62)(.+)$/u);
  if (!match) {
    return null;
  }

  return {
    action: match[1],
    rest: String(match[2] || "").trim(),
  };
}

function formatMoviePilotResponse(payload, fallbackTitle = "MoviePilot") {
  const data = unwrapMoviePilotResponse(payload);
  if (typeof data === "string" && data.trim()) {
    return `${fallbackTitle}\n${data.trim()}`;
  }
  if (Array.isArray(data)) {
    return `${fallbackTitle}\n${safeJsonPreview(data, 1200)}`;
  }
  if (data && typeof data === "object") {
    return `${fallbackTitle}\n${safeJsonPreview(data, 1200)}`;
  }
  if (payload && typeof payload === "object") {
    return `${fallbackTitle}\n${safeJsonPreview(payload, 1200)}`;
  }
  return `${fallbackTitle}\nDone.`;
}


function formatMoviePilotMediaResults(items, label, queryText, options = {}) {
  const list = Array.isArray(items) ? items.slice(0, 6) : [];
  if (!list.length) {
    return `${label}\n\u672a\u627e\u5230\u7ed3\u679c\uff1a${queryText}`;
  }

  const lines = [`${label}`, `Query: ${queryText}`];
  for (const [index, item] of list.entries()) {
    const title = pickMoviePilotTitle(item);
    const year = pickMoviePilotYear(item);
    const mediaId = pickMoviePilotMediaId(item);
    const typeName = pickFirstString(item?.type, item?.type_name, item?.media_type);
    lines.push(
      `${index + 1}. ${title}${year ? ` (${year.slice(0, 4)})` : ""}${
        typeName ? ` [${typeName}]` : ""
      }`,
    );
    lines.push(`   id: ${mediaId}`);
  }

  if (options.includeHints !== false) {
    const kinds = new Set(list.map((item) => getMoviePilotMediaKind(item)).filter(Boolean));
    if (kinds.size) {
      lines.push("");
      if (kinds.has("movie")) {
        lines.push("\u7535\u5f71\u63a8\u8350\uff1amp \u7247\u6e90 <\u7f16\u53f7>");
      }
      if (kinds.has("tv")) {
        lines.push("\u7535\u89c6\u5267\u63a8\u8350\uff1amp \u8ba2\u9605 <\u7f16\u53f7> \u6216 mp \u8ffd\u66f4 <\u7f16\u53f7>");
      }
    }
  }

  return lines.join("\n");
}

function formatMoviePilotTorrentResults(items, queryText, options = {}) {
  const list = Array.isArray(items) ? items.slice(0, 6) : [];
  if (!list.length) {
    if (options.targetKind === "tv") {
      return [
        "\u7247\u6e90\u7ed3\u679c",
        `\u8be5\u7535\u89c6\u5267\u5728 MoviePilot \u516c\u5f00\u641c\u7d22\u63a5\u53e3\u4e0b\u672a\u627e\u5230\u53ef\u7528\u7247\u6e90\uff1a${queryText}`,
        "\u5efa\u8bae\u76f4\u63a5\uff1a",
        "1. mp \u8ba2\u9605 <\u7f16\u53f7>",
        "2. mp \u8ffd\u66f4 <\u7f16\u53f7>",
        "3. mp \u505c\u6b62",
      ].join("\n");
    }

    return [
      "\u7247\u6e90\u7ed3\u679c",
      `\u672a\u641c\u7d22\u5230\u4efb\u4f55\u8d44\u6e90\uff1a${queryText}`,
      "\u53ef\u5c1d\u8bd5\uff1a",
      "1. mp \u7247\u6e90 \u5176\u5b83\u7f16\u53f7",
      "2. mp \u505c\u6b62",
      "3. mp \u641c\u7d22 \u65b0\u5173\u952e\u8bcd",
    ].join("\n");
  }

  const lines = ["\u7247\u6e90\u7ed3\u679c", `\u76ee\u6807: ${queryText}`];
  for (const [index, item] of list.entries()) {
    const torrent =
      item?.torrent_info && typeof item.torrent_info === "object"
        ? item.torrent_info
        : item;
    const meta =
      item?.meta_info && typeof item.meta_info === "object" ? item.meta_info : {};
    const title =
      pickFirstString(
        torrent?.title,
        meta?.title,
        meta?.org_string,
        meta?.name,
        torrent?.description,
      ) || "Untitled";
    const siteName = pickFirstString(torrent?.site_name, torrent?.site);
    const size = torrent?.size ? `${torrent.size}` : "";
    const seeders = torrent?.seeders ?? "";
    lines.push(`${index + 1}. ${title}`);
    lines.push(
      `   ${[
        siteName ? `site=${siteName}` : "",
        size ? `size=${size}` : "",
        seeders !== "" ? `seed=${seeders}` : "",
      ]
        .filter(Boolean)
        .join(" | ")}`,
    );
  }
  return lines.join("\n");
}

function getMoviePilotTorrentPayload(item) {
  if (item?.torrent_info && typeof item.torrent_info === "object") {
    return item.torrent_info;
  }
  return item;
}

function getMoviePilotMediaPayload(item) {
  if (item?.media_info && typeof item.media_info === "object") {
    return item.media_info;
  }
  return item;
}

function formatMoviePilotSubscriptionItem(item) {
  if (!item || typeof item !== "object") {
    return "\u672a\u627e\u5230\u8ba2\u9605\u3002";
  }

  return [
    "\u8ba2\u9605\u8be6\u60c5",
    `id: ${item.id ?? "-"}`,
    `name: ${pickFirstString(item.name) || "-"}`,
    `year: ${pickFirstString(item.year) || "-"}`,
    `type: ${pickFirstString(item.type) || "-"}`,
    `mediaid: ${pickMoviePilotMediaId(item)}`,
    `season: ${item.season ?? "-"}`,
    `state: ${pickFirstString(item.state) || "-"}`,
    `updated: ${pickFirstString(item.last_update, item.date) || "-"}`,
  ].join("\n");
}

function formatMoviePilotSubscriptionList(items) {
  const list = Array.isArray(items) ? items.slice(0, 10) : [];
  if (!list.length) {
    return "\u8ba2\u9605\u5217\u8868\n\u5f53\u524d\u6ca1\u6709\u8ba2\u9605\u3002";
  }

  const lines = ["\u8ba2\u9605\u5217\u8868"];
  for (const item of list) {
    const seasonText = item?.season ? ` S${String(item.season).padStart(2, "0")}` : "";
    lines.push(
      `${item.id ?? "-"} | ${pickFirstString(item.name) || "-"}${
        pickFirstString(item.year) ? ` (${pickFirstString(item.year)})` : ""
      }${seasonText} | ${pickFirstString(item.state) || "-"} | ${pickMoviePilotMediaId(item)}`,
    );
  }
  return lines.join("\n");
}

function formatMoviePilotExistingSubscription(item, options = {}) {
  const followStyle = options.followStyle === true;
  return [
    followStyle ? "\u5df2\u5b58\u5728\u8ffd\u66f4\u8ba2\u9605" : "\u5df2\u5b58\u5728\u8ba2\u9605",
    `id: ${item.id ?? "-"}`,
    `\u540d\u79f0: ${pickFirstString(item.name) || "-"}`,
    `\u5e74\u4efd: ${pickFirstString(item.year) || "-"}`,
    item?.season ? `\u5b63: S${String(item.season).padStart(2, "0")}` : "",
    `\u72b6\u6001: ${pickFirstString(item.state) || "-"}`,
    `\u66f4\u65b0\u65f6\u95f4: ${pickFirstString(item.last_update, item.date) || "-"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function resolveMoviePilotMediaSelection(targetId, integrationId, token) {
  const mediaContext = getValidMoviePilotContext(
    targetId,
    integrationId,
    "moviepilotMediaSearch",
  );
  if (!mediaContext) {
    throw new Error("\u6ca1\u6709\u6700\u8fd1\u4e00\u6b21\u641c\u7d22\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u53d1\u9001 mp \u641c\u7d22 <\u5173\u952e\u8bcd>\u3002");
  }

  const index = parseMoviePilotIndex(token);
  if (index === null) {
    const direct = mediaContext.items.find((item) => pickMoviePilotMediaId(item) === token);
    if (direct) {
      return direct;
    }
    throw new Error("\u5a92\u4f53\u9009\u62e9\u65e0\u6548\uff0c\u8bf7\u4f7f\u7528\u7ed3\u679c\u7f16\u53f7\uff0c\u4f8b\u5982 mp \u8be6\u60c5 1\u3002");
  }

  const item = mediaContext.items[index - 1];
  if (!item) {
    throw new Error(`\u672a\u627e\u5230\u7b2c ${index} \u6761\u641c\u7d22\u7ed3\u679c\u3002`);
  }
  return item;
}

function resolveMoviePilotTorrentSelection(targetId, integrationId, token) {
  const torrentContext = getValidMoviePilotContext(
    targetId,
    integrationId,
    "moviepilotTorrentSearch",
  );
  if (!torrentContext) {
    throw new Error("\u6ca1\u6709\u6700\u8fd1\u4e00\u6b21\u7247\u6e90\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u53d1\u9001 mp \u7247\u6e90 <\u7f16\u53f7>\u3002");
  }

  const index = parseMoviePilotIndex(token);
  if (index === null) {
    throw new Error("\u7247\u6e90\u9009\u62e9\u65e0\u6548\uff0c\u8bf7\u4f7f\u7528\u7ed3\u679c\u7f16\u53f7\uff0c\u4f8b\u5982 mp \u4e0b\u8f7d 1\u3002");
  }

  const item = torrentContext.items[index - 1];
  if (!item) {
    throw new Error(`\u672a\u627e\u5230\u7b2c ${index} \u6761\u7247\u6e90\u7ed3\u679c\u3002`);
  }
  return {
    torrent: item,
    media: torrentContext.mediaItem || null,
  };
}

function formatMoviePilotHelpText() {
  return [
    "MoviePilot \u5e38\u7528\u547d\u4ee4",
    "mp                 \u663e\u793a\u8fd9\u4efd\u5e2e\u52a9",
    "mp \u641c\u7d22 <\u5173\u952e\u8bcd>   \u641c\u7d22\u5a92\u4f53",
    "mp \u8be6\u60c5 <\u7f16\u53f7>     \u67e5\u770b\u641c\u7d22\u7ed3\u679c\u8be6\u60c5",
    "mp \u7247\u6e90 <\u7f16\u53f7>     \u7535\u5f71\u4f18\u5148\u4f7f\u7528\uff1b\u7535\u89c6\u5267\u4ec5\u5c3d\u529b\u641c\u7d22",
    "mp \u4e0b\u8f7d <\u7f16\u53f7>     \u4e0b\u8f7d\u4e0a\u4e00\u8f6e\u7247\u6e90\u7ed3\u679c\u4e2d\u7684\u67d0\u9879",
    "mp \u8ba2\u9605 <\u7f16\u53f7>     \u8ba2\u9605\u4e0a\u4e00\u8f6e\u641c\u7d22\u7ed3\u679c\u4e2d\u7684\u67d0\u9879",
    "mp \u8ffd\u66f4 <\u7f16\u53f7>     \u7535\u89c6\u5267\u4e3b\u63a8\u8350\uff0c\u7b49\u4ef7\u4e8e mp \u8ba2\u9605 <\u7f16\u53f7>",
    "mp \u53d6\u6d88\u8ba2\u9605 <\u7f16\u53f7|mediaid>",
    "mp \u8ba2\u9605\u5217\u8868",
    "mp \u5237\u65b0\u8ba2\u9605",
    "mp \u68c0\u67e5\u8ba2\u9605",
    "mp \u505c\u6b62           \u6e05\u7a7a\u5f53\u524d MP \u641c\u7d22/\u7247\u6e90\u4e0a\u4e0b\u6587",
    "mp \u4e2d\u6b62           \u540c mp \u505c\u6b62",
    "\u63d0\u793a\uff1a\u7535\u5f71\u4f18\u5148\u7528\u7247\u6e90/\u4e0b\u8f7d\uff0c\u7535\u89c6\u5267\u4f18\u5148\u7528\u8ba2\u9605/\u8ffd\u66f4\u3002",
  ].join("\n");
}

function formatSubtitleHelpText() {
  return [
    "AI 字幕常用命令",
    "zm                 显示这份帮助",
    "zm <链接>          生成字幕",
    "zm md <链接>       输出 Markdown",
    "zm word <链接>     输出 Word",
    "zm md word <链接>  同时输出 Markdown 和 Word",
    "zm 下载 <链接>     只下载视频",
    "zm 音频 <链接>     提取音频并回传微信",
    "提示：支持写成 zm下载<链接>、zm音频<链接> 这类紧凑格式。",
  ].join("\n");
}

function formatPersonalCaptureHelpText() {
  return [
    "个人收件箱常用命令",
    "dz                  查看未完成条目",
    "dz help             查看 dz 帮助",
    "dz all              查看全部条目",
    "dz ai <要求>        让 AI 处理当前 dz 列表",
    "dz 导出             查看 OpenAI 兼容导出说明",
    "待做                同 dz",
    "自动收录规则：非命令、且不是单字符的入站文本会自动进入收件箱。",
    "提示：先发 dz 或 dz all 看列表，再发 dz ai ... 处理“第几条”。",
  ].join("\n");
}

function mapPersonalCaptureAction(rawAction) {
  const action = normalizeCommandAlias(rawAction);
  const map = {
    "": "list_open",
    help: "help",
    "\u5e2e\u52a9": "help",
    all: "list_all",
    "\u5168\u90e8": "list_all",
    export: "export",
    "\u5bfc\u51fa": "export",
  };
  return map[action] || action;
}

function parsePersonalCaptureCommand(commandText) {
  const trimmed = String(commandText || "").trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  let body = "";
  if (trimmed === "\u5f85\u505a" || lower === PERSONAL_CAPTURE_COMMAND_ALIAS) {
    body = "";
  } else if (lower === "todo") {
    body = "";
  } else if (trimmed.startsWith("\u5f85\u505a ")) {
    body = trimmed.slice(2).trim();
  } else if (lower.startsWith(`${PERSONAL_CAPTURE_COMMAND_ALIAS} `)) {
    body = trimmed.slice(PERSONAL_CAPTURE_COMMAND_ALIAS.length).trim();
  } else if (lower.startsWith("todo ")) {
    body = trimmed.slice(4).trim();
  } else {
    return null;
  }

  if (!body) {
    return { action: "list_open", rest: "" };
  }

  const mapped = mapPersonalCaptureAction(body);
  if (mapped === "help" || mapped === "list_all" || mapped === "export") {
    return {
      action: mapped,
      rest: "",
    };
  }

  let aiRest = body;
  const lowered = body.toLowerCase();
  if (lowered.startsWith("ai ")) {
    aiRest = body.slice(2).trim();
  } else if (lowered === "ai") {
    aiRest = "";
  } else {
    return {
      action: "ai_required",
      rest: body,
    };
  }

  return {
    action: "ai_apply",
    rest: aiRest,
  };
}

function formatPersonalCaptureViewLabel(view) {
  const normalized = normalizePersonalCaptureListStatus(view);
  if (normalized === "done") {
    return "已完成";
  }
  if (normalized === "ignored") {
    return "已忽略";
  }
  if (normalized === "archived") {
    return "已归档";
  }
  if (normalized === "all") {
    return "全部";
  }
  return "未完成";
}

function buildPersonalCaptureListText(entries = [], view = "open", summary = {}) {
  const lines = [
    `个人收件箱（${formatPersonalCaptureViewLabel(view)}）`,
    `未完成 ${summary.open || 0} 条，已完成 ${summary.done || 0} 条，已忽略 ${summary.ignored || 0} 条，已归档 ${summary.archived || 0} 条`,
  ];

  if (!entries.length) {
    lines.push("", "当前没有符合条件的条目。");
  } else {
    const grouped = new Map();
    for (const item of entries) {
      const key = `${item.status}:${item.kind}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          label:
            view === "done" || view === "archived" || view === "all"
              ? `${getPersonalCaptureStatusLabel(item.status)} / ${getPersonalCaptureKindLabel(item.kind)}`
              : getPersonalCaptureKindLabel(item.kind),
          items: [],
        });
      }
      grouped.get(key).items.push(item);
    }

    let counter = 1;
    for (const group of grouped.values()) {
      lines.push("", group.label);
      for (const item of group.items) {
        const createdLabel = formatBeijingMinute(item.createdAt) || item.createdAt || "-";
        const updatedLabel = formatBeijingMinute(item.updatedAt) || item.updatedAt || createdLabel;
        lines.push(
          `${counter}. ${truncateText(item.text, 72)} | 接收 ${createdLabel} | 更新 ${updatedLabel}`,
        );
        counter += 1;
      }
    }
  }

  return lines.join("\n");
}

function buildPersonalCaptureDetailText(item) {
  return [
    "个人收件箱详情",
    `类型: ${getPersonalCaptureKindLabel(item.kind)}`,
    `状态: ${getPersonalCaptureStatusLabel(item.status)}`,
    `接收于: ${formatBeijingMinute(item.createdAt) || item.createdAt}`,
    `更新于: ${formatBeijingMinute(item.updatedAt) || item.updatedAt}`,
    item.completedAt ? `完成于: ${formatBeijingMinute(item.completedAt) || item.completedAt}` : "",
    item.status === "ignored" ? "说明: 当前这条已被标记为忽略。" : "",
    item.archivedAt ? `归档于: ${formatBeijingMinute(item.archivedAt) || item.archivedAt}` : "",
    "",
    item.text,
    "",
    "可继续操作：dz 完成 <编号> / dz 忽略 <编号> / dz 待做 <编号> / dz 想法 <编号> / dz 备忘 <编号> / dz 归档 <编号>",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPersonalCaptureExportUrls(botId = "", targetId, status = "open") {
  const baseUrl = getFallbackPublicBaseUrl();
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const normalizedTargetId = String(targetId || "").trim();
  if (!baseUrl || !normalizedBotId || !normalizedTargetId) {
    return null;
  }

  const buildUrl = (format) => {
    const url = new URL("/api/personal-captures/export", baseUrl);
    url.searchParams.set("botId", normalizedBotId);
    url.searchParams.set("targetId", normalizedTargetId);
    url.searchParams.set("status", status);
    url.searchParams.set("format", format);
    return url.toString();
  };

  return {
    raw: buildUrl("json"),
    markdown: buildUrl("markdown"),
    responses: buildUrl("openai-responses"),
    chat: buildUrl("openai-chat"),
  };
}

function buildPersonalCaptureExportHelpText(botId = "", targetId, summary = {}) {
  const urls = buildPersonalCaptureExportUrls(botId, targetId, "open");
  const lines = [
    "个人收件箱导出",
    `当前未完成 ${summary.open || 0} 条，可导出给 AI 做整理分析。`,
    "已预留 OpenAI 兼容格式：Responses API 和 Chat Completions。",
  ];

  if (!urls) {
    lines.push(
      "当前未生成可访问导出链接。请先确保控制台 Public Base URL 可用，或直接调用 /api/personal-captures/export。",
    );
  } else {
    lines.push(
      "",
      `OpenAI Responses: ${urls.responses}`,
      `OpenAI Chat: ${urls.chat}`,
      `Markdown: ${urls.markdown}`,
      `原始 JSON: ${urls.raw}`,
    );
  }

  return lines.join("\n");
}

function buildPersonalCaptureAiPrompt(taskText, entries = [], summary = {}, view = "open") {
  const lines = [
    "你是个人待做整理助手。",
    "你的任务是根据用户自然语言要求，对下面这些条目给出结构化判断或操作。",
    "只能返回 JSON，不要返回 Markdown，不要解释。",
    "你可以修改的字段只有：kind, status。",
    "kind 只允许：inbox, todo, idea, memo。",
    "status 只允许：open, done, ignored, archived。",
    "如果无法确定，请保持原样，不要输出该条 action。",
    "如果用户要求判断哪些已完成、哪些应忽略、哪些只是想法，请基于文本语义尽量给出高置信度判断。",
    "用户可能会在要求里提到“第3条”“第5条”这类编号，编号以当前列表顺序为准。",
    "如果用户说“去掉第2条”“删除第3条”“把这条忽略”，优先理解为对当前列表已有条目的操作，而不是新增一条内容。",
    "如果用户引用了某条消息的部分正文或时间戳，你可以结合 text / received_at / updated_at 去定位。",
    "若用户意图是删除，请优先把 status 设为 ignored；当前不要真实物理删除。",
    `当前总数：${summary.total || entries.length}，未完成：${summary.open || 0}，已完成：${summary.done || 0}，已忽略：${summary.ignored || 0}，已归档：${summary.archived || 0}。`,
    `当前列表视图：${view}。`,
    "",
    `用户要求：${taskText || "整理这些条目"}`,
    "",
    "输出 JSON 结构：",
    '{ "summary": "...", "actions": [ { "id": "...", "index": 3, "matchText": "...", "kind": "todo", "status": "open", "reason": "..." } ] }',
    "",
    "条目列表：",
  ];

  entries.forEach((item, index) => {
    lines.push(
      `${index + 1}. id=${item.id} | kind=${item.kind} | status=${item.status} | received_at=${item.createdAt} | updated_at=${item.updatedAt} | text=${item.text}`,
    );
  });

  return lines.join("\n");
}

async function getPersonalCaptureAiEntries(botId, targetId) {
  const context = validatePersonalCaptureListContext(
    getPersonalCaptureListContextBucket(botId, targetId),
  );
  const view = context?.view || "open";
  const entries = await listPersonalCaptures({
    botId,
    targetId,
    status: view,
    limit: PERSONAL_CAPTURE_AI_MAX_ITEMS,
  });
  return {
    view,
    entries,
  };
}

function parsePersonalCaptureAiMode(raw) {
  const text = String(raw || "").trim();
  const normalized = normalizeCommandAlias(text);
  if (
    ["suggest", "preview", "advice", "建议"].includes(normalized) ||
    /只建议|不要执行|先别改|仅建议|先看看|先分析/i.test(text)
  ) {
    return "suggest";
  }
  if (
    ["apply", "run", "commit", "execute", "执行"].includes(normalized) ||
    /直接执行|直接改|写库|落库/i.test(text)
  ) {
    return "apply";
  }
  return "";
}

function normalizePersonalCaptureAiAction(rawAction = {}) {
  if (!rawAction || typeof rawAction !== "object") {
    return null;
  }

  const id = String(rawAction.id || "").trim();
  const index = parsePositiveIndex(rawAction.index ?? "");
  const matchText = truncateText(rawAction.matchText || rawAction.match || "", 160);
  if (!id && index === null && !matchText) {
    return null;
  }

  const kind = rawAction.kind ? normalizePersonalCaptureKind(rawAction.kind) : "";
  const status = rawAction.status ? normalizePersonalCaptureStatus(rawAction.status) : "";
  if (!kind && !status) {
    return null;
  }

  return {
    id,
    index,
    matchText,
    kind,
    status,
    reason: truncateText(rawAction.reason || rawAction.note || "", 240),
  };
}

async function callPersonalCaptureAi({
  botId = "",
  targetId,
  taskText,
  entries = [],
  summary = {},
  view = "open",
}) {
  const prompt = buildPersonalCaptureAiPrompt(taskText, entries, summary, view);
  const attempts = [];

  for (const model of PERSONAL_CAPTURE_AI_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PERSONAL_CAPTURE_AI_TIMEOUT_MS);
    try {
      const response = await fetch(`${PERSONAL_CAPTURE_AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PERSONAL_CAPTURE_AI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: "你只输出合法 JSON，不要输出额外解释。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      });
      const rawText = await response.text();
      if (!response.ok) {
        attempts.push(`${model}: HTTP ${response.status}`);
        continue;
      }

      const payload = parseJsonText(rawText);
      const content =
        payload?.choices?.[0]?.message?.content ??
        payload?.choices?.[0]?.text ??
        rawText;
      const parsed = parseJsonTextWithFenceFallback(
        typeof content === "string" ? content : safeJsonPreview(content, 4000),
      );
      if (!parsed || typeof parsed !== "object") {
        attempts.push(`${model}: invalid_json`);
        continue;
      }

      const actions = Array.isArray(parsed.actions)
        ? parsed.actions
            .map((item) => normalizePersonalCaptureAiAction(item))
            .filter(Boolean)
            .slice(0, PERSONAL_CAPTURE_AI_MAX_ACTIONS)
        : [];

      return {
        model,
        summary: truncateText(parsed.summary || parsed.message || "", 300),
        actions,
        raw: parsed,
      };
    } catch (error) {
      attempts.push(`${model}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`AI 不可用：${attempts.join(" | ")}`);
}

async function applyPersonalCaptureAiActions(actions = []) {
  const applied = [];
  for (const action of actions || []) {
    if (!action?.id || (!action.kind && !action.status)) {
      continue;
    }

    const existing = await getPersonalCaptureById(action.id);
    if (!existing) {
      continue;
    }

    const patch = {
      extra: {
        aiReason: action.reason || "",
        aiUpdatedAt: new Date().toISOString(),
      },
    };
    if (action.kind) {
      patch.kind = action.kind;
    }
    if (action.status) {
      patch.status = action.status;
      if (action.status === "done") {
        patch.completedAt = new Date().toISOString();
        patch.archivedAt = "";
      } else if (action.status === "ignored") {
        patch.completedAt = "";
        patch.archivedAt = "";
      } else if (action.status === "archived") {
        patch.archivedAt = new Date().toISOString();
      } else if (action.status === "open") {
        patch.completedAt = "";
        patch.archivedAt = "";
      }
    }

    const updated = await updatePersonalCapture(action.id, patch);
    if (updated) {
      applied.push({
        id: updated.id,
        beforeKind: existing.kind,
        beforeStatus: existing.status,
        kind: updated.kind,
        status: updated.status,
        text: updated.text,
        reason: action.reason || "",
      });
    }
  }
  return applied;
}

function resolvePersonalCaptureAiActionTarget(action, entries = []) {
  if (!action) {
    return null;
  }
  if (action.id) {
    return entries.find((item) => item.id === action.id) || null;
  }
  if (action.index !== null && action.index !== undefined) {
    return entries[action.index - 1] || null;
  }
  if (action.matchText) {
    const needle = String(action.matchText).trim();
    return (
      entries.find(
        (item) =>
          item.text.includes(needle) ||
          (formatBeijingMinute(item.createdAt) || "").includes(needle) ||
          (formatBeijingMinute(item.updatedAt) || "").includes(needle),
      ) || null
    );
  }
  return null;
}

function looksLikePersonalCaptureOperationRequest(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return false;
  }

  return /第\s*\d+\s*条|去掉|删掉|删除|忽略|完成|归档|恢复/u.test(normalized);
}

function buildPersonalCaptureAiResultText({
  mode = "apply",
  model = "",
  summary = "",
  applied = [],
  proposed = [],
}) {
  const lines = [
    mode === "suggest"
      ? `AI 已完成分析（建议模式，模型: ${model}）`
      : `AI 已完成分析并更新 ${applied.length} 条（模型: ${model}）`,
    summary || "",
  ].filter(Boolean);

  const items = mode === "suggest" ? proposed : applied;
  if (!items.length) {
    lines.push(mode === "suggest" ? "当前没有高置信度建议。" : "当前没有高置信度可执行变更。");
    return lines.join("\n");
  }

  lines.push("");
  items.slice(0, 12).forEach((item, index) => {
    const beforeKind = item.beforeKind ? getPersonalCaptureKindLabel(item.beforeKind) : "";
    const beforeStatus = item.beforeStatus ? getPersonalCaptureStatusLabel(item.beforeStatus) : "";
    const afterKind = item.kind ? getPersonalCaptureKindLabel(item.kind) : beforeKind;
    const afterStatus = item.status ? getPersonalCaptureStatusLabel(item.status) : beforeStatus;
    const changeParts = [];
    if (beforeKind && beforeKind !== afterKind) {
      changeParts.push(`${beforeKind} -> ${afterKind}`);
    } else if (afterKind) {
      changeParts.push(afterKind);
    }
    if (beforeStatus && beforeStatus !== afterStatus) {
      changeParts.push(`${beforeStatus} -> ${afterStatus}`);
    } else if (afterStatus) {
      changeParts.push(afterStatus);
    }
    lines.push(
      `${index + 1}. ${truncateText(item.text, 48)} | ${changeParts.join(" | ") || "-"}`,
    );
    if (item.reason) {
      lines.push(`   原因: ${item.reason}`);
    }
  });

  if (mode === "suggest") {
    lines.push("", "提示：如需直接写库，可发送 dz ai 执行 <要求>");
  }
  return lines.join("\n");
}

async function resolvePersonalCaptureSelection(botId, targetId, rawSelection) {
  const selection = String(rawSelection || "").trim();
  if (!selection) {
    throw new Error("请先提供条目编号，例如：dz 完成 3");
  }

  const directId = await getPersonalCaptureById(selection);
  if (directId) {
    return directId;
  }

  const index = parsePositiveIndex(selection);
  if (index === null) {
    throw new Error("条目编号无效，请使用待做命令里显示的编号。");
  }

  const context = validatePersonalCaptureListContext(
    getPersonalCaptureListContextBucket(botId, targetId),
  );
  if (!context) {
    throw new Error("没有最近一次 dz 列表，请先发送 dz 查看编号。");
  }

  const selected = context.items[index - 1];
  if (!selected?.id) {
    throw new Error(`未找到编号 ${index}，请先重新发送 dz 查看最新列表。`);
  }

  const entry = await getPersonalCaptureById(selected.id);
  if (!entry) {
    throw new Error(`编号 ${index} 对应的条目已不存在，请重新发送 dz。`);
  }
  return entry;
}

async function handlePersonalCaptureCommand(commandText, context) {
  const parsed = parsePersonalCaptureCommand(commandText);
  if (!parsed) {
    return "";
  }

  if (parsed.action === "help") {
    return formatPersonalCaptureHelpText();
  }

  const botId = normalizeBotId(context.botId) || getDefaultBotId();
  const targetId = String(context.targetId || "").trim();
  const summary = await summarizePersonalCaptureCounts(botId, targetId);

  if (["list_open", "list_done", "list_ignored", "list_archived", "list_all"].includes(parsed.action)) {
    const status =
      parsed.action === "list_done"
        ? "done"
        : parsed.action === "list_ignored"
          ? "ignored"
        : parsed.action === "list_archived"
          ? "archived"
          : parsed.action === "list_all"
            ? "all"
            : "open";
    const entries = await listPersonalCaptures({
      botId,
      targetId,
      status,
      limit: PERSONAL_CAPTURE_LIST_LIMIT,
    });
    await savePersonalCaptureListContext(botId, targetId, entries, status);
    return buildPersonalCaptureListText(entries, status, summary);
  }

  if (parsed.action === "export") {
    return buildPersonalCaptureExportHelpText(botId, targetId, summary);
  }

  if (parsed.action === "ai_required") {
    return [
      "dz 命令已收口为“查看优先”。",
      "如果要让 AI 处理当前列表，请改用：",
      "dz ai 删掉第2条",
      "dz ai 第2条标记为完成",
      "dz ai 分析当前所有待做",
    ].join("\n");
  }

  if (parsed.action === "ai_apply") {
    const aiMode = parsePersonalCaptureAiMode(parsed.rest) || "apply";
    const aiTask = parsed.rest.replace(/^(ai\s+)?(建议|执行)\s+/i, "").trim();

    if (!aiTask) {
      return [
        "AI 整理命令",
        "dz ai 看哪些完成了",
        "dz ai 这些哪些该忽略",
        "dz ai 把这些整理成待做/想法/备忘",
        "dz ai 只建议，不要执行，先看看哪些完成了",
      ].join("\n");
    }

    const { view, entries } = await getPersonalCaptureAiEntries(botId, targetId);
    if (!entries.length) {
      return "当前没有可供 AI 整理的条目。";
    }

    const aiResult = await callPersonalCaptureAi({
      botId,
      targetId,
      taskText: aiTask,
      entries,
      summary,
      view,
    });
    if (aiMode === "suggest") {
      const proposed = [];
      for (const action of aiResult.actions || []) {
        const existing = resolvePersonalCaptureAiActionTarget(action, entries);
        if (!existing) {
          continue;
        }
        proposed.push({
          ...action,
          beforeKind: existing.kind,
          beforeStatus: existing.status,
          text: existing.text,
          kind: action.kind || existing.kind,
          status: action.status || existing.status,
        });
      }
      return buildPersonalCaptureAiResultText({
        mode: "suggest",
        model: aiResult.model,
        summary: aiResult.summary,
        proposed,
      });
    }

    const resolvedActions = [];
    for (const action of aiResult.actions || []) {
      const existing = resolvePersonalCaptureAiActionTarget(action, entries);
      if (!existing) {
        continue;
      }
      resolvedActions.push({
        ...action,
        id: existing.id,
      });
    }

    const applied = await applyPersonalCaptureAiActions(resolvedActions);
    return buildPersonalCaptureAiResultText({
      mode: "apply",
      model: aiResult.model,
      summary: aiResult.summary,
      applied,
    });
  }

  if (parsed.action === "view") {
    const entry = await resolvePersonalCaptureSelection(botId, targetId, parsed.rest);
    return buildPersonalCaptureDetailText(entry);
  }

  const selection = await resolvePersonalCaptureSelection(botId, targetId, parsed.rest);
  if (parsed.action === "mark_done") {
    const updated = await updatePersonalCapture(selection.id, {
      status: "done",
      completedAt: new Date().toISOString(),
      archivedAt: "",
    });
    return `已标记完成\n${getPersonalCaptureKindLabel(updated.kind)} / ${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "restore") {
    const updated = await updatePersonalCapture(selection.id, {
      status: "open",
      completedAt: "",
      archivedAt: "",
    });
    return `已恢复为未完成\n${getPersonalCaptureKindLabel(updated.kind)} / ${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "ignore") {
    const updated = await updatePersonalCapture(selection.id, {
      status: "ignored",
      completedAt: "",
      archivedAt: "",
    });
    return `已标记忽略\n${getPersonalCaptureKindLabel(updated.kind)} / ${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "archive") {
    const updated = await updatePersonalCapture(selection.id, {
      status: "archived",
      archivedAt: new Date().toISOString(),
    });
    return `已归档\n${getPersonalCaptureKindLabel(updated.kind)} / ${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "set_todo") {
    const updated = await updatePersonalCapture(selection.id, {
      kind: "todo",
      status: selection.status === "archived" ? "open" : selection.status,
      archivedAt: "",
    });
    return `已归类为待做\n${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "set_idea") {
    const updated = await updatePersonalCapture(selection.id, {
      kind: "idea",
      status: selection.status === "archived" ? "open" : selection.status,
      archivedAt: "",
    });
    return `已归类为想法\n${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "set_memo") {
    const updated = await updatePersonalCapture(selection.id, {
      kind: "memo",
      status: selection.status === "archived" ? "open" : selection.status,
      archivedAt: "",
    });
    return `已归类为备忘\n${truncateText(updated.text, 80)}`;
  }

  if (parsed.action === "set_inbox") {
    const updated = await updatePersonalCapture(selection.id, {
      kind: "inbox",
      status: selection.status === "archived" ? "open" : selection.status,
      archivedAt: "",
    });
    return `已放回未整理\n${truncateText(updated.text, 80)}`;
  }

  return formatPersonalCaptureHelpText();
}

function formatMoviePilotMediaDetail(item) {
  return [
    "\u8be6\u60c5",
    `\u6807\u9898: ${pickMoviePilotTitle(item)}`,
    `\u5e74\u4efd: ${pickMoviePilotYear(item) || "-"}`,
    `\u7c7b\u578b: ${pickFirstString(item?.type, item?.type_name) || "-"}`,
    `ID: ${pickMoviePilotMediaId(item)}`,
    `\u8bc4\u5206: ${item?.vote_average ?? item?.vote ?? "-"}`,
    `\u7b80\u4ecb: ${truncateText(pickFirstString(item?.overview, item?.description), 260) || "-"}`,
  ].join("\n");
}

function normalizeMoviePilotMediaKind(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }

  if (["\u7535\u5f71", "movie", "film"].includes(text)) {
    return "movie";
  }

  if (["\u7535\u89c6\u5267", "\u5267\u96c6", "tv", "series", "show"].includes(text)) {
    return "tv";
  }

  if (["\u4eba\u7269", "person"].includes(text)) {
    return "person";
  }

  return "";
}

function getMoviePilotMediaKind(item) {
  return normalizeMoviePilotMediaKind(
    pickFirstString(item?.type, item?.type_name, item?.media_type),
  );
}

function pickMoviePilotTmdbId(item) {
  const raw = item?.tmdb_id ?? item?.tmdbid ?? null;
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) ? value : null;
}

function normalizeMoviePilotTitleKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function collectMoviePilotTitleVariants(item) {
  return uniqueList(
    [
      pickMoviePilotTitle(item),
      pickFirstString(item?.title, item?.name, item?.title_year),
      pickFirstString(item?.en_title, item?.original_title, item?.original_name),
      ...(Array.isArray(item?.names) ? item.names : []),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );
}

function buildMoviePilotResourceSearchKeywords(mediaPayload) {
  const kind = getMoviePilotMediaKind(mediaPayload);
  const year = pickMoviePilotYear(mediaPayload)?.slice(0, 4) || "";
  const season =
    mediaPayload?.season ??
    mediaPayload?.season_info?.[0]?.season_number ??
    (kind === "tv" ? 1 : null);
  const titles = collectMoviePilotTitleVariants(mediaPayload);
  const keywords = [];

  for (const title of titles) {
    if (year) {
      keywords.push(`${title} ${year}`);
    }
    keywords.push(title);

    if (kind === "tv" && season) {
      const seasonNumber = String(season).padStart(2, "0");
      keywords.push(`${title} S${seasonNumber}`);
      keywords.push(`${title} \u7b2c${Number(season)}\u5b63`);
    }
  }

  return uniqueList(keywords.map((item) => item.trim()).filter(Boolean)).slice(
    0,
    kind === "tv" ? 20 : 12,
  );
}

function getMoviePilotResourceCandidateTitle(item) {
  const torrent =
    item?.torrent_info && typeof item.torrent_info === "object"
      ? item.torrent_info
      : item;
  const meta =
    item?.meta_info && typeof item.meta_info === "object" ? item.meta_info : {};
  return pickFirstString(
    torrent?.title,
    meta?.title,
    meta?.org_string,
    meta?.name,
    torrent?.description,
  );
}

function getMoviePilotResourceCandidateSubtitle(item) {
  const torrent =
    item?.torrent_info && typeof item.torrent_info === "object"
      ? item.torrent_info
      : item;
  const meta =
    item?.meta_info && typeof item.meta_info === "object" ? item.meta_info : {};
  return pickFirstString(meta?.subtitle, torrent?.description);
}

async function recognizeMoviePilotResourceCandidate(integration, item, cache) {
  const title = getMoviePilotResourceCandidateTitle(item);
  if (!title) {
    return null;
  }

  const subtitle = getMoviePilotResourceCandidateSubtitle(item) || "";
  const cacheKey = `${title}\n${subtitle}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const payload = await moviePilotApiRequest({
      integration,
      endpoint: "/api/v1/media/recognize2",
      query: {
        title,
        subtitle,
      },
    });
    const media = payload?.media_info && typeof payload.media_info === "object"
      ? payload.media_info
      : null;
    cache.set(cacheKey, media);
    return media;
  } catch {
    cache.set(cacheKey, null);
    return null;
  }
}

function isMoviePilotRecognizedCandidateMatch(targetMedia, candidateMedia) {
  if (!candidateMedia || typeof candidateMedia !== "object") {
    return false;
  }

  const targetKind = getMoviePilotMediaKind(targetMedia);
  const candidateKind = getMoviePilotMediaKind(candidateMedia);
  if (targetKind && candidateKind && targetKind !== candidateKind) {
    return false;
  }

  const targetTmdbId = pickMoviePilotTmdbId(targetMedia);
  const candidateTmdbId = pickMoviePilotTmdbId(candidateMedia);
  if (targetTmdbId && candidateTmdbId) {
    return targetTmdbId === candidateTmdbId;
  }

  const targetYear = pickMoviePilotYear(targetMedia)?.slice(0, 4) || "";
  const candidateYear = pickMoviePilotYear(candidateMedia)?.slice(0, 4) || "";
  if (targetYear && candidateYear && targetYear !== candidateYear) {
    return false;
  }

  const targetTitles = new Set(
    collectMoviePilotTitleVariants(targetMedia)
      .map((item) => normalizeMoviePilotTitleKey(item))
      .filter(Boolean),
  );
  const candidateTitles = new Set(
    collectMoviePilotTitleVariants(candidateMedia)
      .map((item) => normalizeMoviePilotTitleKey(item))
      .filter(Boolean),
  );
  for (const title of targetTitles) {
    if (candidateTitles.has(title)) {
      return true;
    }
  }

  return false;
}

async function searchMoviePilotResourcesByTitle(integration, mediaPayload) {
  const kind = getMoviePilotMediaKind(mediaPayload);
  const keywords = buildMoviePilotResourceSearchKeywords(mediaPayload);
  const recognizeCache = new Map();
  const maxSourceItems = kind === "tv" ? 24 : 18;
  const maxMatches = 6;
  const triedKeywords = [];
  let resolvedQuery = keywords[0] || pickMoviePilotTitle(mediaPayload);

  for (const keyword of keywords) {
    triedKeywords.push(keyword);
    resolvedQuery = keyword;

    let rawItems;
    try {
      const result = await moviePilotApiRequest({
        integration,
        endpoint: "/api/v1/search/title",
        query: {
          keyword,
          page: 1,
        },
      });
      rawItems = unwrapMoviePilotResponse(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("\u672a\u641c\u7d22\u5230\u4efb\u4f55\u8d44\u6e90")) {
        continue;
      }
      throw error;
    }

    const candidates = Array.isArray(rawItems) ? rawItems.slice(0, maxSourceItems) : [];
    if (!candidates.length) {
      continue;
    }

    const accepted = [];
    for (const candidate of candidates) {
      const recognizedMedia = await recognizeMoviePilotResourceCandidate(
        integration,
        candidate,
        recognizeCache,
      );
      if (!isMoviePilotRecognizedCandidateMatch(mediaPayload, recognizedMedia)) {
        continue;
      }

      accepted.push(candidate);
      if (accepted.length >= maxMatches) {
        break;
      }
    }

    if (accepted.length) {
      return {
        items: accepted,
        resolvedQuery,
        triedKeywords,
        lastResourceSearchMode: kind === "tv" ? "tv-fuzzy" : "movie-fuzzy",
      };
    }
  }

  return {
    items: [],
    resolvedQuery,
    triedKeywords,
    lastResourceSearchMode: kind === "tv" ? "tv-fuzzy" : "movie-fuzzy",
  };
}

async function listMoviePilotSubscriptions(integration) {
  const result = await moviePilotApiRequest({
    integration,
    endpoint: "/api/v1/subscribe/list",
  });
  const items = unwrapMoviePilotResponse(result);
  return Array.isArray(items) ? items : [];
}

function findExistingMoviePilotSubscription(subscriptions, mediaPayload) {
  const targetMediaId = pickMoviePilotMediaId(mediaPayload);
  const targetTmdbId = pickMoviePilotTmdbId(mediaPayload);
  const targetKind = getMoviePilotMediaKind(mediaPayload);
  const targetSeason = mediaPayload?.season ?? null;

  return subscriptions.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const itemKind = getMoviePilotMediaKind(item);
    if (targetKind && itemKind && targetKind !== itemKind) {
      return false;
    }

    const itemMediaId = pickMoviePilotMediaId(item);
    if (targetMediaId && itemMediaId && targetMediaId === itemMediaId) {
      return targetSeason ? Number(item.season ?? 0) === Number(targetSeason) : true;
    }

    const itemTmdbId = pickMoviePilotTmdbId(item);
    if (targetTmdbId && itemTmdbId && targetTmdbId === itemTmdbId) {
      return targetSeason ? Number(item.season ?? 0) === Number(targetSeason) : true;
    }

    return false;
  }) ?? null;
}

async function executeMoviePilotRestCommand({ integration, commandBody, targetId = "" }) {
  const trimmed = commandBody.trim();
  if (!trimmed) {
    return formatMoviePilotHelpText();
  }

  const compact = splitCompactMoviePilotCommand(trimmed);
  let rawAction = "";
  let rest = "";
  if (compact) {
    rawAction = compact.action;
    rest = compact.rest;
  } else {
    const parts = trimmed.split(/\s+/);
    rawAction = parts.shift() || "";
    rest = parts.join(" ").trim();
  }
  const action = mapMoviePilotAction(rawAction);

  if (action === "help") {
    return formatMoviePilotHelpText();
  }

  if (action === "stop") {
    await saveMoviePilotContext(targetId, integration.id, {
      moviepilotMediaSearch: null,
      moviepilotTorrentSearch: null,
    });
    return "\u5df2\u6e05\u7a7a\u5f53\u524d MP \u641c\u7d22\u548c\u7247\u6e90\u4e0a\u4e0b\u6587\u3002";
  }

  if (action === "search_media") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u641c\u7d22 <\u5173\u952e\u8bcd>");
    }
    const result = await moviePilotApiRequest({
      integration,
      endpoint: "/api/v1/media/search",
      query: { title: rest, type: "media", page: 1, count: 8 },
    });
    const items = unwrapMoviePilotResponse(result);
    await saveMoviePilotContext(targetId, integration.id, {
      moviepilotMediaSearch: buildMoviePilotContext(targetId, rest, items, {
        integrationId: integration.id,
        title: rest,
      }),
      moviepilotTorrentSearch: null,
    });
    return formatMoviePilotMediaResults(items, "\u641c\u7d22\u7ed3\u679c", rest, {
      includeHints: true,
    });
  }

  if (action === "search_person") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u4eba\u7269 <\u59d3\u540d>");
    }
    const result = await moviePilotApiRequest({
      integration,
      endpoint: "/api/v1/media/search",
      query: { title: rest, type: "person", page: 1, count: 8 },
    });
    return formatMoviePilotMediaResults(
      unwrapMoviePilotResponse(result),
      "\u4eba\u7269\u641c\u7d22\u7ed3\u679c",
      rest,
      { includeHints: false },
    );
  }

  if (action === "detail") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u8be6\u60c5 <\u7f16\u53f7>");
    }
    const item = resolveMoviePilotMediaSelection(targetId, integration.id, rest);
    return formatMoviePilotMediaDetail(getMoviePilotMediaPayload(item));
  }

  if (action === "torrent") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u7247\u6e90 <\u7f16\u53f7>");
    }
    const item = resolveMoviePilotMediaSelection(targetId, integration.id, rest);
    const mediaPayload = getMoviePilotMediaPayload(item);
    const targetKind = getMoviePilotMediaKind(mediaPayload);
    const targetTitle = pickMoviePilotTitle(mediaPayload);
    const targetYear = pickMoviePilotYear(mediaPayload)?.slice(0, 4) || "";
    const targetTmdbId = pickMoviePilotTmdbId(mediaPayload);

    const searchResult = await searchMoviePilotResourcesByTitle(integration, mediaPayload);
    await saveMoviePilotContext(targetId, integration.id, {
      moviepilotTorrentSearch: buildMoviePilotContext(
        targetId,
        searchResult.resolvedQuery,
        searchResult.items,
        {
          integrationId: integration.id,
          mediaItem: mediaPayload,
          type: targetKind,
          year: targetYear,
          tmdb_id: targetTmdbId,
          title: targetTitle,
          searchKeywordsTried: searchResult.triedKeywords,
          lastResourceSearchMode: searchResult.lastResourceSearchMode,
        },
      ),
    });

    return formatMoviePilotTorrentResults(searchResult.items, searchResult.resolvedQuery, {
      targetKind,
    });
  }

  if (action === "exact") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u7cbe\u786e <mediaid>");
    }
    const result = await moviePilotApiRequest({
      integration,
      endpoint: `/api/v1/search/media/${encodeURIComponent(rest)}`,
      query: {},
    });
    return formatMoviePilotTorrentResults(unwrapMoviePilotResponse(result), rest);
  }

  if (action === "download") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u4e0b\u8f7d <\u7247\u6e90\u7f16\u53f7>");
    }
    const selected = resolveMoviePilotTorrentSelection(targetId, integration.id, rest);
    const torrentPayload = getMoviePilotTorrentPayload(selected.torrent);
    const mediaPayload = selected.media ? getMoviePilotMediaPayload(selected.media) : null;
    const body = mediaPayload
      ? {
          media_in: mediaPayload,
          torrent_in: torrentPayload,
        }
      : {
          torrent_in: torrentPayload,
        };
    const endpoint = selected.media ? "/api/v1/download/" : "/api/v1/download/add";
    const result = await moviePilotApiRequest({
      integration,
      endpoint,
      method: "POST",
      body,
    });
    return formatMoviePilotResponse(result, "\u4e0b\u8f7d\u4efb\u52a1\u5df2\u63d0\u4ea4");
  }

  if (action === "subscribe" || action === "follow") {
    if (!rest) {
      throw new Error(
        action === "follow"
          ? "\u7528\u6cd5: mp \u8ffd\u66f4 <\u7f16\u53f7>"
          : "\u7528\u6cd5: mp \u8ba2\u9605 <\u7f16\u53f7>",
      );
    }

    const item = resolveMoviePilotMediaSelection(targetId, integration.id, rest);
    const mediaPayload = getMoviePilotMediaPayload(item);
    const kind = getMoviePilotMediaKind(mediaPayload);
    const followStyle = kind === "tv";

    try {
      const subscriptions = await listMoviePilotSubscriptions(integration);
      const existing = findExistingMoviePilotSubscription(subscriptions, mediaPayload);
      if (existing?.id) {
        return formatMoviePilotExistingSubscription(existing, { followStyle });
      }
    } catch {
      // Ignore list failures and continue with create flow.
    }

    const body = {
      name: pickMoviePilotTitle(mediaPayload),
      year: pickFirstString(mediaPayload?.year),
      type: pickFirstString(mediaPayload?.type, mediaPayload?.type_name),
      keyword: pickMoviePilotTitle(mediaPayload),
      mediaid: pickMoviePilotMediaId(mediaPayload),
      tmdbid: mediaPayload?.tmdb_id ?? mediaPayload?.tmdbid ?? null,
      doubanid: mediaPayload?.douban_id ?? mediaPayload?.doubanid ?? null,
      bangumiid: mediaPayload?.bangumi_id ?? mediaPayload?.bangumiid ?? null,
      season: mediaPayload?.season ?? null,
      poster: mediaPayload?.poster_path ?? mediaPayload?.poster ?? null,
      backdrop: mediaPayload?.backdrop_path ?? mediaPayload?.backdrop ?? null,
      description: pickFirstString(mediaPayload?.overview, mediaPayload?.description),
    };
    const result = await moviePilotApiRequest({
      integration,
      endpoint: "/api/v1/subscribe/",
      method: "POST",
      body,
    });
    return formatMoviePilotResponse(
      result,
      followStyle ? "\u5df2\u521b\u5efa\u8ffd\u66f4\u8ba2\u9605" : "\u8ba2\u9605\u5df2\u521b\u5efa",
    );
  }

  if (action === "unsubscribe") {
    if (!rest) {
      throw new Error("\u7528\u6cd5: mp \u53d6\u6d88\u8ba2\u9605 <\u7f16\u53f7|mediaid>");
    }
    const index = parseMoviePilotIndex(rest);
    const mediaId =
      index !== null
        ? pickMoviePilotMediaId(resolveMoviePilotMediaSelection(targetId, integration.id, rest))
        : rest;
    const result = await moviePilotApiRequest({
      integration,
      endpoint: `/api/v1/subscribe/media/${encodeURIComponent(mediaId)}`,
      method: "DELETE",
    });
    return formatMoviePilotResponse(result, "\u8ba2\u9605\u5df2\u53d6\u6d88");
  }

  if (action === "sub_list") {
    const items = await listMoviePilotSubscriptions(integration);
    return formatMoviePilotSubscriptionList(items);
  }

  if (action === "sub_refresh") {
    const result = await moviePilotApiRequest({
      integration,
      endpoint: "/api/v1/subscribe/refresh",
    });
    return formatMoviePilotResponse(result, "\u8ba2\u9605\u5237\u65b0\u4efb\u52a1\u5df2\u63d0\u4ea4");
  }

  if (action === "sub_check") {
    const result = await moviePilotApiRequest({
      integration,
      endpoint: "/api/v1/subscribe/check",
    });
    return formatMoviePilotResponse(result, "\u8ba2\u9605\u68c0\u67e5\u4efb\u52a1\u5df2\u63d0\u4ea4");
  }

  throw new Error("\u672a\u77e5 mp \u547d\u4ee4\uff0c\u8bf7\u76f4\u63a5\u53d1\u9001 `mp` \u67e5\u770b\u5e2e\u52a9\u3002");
}


async function callMoviePilotRestIntegration({
  integration,
  botId = "",
  targetId,
  rawText,
  commandText,
  source = "wechat-command",
}) {
  const correlationId = crypto.randomUUID();
  await createDispatchRecord({
    correlationId,
    integrationId: integration.id,
    integrationAlias: integration.alias,
    integrationName: integration.name,
    botId: normalizeBotId(botId) || getDefaultBotId(),
    targetId,
    rawText,
    commandText,
    source,
  });

  try {
    const replyText = await executeMoviePilotRestCommand({
      integration,
      commandBody: commandText,
      targetId,
    });
    // Direct REST mode should always return the immediate execution summary to
    // the current chat. Asynchronous callback-style responses use /reply.
    const suppressWeixinReply = false;
    await updateDispatchRecord(correlationId, {
      status: "completed",
      responseSummary: truncateText(replyText, 200),
    });
    await appendLog(
      "system",
      `MoviePilot REST command completed: ${truncateText(commandText || rawText, 120)}` ,
      {
        botId: normalizeBotId(botId) || getDefaultBotId(),
        targetId,
        integrationId: integration.id,
        correlationId,
      },
    );
    return {
      correlationId,
      accepted: true,
      responseSummary: truncateText(replyText, 200),
      replyText,
      suppressWeixinReply,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateDispatchRecord(correlationId, {
      status: "failed",
      error: message,
    });
    throw new Error(`MoviePilot command failed: ${message}`);
  }
}

async function handleIntegrationCommand(commandText, context) {
  const trimmed = commandText.trim();
  if (!trimmed) {
    return "";
  }

  const subtitleCommand = parseSubtitleGatewayCommand(trimmed);
  if (subtitleCommand) {
    if (SUBTITLE_HELP_ACTIONS.has(normalizeCommandAlias(subtitleCommand.commandText))) {
      return formatSubtitleHelpText();
    }

    const integration = findSubtitleIntegration();
    if (!integration) {
      throw new Error(
        "未找到已启用的 AI 字幕集成，请先在控制台启用 ai-subtitle 或为视频下载集成配置 zm。",
      );
    }

    const result = await callVideoDownloaderIntegration({
      integration,
      botId: context.botId,
      targetId: context.targetId,
      rawText: subtitleCommand.rawText,
      commandText: subtitleCommand.commandText,
    });
    await clearInteractiveIntegrationSession(context.targetId);
    return result.suppressWeixinReply ? SUPPRESS_WECHAT_REPLY : result.replyText;
  }

  const [rawCommand = "", ...restParts] = trimmed.split(/\s+/);
  const commandAlias = normalizeCommandAlias(rawCommand);
  if (!commandAlias) {
    return "";
  }

  const matches = findIntegrationsByCommandAlias(commandAlias);
  if (!matches.length) {
    return "";
  }
  if (matches.length > 1) {
    return `命令 ${commandAlias} 匹配到多个集成，请在控制台调整别名避免冲突`;
  }

  const integration = matches[0];
  const commandBody = restParts.join(" ").trim();
  if (
    isAiSubtitleIntegration(integration) &&
    LEGACY_SUBTITLE_COMMAND_ALIASES.has(commandAlias) &&
    SUBTITLE_HELP_ACTIONS.has(normalizeCommandAlias(commandBody))
  ) {
    return "";
  }
  if (integration.adapterType === "moviepilot-rest") {
    const result = await callMoviePilotRestIntegration({
      integration,
      botId: context.botId,
      targetId: context.targetId,
      rawText: trimmed,
      commandText: commandBody,
    });
    return result.suppressWeixinReply ? SUPPRESS_WECHAT_REPLY : result.replyText;
  }

  if (supportsInteractiveIntegrationSession(integration.adapterType)) {
    const result = await callVideoDownloaderIntegration({
      integration,
      botId: context.botId,
      targetId: context.targetId,
      rawText: trimmed,
      commandText: commandBody,
    });
    if (result.sessionAction === "clear" || isAiSubtitleIntegration(integration)) {
      await clearInteractiveIntegrationSession(context.targetId);
    } else {
      await saveInteractiveIntegrationSession(context.targetId, integration.id);
    }
    return result.suppressWeixinReply ? SUPPRESS_WECHAT_REPLY : result.replyText;
  }

  const result = await callOutgoingIntegration({
    integration,
    botId: context.botId,
    targetId: context.targetId,
    rawText: trimmed,
    commandText: commandBody,
  });

  return [
    `已转发到 ${integration.name}`,
    `任务号: ${result.correlationId}`,
    integration.outgoingUrl ? `目标地址: ${integration.outgoingUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleInteractiveIntegrationContinuation(commandText, context) {
  const trimmed = commandText.trim();
  if (!trimmed) {
    return "";
  }

  const integration = getActiveInteractiveIntegration(context.targetId);
  if (!integration) {
    return "";
  }

  const result = await callVideoDownloaderIntegration({
    integration,
    botId: context.botId,
    targetId: context.targetId,
    rawText: trimmed,
    commandText: trimmed,
    source: "wechat-command-session",
  });
  if (result.sessionAction === "clear") {
    await clearInteractiveIntegrationSession(context.targetId);
  } else {
    await saveInteractiveIntegrationSession(context.targetId, integration.id);
  }

  return result.suppressWeixinReply ? SUPPRESS_WECHAT_REPLY : result.replyText;
}

function normalizeGenericIncomingPayload(rawPayload) {
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? rawPayload
      : {};

  const title = pickFirstString(
    payload.title,
    payload.summary,
    payload.subject,
    payload.alertname,
    payload.name,
    payload.event,
    payload.source,
  );
  let content = pickFirstString(
    payload.content,
    payload.description,
    payload.text,
    payload.message,
    payload.msg,
    payload.body,
  );
  const severity = pickFirstString(payload.severity, payload.level, payload.status);
  const event = pickFirstString(payload.event, payload.type);
  const linkUrl = pickFirstString(payload.linkUrl, payload.url, payload.link);
  const explicitSourceLabel = pickFirstString(payload.sourceLabel, payload.source);
  const sourceKey = inferGenericSourceKey(payload, title, content, linkUrl);
  const sourceLabel = getGenericSourceDisplayLabel(sourceKey, explicitSourceLabel);
  const metaLines = [];
  if (sourceLabel && sourceLabel !== title) {
    metaLines.push(`来源: ${sourceLabel}`);
  }
  if (event) {
    metaLines.push(`事件: ${event}`);
  }
  if (severity) {
    metaLines.push(`级别: ${severity}`);
  }
  if (!content && Object.keys(payload).length) {
    content = safeJsonPreview(payload);
  }

  return {
    title: title || sourceLabel || "通用通知",
    content: [metaLines.join("\n"), content].filter(Boolean).join("\n"),
    linkUrl,
    imageUrl: pickFirstString(payload.imageUrl, payload.poster, payload.image),
    fileUrl: pickFirstString(
      payload.fileUrl,
      payload.file_url,
      payload.attachmentUrl,
      payload.attachment_url,
      payload.documentUrl,
      payload.document_url,
    ),
    filePath: pickFirstString(
      payload.filePath,
      payload.file_path,
      payload.attachmentPath,
      payload.attachment_path,
    ),
    fileName: pickFirstString(
      payload.fileName,
      payload.file_name,
      payload.attachmentName,
      payload.attachment_name,
      payload.documentName,
      payload.document_name,
    ),
    sourceLabel,
    sourceKey,
    severity,
    event,
  };
}

function extractUptimeKumaPayload(rawPayload) {
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
      ? rawPayload
      : {};
  const heartbeat =
    payload.heartbeat && typeof payload.heartbeat === "object" ? payload.heartbeat : {};
  const monitor =
    payload.monitor && typeof payload.monitor === "object" ? payload.monitor : {};
  const statusValue =
    typeof heartbeat.status === "number"
      ? heartbeat.status
      : Number.parseInt(String(payload.status ?? ""), 10);
  const statusLabel =
    statusValue === 1 ? "在线" : statusValue === 0 ? "离线" : statusValue === 2 ? "维护" : "";
  const title =
    pickFirstString(payload.title, monitor.name, monitor.friendly_name) || "Uptime Kuma 通知";
  const lines = [
    statusLabel ? `状态: ${statusLabel}` : "",
    pickFirstString(heartbeat.msg, payload.msg, payload.message),
    monitor.url ? `目标: ${monitor.url}` : "",
    typeof heartbeat.ping === "number" ? `延迟: ${heartbeat.ping} ms` : "",
    pickFirstString(heartbeat.time, payload.time),
  ].filter(Boolean);

  return {
    title: `Uptime Kuma: ${title}`,
    content: lines.join("\n"),
    linkUrl: pickFirstString(monitor.url, payload.url),
    imageUrl: "",
    sourceLabel: "Uptime Kuma",
    severity: statusLabel,
    event: pickFirstString(payload.event),
  };
}

function extractGrafanaPayload(rawPayload) {
  const payload = lowercaseKeys(rawPayload ?? {});
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const firstAlert = alerts[0] && typeof alerts[0] === "object" ? alerts[0] : {};
  const commonLabels =
    payload.commonlabels && typeof payload.commonlabels === "object"
      ? payload.commonlabels
      : {};
  const commonAnnotations =
    payload.commonannotations && typeof payload.commonannotations === "object"
      ? payload.commonannotations
      : {};
  const firstLabels =
    firstAlert.labels && typeof firstAlert.labels === "object" ? firstAlert.labels : {};
  const firstAnnotations =
    firstAlert.annotations && typeof firstAlert.annotations === "object"
      ? firstAlert.annotations
      : {};
  const status = pickFirstString(payload.status, firstAlert.status);
  const title =
    pickFirstString(
      payload.title,
      commonLabels.alertname,
      firstLabels.alertname,
      firstLabels.rule_uid,
    ) || `Grafana ${status || "通知"}`;
  const lines = [
    pickFirstString(
      payload.message,
      commonAnnotations.summary,
      commonAnnotations.description,
      firstAnnotations.summary,
      firstAnnotations.description,
    ),
    status ? `状态: ${status}` : "",
    payload.receiver ? `接收器: ${payload.receiver}` : "",
    alerts.length ? `告警数: ${alerts.length}` : "",
  ].filter(Boolean);

  return {
    title,
    content: lines.join("\n"),
    linkUrl: pickFirstString(
      firstAlert.generatorurl,
      firstAlert.silenceurl,
      firstAlert.dashboardurl,
      firstAlert.panelurl,
      payload.externalurl,
    ),
    imageUrl: "",
    sourceLabel: "Grafana",
    severity: status,
    event: pickFirstString(commonLabels.alertname, firstLabels.alertname),
  };
}

function extractAlertmanagerPayload(rawPayload) {
  const payload = lowercaseKeys(rawPayload ?? {});
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
  const firstAlert = alerts[0] && typeof alerts[0] === "object" ? alerts[0] : {};
  const commonLabels =
    payload.commonlabels && typeof payload.commonlabels === "object"
      ? payload.commonlabels
      : {};
  const commonAnnotations =
    payload.commonannotations && typeof payload.commonannotations === "object"
      ? payload.commonannotations
      : {};
  const labels =
    firstAlert.labels && typeof firstAlert.labels === "object" ? firstAlert.labels : {};
  const annotations =
    firstAlert.annotations && typeof firstAlert.annotations === "object"
      ? firstAlert.annotations
      : {};
  const status = pickFirstString(payload.status, firstAlert.status);
  const title =
    pickFirstString(commonLabels.alertname, labels.alertname, payload.receiver) ||
    `Alertmanager ${status || "通知"}`;
  const lines = [
    pickFirstString(
      commonAnnotations.summary,
      commonAnnotations.description,
      annotations.summary,
      annotations.description,
    ),
    status ? `状态: ${status}` : "",
    payload.receiver ? `接收器: ${payload.receiver}` : "",
    alerts.length ? `告警数: ${alerts.length}` : "",
  ].filter(Boolean);

  return {
    title,
    content: lines.join("\n"),
    linkUrl: pickFirstString(
      firstAlert.generatorurl,
      firstAlert.silenceurl,
      payload.externalurl,
    ),
    imageUrl: "",
    sourceLabel: "Alertmanager",
    severity: status,
    event: pickFirstString(commonLabels.alertname, labels.alertname),
  };
}

function normalizeIncomingByAdapter(adapterType, rawPayload) {
  switch (normalizeAdapterType(adapterType)) {
    case "moviepilot":
      return extractMoviePilotPayload(rawPayload);
    case "uptime-kuma":
      return extractUptimeKumaPayload(rawPayload);
    case "grafana":
      return extractGrafanaPayload(rawPayload);
    case "alertmanager":
      return extractAlertmanagerPayload(rawPayload);
    case "generic":
    default:
      return normalizeGenericIncomingPayload(rawPayload);
  }
}

async function handleGatewayCommand(commandText, context) {
  const normalized = commandText.trim();
  const lower = normalized.toLowerCase();
  const compactLower = lower.replace(/\s+/g, "");
  const compactNormalized = normalized.replace(/\s+/g, "");

  if (lower === "ping") {
    return `pong: 网关在线，Webhook Token: ${store.config.webhookToken}`;
  }

  if (lower === "ip") {
    return `当前局域网 IP: ${getLanIp()}`;
  }

  if (lower === "help" || normalized === "帮助") {
    return formatGatewayCommandSummary();
  }

  if (compactLower === "helpall" || compactNormalized === "帮助详细") {
    return formatGatewayCommandDetailSummary();
  }

  if (normalized === "\u72b6\u6001" || lower === "status") {
    const accountId = runtime.currentAccountId || (await getPrimaryAccountId()) || "-";
    const enabledIntegrations = getEnabledIntegrations();
    const lines = [
      "\u7f51\u5173\u72b6\u6001",
      `\u72b6\u6001: ${runtime.status}`,
      `\u8d26\u53f7: ${accountId}`,
      `\u5c40\u57df\u7f51 IP: ${getLanIp()}`,
      `\u76ee\u6807\u6570: ${store.targets.items.length}`,
      `\u542f\u7528\u96c6\u6210: ${enabledIntegrations.length}`,
    ];
    if (runtime.lastError) {
      lines.push(`\u6700\u8fd1\u9519\u8bef: ${truncateText(runtime.lastError, 120)}`);
    }
    return lines.join("\n");
  }

  if (normalized === "\u7248\u672c" || lower === "version" || lower === "ver") {
    return [
      "\u7248\u672c\u4fe1\u606f",
      `\u7248\u672c: ${CHANNEL_VERSION}`,
      `\u542f\u52a8\u65f6\u95f4: ${runtime.startedAt}`,
      `\u8fd0\u884c\u65f6\u957f: ${formatElapsedDuration(runtime.startedAt)}`,
    ].join("\n");
  }

  if (normalized === "\u96c6\u6210" || lower === "integrations") {
    return formatIntegrationsCommandResult();
  }

  if (normalized === "\u8fde\u901a" || lower === "connectivity" || lower === "check") {
    const summary = await runConnectivityChecks();
    return formatConnectivityCommandResult(summary);
  }

  const personalCaptureReply = await handlePersonalCaptureCommand(commandText, context);
  if (personalCaptureReply) {
    return personalCaptureReply;
  }

  const directCustom = CUSTOM_COMMANDS.get(normalized) ?? CUSTOM_COMMANDS.get(lower);
  if (directCustom) {
    return directCustom(context);
  }

  const directIntegrationReply = await handleIntegrationCommand(commandText, context);
  if (directIntegrationReply) {
    return directIntegrationReply;
  }

  return handleInteractiveIntegrationContinuation(commandText, context);
}

async function handleInboundWeixinMessage(request, context = {}) {
  const botId = normalizeBotId(context.botId) || getDefaultBotId();
  const targetId = request.conversationId?.trim() || "";
  const text = request.text?.trim() || "";
  const targetResult = await upsertTarget(botId, targetId);
  let suppressReply = false;
  let commandHandled = false;

  await noteInboundWindowActivity(botId, targetId);

  const inboundSummary = text || `[${request.media?.type || "非文本"}消息]`;
  await appendConversationMessage({
    botId,
    targetId,
    direction: "inbound",
    text: inboundSummary,
    source: `wechat:${botId}`,
  });
  await appendLog("inbound", inboundSummary, { botId, targetId });

  const queuedItems = await listQueuedNotifications(botId, targetId);
  if (queuedItems.length) {
    const replayResult = await replayQueuedNotifications(botId, targetId, queuedItems);
    if (replayResult.sentIds.length) {
      await releaseQueuedNotifications(replayResult.sentIds, "released_on_user_message");
    }
  }

  let replyText = "";
  try {
    if (text) {
      const commandResult = await handleGatewayCommand(text, {
        botId,
        targetId,
        request,
      });
      if (commandResult === SUPPRESS_WECHAT_REPLY) {
        suppressReply = true;
        commandHandled = true;
        replyText = "";
      } else if (commandResult) {
        commandHandled = true;
        replyText = commandResult;
      }
    }
  } catch (error) {
    commandHandled = Boolean(text);
    replyText = `指令执行失败: ${error instanceof Error ? error.message : String(error)}`;
  }

  if (
    text &&
    !commandHandled &&
    !isIgnorablePersonalCaptureText(text) &&
    !looksLikePersonalCaptureOperationRequest(text)
  ) {
    await appendPersonalCapture({
      botId,
      targetId,
      text,
      kind: "inbox",
      status: "open",
      extra: {
        source: "wechat-auto-capture",
      },
    });
  }

  if (!replyText && !suppressReply) {
    if (targetResult.isNew) {
      await appendLog("system", `已记录新的会话目标: ${botId}:${targetId}`, {
        botId,
        targetId,
      });
    }
    return {};
  }

  if (suppressReply) {
    await appendLog("system", `已抑制即时微信回复: ${truncateText(text, 120)}`, {
      botId,
      targetId,
    });
    return {};
  }

  const replyTextWithWarning = appendProactiveQuotaWarning(
    replyText,
    await getNextProactiveCount(botId, targetId),
  );

  await appendLog("outbound", replyTextWithWarning, { botId, targetId });
  await noteProactiveWindowDelivery(botId, targetId);
  await appendConversationMessage({
    botId,
    targetId,
    direction: "outbound",
    text: replyTextWithWarning,
    source: `gateway-reply:${botId}`,
  });
  return { text: replyTextWithWarning };
}

async function startBotMonitor(botId = "") {
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const botRuntime = ensureBotRuntime(normalizedBotId);
  if (!botRuntime) {
    return null;
  }
  if (botRuntime.botTask) {
    return botRuntime.botTask;
  }

  const account = await getActiveAccount(normalizedBotId);
  if (!account) {
    botRuntime.status = "not_logged_in";
    syncLegacyRuntimeFromDefaultBot();
    return null;
  }

  botRuntime.status = "logged_in";
  botRuntime.currentAccountId = account.accountId;
  botRuntime.lastError = "";
  botRuntime.botAbortController = new AbortController();
  syncLegacyRuntimeFromDefaultBot();

  const agent = {
    async chat(request) {
      return handleInboundWeixinMessage(request, {
        botId: normalizedBotId,
        accountId: account.accountId,
      });
    },
  };

  botRuntime.botTask = (async () => {
    await appendLog("system", `微信监听已启动: ${normalizedBotId} (${account.accountId})`, {
      botId: normalizedBotId,
    });
    try {
      await start(agent, {
        accountId: account.accountId,
        abortSignal: botRuntime.botAbortController.signal,
        log(message) {
          if (/started|启动 bot|resuming|使用第一个/.test(message)) {
            void appendLog("system", message, {
              botId: normalizedBotId,
              targetId: account.accountId,
            });
          }
        },
      });
    } catch (error) {
      if (botRuntime.botAbortController?.signal.aborted) {
        return;
      }

      botRuntime.status = "offline";
      botRuntime.lastError =
        error instanceof Error ? error.message : String(error);
      await appendLog("error", `微信监听异常: ${normalizedBotId}: ${botRuntime.lastError}`, {
        botId: normalizedBotId,
      });
      await scheduleBotRestart(normalizedBotId);
    } finally {
      botRuntime.botTask = null;
      botRuntime.botAbortController = null;
      syncLegacyRuntimeFromDefaultBot();
    }
  })();

  syncLegacyRuntimeFromDefaultBot();
  return botRuntime.botTask;
}

async function startLoginSession(botId = "", force = false) {
  const normalizedBotId = normalizeBotId(botId) || getDefaultBotId();
  const botRuntime = ensureBotRuntime(normalizedBotId);
  if (!botRuntime) {
    return;
  }
  if (botRuntime.loginTask && !force && botRuntime.qrCodeDataUrl) {
    return;
  }

  const qrResponse = await fetchQrCode();
  botRuntime.loginSessionId = crypto.randomUUID();
  botRuntime.status = (await getActiveAccount(normalizedBotId)) ? botRuntime.status : "not_logged_in";
  await applyQrCode(normalizedBotId, qrResponse, "二维码已生成，请使用微信扫码登录");
  await appendLog("system", `已生成新的微信登录二维码: ${normalizedBotId}`, {
    botId: normalizedBotId,
  });

  const currentSessionId = botRuntime.loginSessionId;
  botRuntime.loginTask = (async () => {
    while (botRuntime.loginSessionId === currentSessionId) {
      try {
        const result = await pollQrStatus(qrResponse.qrcode);
        if (botRuntime.loginSessionId !== currentSessionId) {
          return;
        }

        if (result.status === "wait") {
          botRuntime.qrStatus = "wait";
          botRuntime.qrMessage = "等待扫码...";
        } else if (result.status === "scaned") {
          botRuntime.qrStatus = "scaned";
          botRuntime.qrMessage = "已扫码，请在微信中确认登录";
        } else if (result.status === "expired") {
          const refreshedQr = await fetchQrCode();
          await applyQrCode(normalizedBotId, refreshedQr, "二维码已刷新，请重新扫码");
          qrResponse.qrcode = refreshedQr.qrcode;
          qrResponse.qrcode_img_content = refreshedQr.qrcode_img_content;
          await appendLog("system", `微信登录二维码已过期，已自动刷新: ${normalizedBotId}`, {
            botId: normalizedBotId,
          });
        } else if (
          result.status === "confirmed" &&
          result.bot_token &&
          result.ilink_bot_id
        ) {
          await stopBotMonitor(normalizedBotId);
          const normalizedId = await saveWeixinAccount({
            accountId: result.ilink_bot_id,
            botToken: result.bot_token,
            baseUrl: result.baseurl || store.config.baseUrl,
            userId: result.ilink_user_id || "",
          }, normalizedBotId);
          clearQrCode(normalizedBotId);
          botRuntime.loginSessionId = "";
          botRuntime.status = "logged_in";
          botRuntime.currentAccountId = normalizedId;
          botRuntime.lastError = "";
          await appendLog("system", `微信登录成功: ${normalizedBotId} -> ${normalizedId}`, {
            botId: normalizedBotId,
          });
          await startBotMonitor(normalizedBotId);
          return;
        }
      } catch (error) {
        botRuntime.lastError =
          error instanceof Error ? error.message : String(error);
        botRuntime.qrMessage = `扫码状态轮询失败: ${botRuntime.lastError}`;
        await appendLog("error", `${normalizedBotId}: ${botRuntime.qrMessage}`, {
          botId: normalizedBotId,
        });
        return;
      }

      await delay(1_000);
    }
  })()
    .finally(() => {
      if (
        botRuntime.loginSessionId === currentSessionId ||
        botRuntime.loginSessionId === ""
      ) {
        botRuntime.loginTask = null;
      }
      syncLegacyRuntimeFromDefaultBot();
    });
  syncLegacyRuntimeFromDefaultBot();
}

function formatGeneralPushText({ title, content, linkUrl }) {
  return [title?.trim(), content?.trim(), linkUrl ? `链接: ${linkUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function formatFileUrlFallbackText(text, fileUrl, fileName = "", reason = "") {
  const lines = [];
  const content = text?.trim();
  const normalizedName = normalizeOutboundFileName(fileName || inferFileNameFromUrl(fileUrl) || "attachment.bin");
  const url = String(fileUrl || "").trim();
  if (content) {
    lines.push(content);
  }
  lines.push(`文件：${normalizedName}`);
  if (reason) {
    lines.push(`原因：${reason}`);
  }
  if (url) {
    lines.push(`下载：${url}`);
  }
  return lines.filter(Boolean).join("\n\n");
}

async function readLocalFileResource(filePath, fileName = "") {
  const resolvedPath = path.resolve(String(filePath || "").trim());
  const stat = await fs.stat(resolvedPath);
  if (!stat.isFile()) {
    throw new Error(`本地文件不存在或不可读取: ${resolvedPath}`);
  }
  return {
    buffer: await fs.readFile(resolvedPath),
    fileName: normalizeOutboundFileName(fileName || path.basename(resolvedPath) || "attachment.bin"),
    sourcePath: resolvedPath,
  };
}

async function resolveOutboundFileResource({ fileUrl = "", filePath = "", fileName = "" }) {
  const normalizedUrl = String(fileUrl || "").trim();
  const normalizedPath = String(filePath || "").trim();
  if (normalizedUrl) {
    return fetchRemoteFileResource(normalizedUrl, fileName);
  }
  if (normalizedPath) {
    return readLocalFileResource(normalizedPath, fileName);
  }
  return null;
}

async function buildOutboundFilePlan({ fileResource, safeBytes = WECHAT_FILE_SAFE_BYTES }) {
  if (!fileResource?.buffer?.length) {
    throw new Error("文件内容为空，无法发送");
  }

  const originalName = normalizeOutboundFileName(fileResource.fileName || "attachment.bin");
  const originalSize = fileResource.buffer.length;
  if (originalSize <= safeBytes) {
    return {
      mode: "file",
      fileBuffer: fileResource.buffer,
      fileName: originalName,
      originalSize,
      deliveredSize: originalSize,
      compressed: false,
      fallbackReason: "",
      sourceUrl: fileResource.sourceUrl || "",
    };
  }

  if (shouldZipCompressFile(originalName)) {
    const zipped = await createZipBufferFromFile({
      buffer: fileResource.buffer,
      fileName: originalName,
    });
    const zipName = normalizeOutboundFileName(`${originalName}.zip`, "attachment.zip");
    if (zipped.length <= safeBytes) {
      return {
        mode: "file",
        fileBuffer: zipped,
        fileName: zipName,
        originalSize,
        deliveredSize: zipped.length,
        compressed: true,
        fallbackReason: "",
        sourceUrl: fileResource.sourceUrl || "",
      };
    }
    return {
      mode: "link",
      fileName: zipName,
      originalSize,
      deliveredSize: zipped.length,
      compressed: true,
      fallbackReason: `ZIP 压缩后仍超过 ${safeBytes} bytes`,
      sourceUrl: fileResource.sourceUrl || "",
    };
  }

  if (!fileResource.sourceUrl) {
    return {
      mode: "reject",
      fileName: originalName,
      originalSize,
      deliveredSize: originalSize,
      compressed: false,
      fallbackReason: `文件超过 ${safeBytes} bytes，且当前没有可回退的下载链接`,
      sourceUrl: "",
    };
  }

  return {
    mode: "link",
    fileName: originalName,
    originalSize,
    deliveredSize: originalSize,
    compressed: false,
    fallbackReason: isKnownLowCompressionFile(originalName)
      ? "该文件类型压缩收益低，已直接改为下载链接"
      : `文件超过 ${safeBytes} bytes，已改为下载链接`,
    sourceUrl: fileResource.sourceUrl || "",
  };
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function lowercaseKeys(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(lowercaseKeys);
  return Object.keys(obj).reduce((acc, key) => {
    acc[key.toLowerCase()] = lowercaseKeys(obj[key]);
    return acc;
  }, {});
}

function extractMoviePilotPayload(rawPayload) {
  // 将所有 JSON Key 转换为小写，兼容 Emby (Title, Description) 等 PascalCase 格式
  const payload = lowercaseKeys(rawPayload ?? {});
  
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const media = data.media && typeof data.media === "object" ? data.media : {};
  const mediaInfo =
    data.media_info && typeof data.media_info === "object" ? data.media_info : {};

  // 尝试穿透 Emby 特有字段
  const embyDetails = [];
  if (payload.server?.name) embyDetails.push(`服务器: ${payload.server.name}`);
  if (payload.user?.name) embyDetails.push(`用户: ${payload.user.name}`);

  const title = pickFirstString(
    payload.title,
    data.title,
    data.name,
    data.subject,
    payload.subject,
    media.title,
    media.name,
    mediaInfo.title,
    mediaInfo.name,
    payload.event, // 作为 fallback
  );

  let body = pickFirstString(
    payload.description,
    payload.content,
    data.content,
    data.description,
    data.overview,
    data.message,
    media.overview,
    media.description,
    mediaInfo.overview,
    mediaInfo.description,
  );

  const posterUrl = pickFirstString(
    payload.poster,
    payload.poster_url,
    payload.image,
    payload.image_url,
    payload.cover,
    payload.cover_url,
    data.poster,
    data.poster_url,
    data.image,
    data.image_url,
    data.cover,
    data.cover_url,
    media.poster,
    media.poster_url,
    media.cover,
    media.cover_url,
    mediaInfo.poster,
    mediaInfo.poster_url,
    mediaInfo.cover,
    mediaInfo.cover_url,
  );

  const linkUrl = pickFirstString(
    payload.link,
    payload.url,
    data.link,
    data.url,
    media.link,
    media.url,
    mediaInfo.link,
    mediaInfo.url,
  );

  const contentParts = [];
  // 屏蔽事件名 (如 事件: NOTICE.MESSAGE / transfer.complete 等) 不再发送给微信
  if (embyDetails.length > 0) contentParts.push(embyDetails.join(" | "));
  if (body) contentParts.push(body);

  const content = contentParts.join("\n");

  return {
    title: title || "系统通知",
    content: content || "",
    posterUrl,
    linkUrl,
  };
}

function resolveRecipients(payload, fallbackTargetIds = [], options = {}) {
  const manualIds = [];
  const manualUserIds = [];
  const manualCapabilities = [];
  const manualBotIds = [];

  if (typeof payload.targetId === "string" && payload.targetId.trim()) {
    manualIds.push(payload.targetId.trim());
  }

  if (typeof payload.replyTargetId === "string" && payload.replyTargetId.trim()) {
    manualIds.push(payload.replyTargetId.trim());
  }

  if (typeof payload.userId === "string" && payload.userId.trim()) {
    manualUserIds.push(payload.userId.trim());
  }

  if (typeof payload.replyUserId === "string" && payload.replyUserId.trim()) {
    manualUserIds.push(payload.replyUserId.trim());
  }

  if (typeof payload.capability === "string" && payload.capability.trim()) {
    manualCapabilities.push(payload.capability.trim());
  }

  if (typeof payload.botId === "string" && payload.botId.trim()) {
    manualBotIds.push(payload.botId.trim());
  }

  for (const item of parseStringList(payload.targetIds)) {
    manualIds.push(item);
  }

  for (const item of parseStringList(payload.replyTargetIds)) {
    manualIds.push(item);
  }

  for (const item of parseUserIdList(payload.userIds)) {
    manualUserIds.push(item);
  }

  for (const item of parseUserIdList(payload.replyUserIds)) {
    manualUserIds.push(item);
  }

  for (const item of parseCapabilityList(payload.capabilities)) {
    manualCapabilities.push(item);
  }

  for (const item of parseBotIdList(payload.botIds)) {
    manualBotIds.push(item);
  }

  const selectedBotIds = parseBotIdList(
    manualBotIds.length ? manualBotIds : options.botIds ?? [],
  );

  const resolvedExplicitTargets = uniqueRecipients(
    manualIds.map((item) => {
      const parsed = parseTargetKey(item);
      if (parsed.botId && parsed.targetId) {
        return parsed;
      }
      if (selectedBotIds.length === 1 && parsed.targetId) {
        return {
          botId: selectedBotIds[0],
          targetId: parsed.targetId,
        };
      }
      const matchedTargets = store.targets.items.filter(
        (target) =>
          target.targetId === parsed.targetId &&
          (!selectedBotIds.length || selectedBotIds.includes(target.botId)),
      );
      return matchedTargets.length === 1
        ? {
            botId: matchedTargets[0].botId,
            targetId: matchedTargets[0].targetId,
          }
        : null;
    }),
  );

  const resolvedUsers = resolveTargetsForUserIds(manualUserIds, { botIds: selectedBotIds });
  if (resolvedUsers.missingUserIds.length) {
    return {
      recipients: [],
      missingUserIds: resolvedUsers.missingUserIds,
      missingCapabilities: [],
    };
  }

  const explicitRecipients = uniqueRecipients([
    ...resolvedExplicitTargets,
    ...resolvedUsers.recipients,
  ]);
  if (explicitRecipients.length || manualUserIds.length) {
    return {
      recipients: explicitRecipients,
      missingUserIds: [],
      missingCapabilities: [],
    };
  }

  const explicitCapabilities = resolveTargetsForCapabilities(manualCapabilities, {
    botIds: selectedBotIds,
  });
  if (manualCapabilities.length) {
    return {
      recipients: explicitCapabilities.recipients,
      missingUserIds: [],
      missingCapabilities: explicitCapabilities.missingCapabilities,
    };
  }

  const matchedRuleRecipients = resolveRecipientsFromNotificationRules(payload, {
    ...options,
    botIds: selectedBotIds,
  });
  if (matchedRuleRecipients.recipients.length) {
    return {
      recipients: matchedRuleRecipients.recipients,
      missingUserIds: [],
      missingCapabilities: [],
    };
  }

  if (matchedRuleRecipients.matchedRuleIds.length && matchedRuleRecipients.allowDefaultRecipient) {
    const fallbackRecipients = fallbackTargetIds.length
      ? uniqueRecipients(
          fallbackTargetIds.map((item) => {
            const parsed = parseTargetKey(item);
            return parsed.botId && parsed.targetId
              ? parsed
              : {
                  botId: selectedBotIds[0] || getDefaultBotId(),
                  targetId: parsed.targetId,
                };
          }),
        )
      : getDefaultRecipients(
          matchedRuleRecipients.botIds.length ? matchedRuleRecipients.botIds : selectedBotIds,
        );
    return {
      recipients: fallbackRecipients,
      missingUserIds: [],
      missingCapabilities: [],
    };
  }

  if (matchedRuleRecipients.matchedRuleIds.length) {
    return {
      recipients: [],
      missingUserIds: [],
      missingCapabilities: [],
    };
  }

  const inferredCapabilities = inferCapabilitiesForPassiveNotification(payload, options);
  const inferredCapabilityRecipients = resolveTargetsForCapabilities(inferredCapabilities, {
    botIds: selectedBotIds,
  });
  if (inferredCapabilityRecipients.recipients.length) {
    return {
      recipients: inferredCapabilityRecipients.recipients,
      missingUserIds: [],
      missingCapabilities: [],
    };
  }

  const defaultRecipients = getDefaultRecipients(selectedBotIds);

  return {
    recipients: fallbackTargetIds.length
      ? uniqueRecipients(
          fallbackTargetIds.map((item) => {
            const parsed = parseTargetKey(item);
            return parsed.botId && parsed.targetId
              ? parsed
              : {
                  botId: selectedBotIds[0] || getDefaultBotId(),
                  targetId: parsed.targetId,
                };
          }),
        )
      : defaultRecipients,
    missingUserIds: [],
    missingCapabilities: [],
  };
}

function formatMissingUserIdsError(userIds) {
  return `以下 userId 未绑定微信目标: ${uniqueList(userIds).join(", ")}`;
}

function formatMissingCapabilitiesError(capabilities) {
  return `以下 capability 未绑定接收人: ${uniqueList(capabilities).join(", ")}`;
}

const PROACTIVE_WINDOW_HOURS = 24;
const PROACTIVE_MESSAGE_BUDGET = 10;
const PROACTIVE_QUOTA_WARNING_AT = 10;
const WINDOW_CLOSING_REMINDER_LEAD_MS = 5 * 60_000;
const DELIVERY_WINDOW_REMINDER_POLL_MS = 60_000;

function buildWindowClosingReminderText() {
  return [
    "提醒：这个微信通知窗口还有约 5 分钟就会关闭。",
    "",
    "如果你还想继续收到通知，直接回复 ClawBot 任意内容即可恢复。",
  ].join("\n");
}

function buildProactiveQuotaWarningText() {
  return [
    "提醒：本轮主动通知额度即将用完。",
    "",
    "如果后面还要继续接收通知，直接回复 ClawBot 任意内容即可恢复。",
  ].join("\n");
}

function buildCombinedProactiveReminderText() {
  return [
    "提醒：这个微信通知窗口还有约 5 分钟就会关闭，本轮主动通知额度也即将用完。",
    "",
    "如果你还想继续收到通知，直接回复 ClawBot 任意内容即可恢复。",
  ].join("\n");
}

function buildProactiveReminderText(nextProactiveCount, { isWindowClosing = false } = {}) {
  const isQuotaWarning = Number(nextProactiveCount) === PROACTIVE_QUOTA_WARNING_AT;
  if (isWindowClosing && isQuotaWarning) {
    return buildCombinedProactiveReminderText();
  }
  if (isWindowClosing) {
    return buildWindowClosingReminderText();
  }
  if (isQuotaWarning) {
    return buildProactiveQuotaWarningText();
  }
  return "";
}

function appendProactiveQuotaWarning(text, nextProactiveCount, options = {}) {
  const warning = buildProactiveReminderText(nextProactiveCount, options);
  if (!warning) {
    return text;
  }
  if (!text) {
    return warning;
  }
  if (String(text).includes(warning)) {
    return text;
  }
  return `${warning}\n\n${text}`;
}

function formatDirectSendWindowRestrictionMessage(reason) {
  if (reason === "quota_exhausted") {
    return "当前微信本轮 10 条主动消息额度已用完，请先让对方回复任意内容后再发送。";
  }
  if (reason === "window_closed" || reason === "window_expired") {
    return "当前微信 24 小时主动消息窗口未打开或已过期，请先让对方回复任意内容后再发送。";
  }
  return `当前消息暂时无法主动发送: ${reason}`;
}

function normalizeNotificationText(value) {
  return String(value || "").toLowerCase();
}

function classifyMoviePilotNotification(title, content) {
  const haystack = `${normalizeNotificationText(title)}\n${normalizeNotificationText(content)}`;
  if (/失败|错误|异常|未找到|无法|中止|入库失败|下载失败/.test(haystack)) {
    return { category: "mp_error", priority: "important" };
  }
  if (/刷新|扫描|检查|同步/.test(haystack)) {
    return { category: "mp_noise", priority: "noisy" };
  }
  return { category: "mp_notice", priority: "important" };
}

function classifyNotificationMeta({ source, title, content }) {
  const normalizedSource = normalizeNotificationText(source);
  const haystack = `${normalizedSource}\n${normalizeNotificationText(title)}\n${normalizeNotificationText(content)}`;

  if (normalizedSource === "moviepilot" || /moviepilot|影视|订阅|下载|入库|\bmp\b/.test(haystack)) {
    return classifyMoviePilotNotification(title, content);
  }
  if (normalizedSource === "homeassistant" || /homeassistant|home assistant|\bha\b/.test(haystack)) {
    const critical = /烟雾|漏水|门锁|门磁|报警|断电|离线|异常/.test(haystack);
    return { category: "ha_notice", priority: critical ? "critical" : "important" };
  }
  if (normalizedSource === "ops" || /\bops\b|glances|运维|监控|告警/.test(haystack)) {
    const critical = /failed|down|error|异常|离线|磁盘|cpu|内存|崩溃/.test(haystack);
    return { category: "ops", priority: critical ? "critical" : "important" };
  }
  if (normalizedSource === "bilisync" || /bilisync|bili-sync|b站|up主/.test(haystack)) {
    const failed = /失败|error|异常/.test(haystack);
    return { category: "bili_sync", priority: failed ? "important" : "normal" };
  }
  if (normalizedSource === "jianfei" || /减肥|体重|热量|步数|饮食/.test(haystack)) {
    return { category: "diet", priority: "important" };
  }
  if (normalizedSource === "codex" || /codex/.test(haystack)) {
    return { category: "codex", priority: "normal" };
  }
  if (normalizedSource === "beike" || /beike|贝壳/.test(haystack)) {
    return { category: "beike", priority: "normal" };
  }
  if (normalizedSource === "pricereader" || /pricereader|好价|低价|降价/.test(haystack)) {
    return { category: "pricereader", priority: "important" };
  }
  return { category: normalizedSource || "generic", priority: "normal" };
}

function inferJianfeiReportType({ source, title, content, rawPayload }) {
  const normalizedSource = normalizeNotificationText(source);
  const haystack = [
    normalizedSource,
    title,
    content,
    rawPayload?.type,
    rawPayload?.event,
  ]
    .map((item) => normalizeNotificationText(item))
    .join("\n");
  if (!(normalizedSource === "jianfei" || /jianfei|减肥/.test(haystack))) {
    return "";
  }
  if (/daily_report|日报/.test(haystack)) {
    return "daily";
  }
  if (/weekly_report|周报/.test(haystack)) {
    return "weekly";
  }
  if (/monthly_report|月报/.test(haystack)) {
    return "monthly";
  }
  return "";
}

function resolveImageDeliveryMode({ source, title, content, rawPayload }) {
  const normalizedSource = normalizeNotificationText(source);
  const haystack = `${normalizedSource}\n${normalizeNotificationText(title)}\n${normalizeNotificationText(content)}`;
  if (normalizedSource === "moviepilot" || /moviepilot|影视|订阅|下载|入库|\bmp\b/.test(haystack)) {
    return "text_with_url";
  }
  if (inferJianfeiReportType({ source, title, content, rawPayload })) {
    return "image_only";
  }
  return "upload";
}

function formatImageUrlFallbackText(text, imageUrl, { label = "图片" } = {}) {
  const content = text?.trim() || "";
  const url = String(imageUrl || "").trim();
  if (!url) {
    return content;
  }
  return [content, `${label}: ${url}`].filter(Boolean).join("\n\n");
}

function getImageUrlLabel({ source, title, content }) {
  const normalizedSource = normalizeNotificationText(source);
  const haystack = `${normalizedSource}\n${normalizeNotificationText(title)}\n${normalizeNotificationText(content)}`;
  return normalizedSource === "moviepilot" || /moviepilot|影视|订阅|下载|入库|\bmp\b/.test(haystack)
    ? "海报"
    : "图片";
}

function getWeixinMessageWeight({ text, imageUrl, imageDeliveryMode, fileUrl = "", filePath = "" }) {
  if (!imageUrl) {
    if (fileUrl || filePath) {
      return text?.trim() ? 2 : 1;
    }
    return text?.trim() ? 1 : 0;
  }
  if (imageDeliveryMode === "upload") {
    return text?.trim() ? 2 : 1;
  }
  return 1;
}

function getQueuedReplayImageOrder(item) {
  const reportType = inferJianfeiReportType({
    source: item?.source,
    title: item?.title,
    content: item?.content,
    rawPayload: null,
  });
  if (reportType === "daily") return 0;
  if (reportType === "weekly") return 1;
  if (reportType === "monthly") return 2;
  return 99;
}

function deliveryWindowKey(botId, targetId) {
  return `${normalizeBotId(botId)}::${String(targetId || "").trim()}`;
}

async function getDeliveryWindow(botId, targetId) {
  const normalizedBotId = normalizeBotId(botId);
  const normalizedTargetId = String(targetId || "").trim();
  if (!normalizedBotId || !normalizedTargetId) {
    return null;
  }
  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT bot_id, target_id, last_user_message_at, proactive_count, last_proactive_message_at, closing_reminder_sent_at, updated_at
     FROM delivery_windows
     WHERE key = ?`,
    [deliveryWindowKey(normalizedBotId, normalizedTargetId)],
  );
  if (!result[0]?.values?.length) {
    return null;
  }
  const row = result[0].values[0];
  return {
    botId: row[0],
    targetId: row[1],
    lastUserMessageAt: row[2] || "",
    proactiveCount: Number(row[3] || 0),
    lastProactiveMessageAt: row[4] || "",
    closingReminderSentAt: row[5] || "",
    updatedAt: row[6] || "",
  };
}

async function upsertDeliveryWindow(window) {
  const db = await ensureSqliteDb();
  const now = window.updatedAt || new Date().toISOString();
  db.run(
    `INSERT OR REPLACE INTO delivery_windows
      (key, bot_id, target_id, last_user_message_at, proactive_count, last_proactive_message_at, closing_reminder_sent_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deliveryWindowKey(window.botId, window.targetId),
      window.botId,
      window.targetId,
      window.lastUserMessageAt || "",
      Number(window.proactiveCount || 0),
      window.lastProactiveMessageAt || "",
      window.closingReminderSentAt || "",
      now,
    ],
  );
  await persistSqliteDb();
}

async function noteInboundWindowActivity(botId, targetId) {
  const normalizedBotId = normalizeBotId(botId);
  const normalizedTargetId = String(targetId || "").trim();
  if (!normalizedBotId || !normalizedTargetId) {
    return;
  }
  const now = new Date().toISOString();
  await upsertDeliveryWindow({
    botId: normalizedBotId,
    targetId: normalizedTargetId,
    lastUserMessageAt: now,
    proactiveCount: 0,
    lastProactiveMessageAt: "",
    closingReminderSentAt: "",
    updatedAt: now,
  });
}

async function noteProactiveWindowDelivery(botId, targetId, increment = 1) {
  const normalizedBotId = normalizeBotId(botId);
  const normalizedTargetId = String(targetId || "").trim();
  const step = Math.max(1, Number.parseInt(String(increment || 1), 10) || 1);
  if (!normalizedBotId || !normalizedTargetId) {
    return;
  }
  const current = (await getDeliveryWindow(normalizedBotId, normalizedTargetId)) || {
    botId: normalizedBotId,
    targetId: normalizedTargetId,
    lastUserMessageAt: "",
    proactiveCount: 0,
    lastProactiveMessageAt: "",
    closingReminderSentAt: "",
  };
  const now = new Date().toISOString();
  await upsertDeliveryWindow({
    ...current,
    proactiveCount: Number(current.proactiveCount || 0) + step,
    lastProactiveMessageAt: now,
    updatedAt: now,
  });
}

async function markWindowClosingReminderSent(botId, targetId) {
  const normalizedBotId = normalizeBotId(botId);
  const normalizedTargetId = String(targetId || "").trim();
  if (!normalizedBotId || !normalizedTargetId) {
    return;
  }
  const current = await getDeliveryWindow(normalizedBotId, normalizedTargetId);
  if (!current) {
    return;
  }
  const now = new Date().toISOString();
  await upsertDeliveryWindow({
    ...current,
    closingReminderSentAt: now,
    updatedAt: now,
  });
}

async function getNextProactiveCount(botId, targetId, increment = 1) {
  const current = await getDeliveryWindow(botId, targetId);
  const step = Math.max(1, Number.parseInt(String(increment || 1), 10) || 1);
  return Number(current?.proactiveCount || 0) + step;
}

async function canActivelyPush(botId, targetId, priority, messageCount = 1) {
  if (priority === "noisy") {
    return { allowed: false, reason: "noisy" };
  }
  const step = Math.max(1, Number.parseInt(String(messageCount || 1), 10) || 1);
  const current = await getDeliveryWindow(botId, targetId);
  if (!current?.lastUserMessageAt) {
    return { allowed: false, reason: "window_closed" };
  }
  const lastUserAt = new Date(current.lastUserMessageAt).getTime();
  if (!Number.isFinite(lastUserAt) || lastUserAt + PROACTIVE_WINDOW_HOURS * 60 * 60_000 < Date.now()) {
    return { allowed: false, reason: "window_expired" };
  }
  if (Number(current.proactiveCount || 0) + step - 1 >= PROACTIVE_MESSAGE_BUDGET) {
    return { allowed: false, reason: "quota_exhausted" };
  }
  return { allowed: true, reason: "ok" };
}

async function enqueuePendingNotification(record) {
  const db = await ensureSqliteDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO pending_notifications
      (id, created_at, bot_id, target_id, source, category, priority, title, content, rendered_text, image_url, file_url, file_name, state, raw_payload_json, extra_json, released_at, release_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      now,
      record.botId,
      record.targetId,
      record.source || "",
      record.category || "",
      record.priority || "",
      record.title || "",
      record.content || "",
      record.renderedText || "",
      record.imageUrl || "",
      record.fileUrl || "",
      record.fileName || "",
      "queued",
      stringifyJson(record.rawPayload),
      stringifyJson(record.extra),
      "",
      "",
    ],
  );
  await persistSqliteDb();
  return id;
}

async function listQueuedNotifications(botId, targetId, limit = 0) {
  const db = await ensureSqliteDb();
  const normalizedBotId = normalizeBotId(botId);
  const normalizedTargetId = String(targetId || "").trim();
  const sql =
    limit > 0
      ? `SELECT id, created_at, source, category, priority, title, content, rendered_text, image_url, file_url, file_name
         FROM pending_notifications
         WHERE bot_id = ? AND target_id = ? AND state = 'queued'
         ORDER BY created_at ASC
         LIMIT ?`
      : `SELECT id, created_at, source, category, priority, title, content, rendered_text, image_url, file_url, file_name
         FROM pending_notifications
         WHERE bot_id = ? AND target_id = ? AND state = 'queued'
         ORDER BY created_at ASC`;
  const params =
    limit > 0
      ? [normalizedBotId, normalizedTargetId, limit]
      : [normalizedBotId, normalizedTargetId];
  const result = db.exec(
    sql,
    params,
  );
  return (result[0]?.values || []).map((row) => ({
    id: row[0],
    createdAt: row[1],
    source: row[2],
    category: row[3],
    priority: row[4],
    title: row[5],
    content: row[6],
    renderedText: row[7],
    imageUrl: row[8],
    fileUrl: row[9],
    fileName: row[10],
  }));
}

async function releaseQueuedNotifications(ids, reason = "released_on_user_message") {
  if (!ids.length) {
    return;
  }
  const db = await ensureSqliteDb();
  const placeholders = ids.map(() => "?").join(", ");
  const now = new Date().toISOString();
  db.run(
    `UPDATE pending_notifications
     SET state = 'released', released_at = ?, release_reason = ?
     WHERE id IN (${placeholders})`,
    [now, reason, ...ids],
  );
  await persistSqliteDb();
}

function getQueuedCategoryKey(item) {
  return String(item?.category || item?.source || "generic").trim() || "generic";
}

function getQueuedCategoryLabel(categoryKey) {
  return QUEUED_CATEGORY_LABELS[categoryKey] || categoryKey || "其他";
}

function getQueuedItemBody(item, options = {}) {
  const baseText = item.renderedText || [item.title, item.content].filter(Boolean).join("\n\n");
  if (typeof options.includeImageUrlForItem === "function") {
    const includeImageUrl = options.includeImageUrlForItem(item);
    if (!includeImageUrl || !item.imageUrl || baseText.includes(item.imageUrl)) {
      if (typeof options.includeFileUrlForItem === "function") {
        const includeFileUrl = options.includeFileUrlForItem(item);
        if (!includeFileUrl || !item.fileUrl || baseText.includes(item.fileUrl)) {
          return baseText;
        }
        const label = item.fileName ? `文件(${item.fileName})` : "文件";
        return [baseText, `${label}: ${item.fileUrl}`].filter(Boolean).join("\n");
      }
      return baseText;
    }
    return [baseText, `图片: ${item.imageUrl}`].filter(Boolean).join("\n");
  }
  if (typeof options.includeFileUrlForItem === "function") {
    const includeFileUrl = options.includeFileUrlForItem(item);
    if (!includeFileUrl || !item.fileUrl || baseText.includes(item.fileUrl)) {
      return baseText;
    }
    const label = item.fileName ? `文件(${item.fileName})` : "文件";
    return [baseText, `${label}: ${item.fileUrl}`].filter(Boolean).join("\n");
  }
  if (options.includeImageUrl === false || !item.imageUrl || baseText.includes(item.imageUrl)) {
    return baseText;
  }

  return [baseText, `图片: ${item.imageUrl}`].filter(Boolean).join("\n");
}

function sortQueuedNotificationsForReplay(items) {
  return [...items].sort((left, right) => {
    const leftCategory = getQueuedCategoryKey(left);
    const rightCategory = getQueuedCategoryKey(right);
    const categoryCompare = leftCategory.localeCompare(rightCategory, "zh-CN");
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
      return Number.isFinite(leftTime) ? -1 : 1;
    }

    return String(left.id || "").localeCompare(String(right.id || ""), "zh-CN");
  });
}

function sortQueuedImagesForReplay(items) {
  return [...items].sort((left, right) => {
    const orderCompare = getQueuedReplayImageOrder(left) - getQueuedReplayImageOrder(right);
    if (orderCompare !== 0) {
      return orderCompare;
    }

    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
      return Number.isFinite(leftTime) ? -1 : 1;
    }

    return String(left.id || "").localeCompare(String(right.id || ""), "zh-CN");
  });
}

function formatQueuedReplayText(items, options = {}) {
  const sortedItems = sortQueuedNotificationsForReplay(items);
  if (!sortedItems.length) {
    return "";
  }

  const groups = new Map();
  for (const item of sortedItems) {
    const categoryKey = getQueuedCategoryKey(item);
    const group = groups.get(categoryKey) || [];
    group.push(item);
    groups.set(categoryKey, group);
  }

  const lines = [`你有 ${sortedItems.length} 条积存通知，已按类别整理：`];
  let index = 0;

  const groupEntries = Array.from(groups.entries());
  for (const [groupIndex, [categoryKey, groupItems]] of groupEntries.entries()) {
    lines.push("", `【${getQueuedCategoryLabel(categoryKey)}】${groupItems.length} 条`, "");
    for (const [itemIndex, item] of groupItems.entries()) {
      index += 1;
      const timestamp = formatBeijingReplayMarker(item.createdAt);
      const body = getQueuedItemBody(item, options);
      lines.push(timestamp ? `${index}      ${timestamp}` : String(index));
      if (body) {
        lines.push(body);
      }
      if (itemIndex < groupItems.length - 1) {
        lines.push("");
      }
    }
    if (groupIndex < groupEntries.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function replayQueuedNotifications(botId, targetId, items) {
  const account = await getActiveAccount(botId);
  if (!account || !items.length) {
    return { sentIds: [], failed: [] };
  }

  const replayItems = sortQueuedNotificationsForReplay(items);
  const textItems = replayItems.filter((item) => {
    const mode = resolveImageDeliveryMode({
      source: item.source,
      title: item.title,
      content: item.content,
      rawPayload: null,
    });
    return !(mode === "image_only" && item.imageUrl);
  });
  const imageItems = sortQueuedImagesForReplay(
    replayItems.filter((item) => {
      const mode = resolveImageDeliveryMode({
        source: item.source,
        title: item.title,
        content: item.content,
        rawPayload: null,
      });
      return mode === "image_only" && item.imageUrl;
    }),
  );
  const fileItems = replayItems.filter((item) => item.fileUrl);
  const sentIds = [];
  const failed = [];

  if (textItems.length) {
    const replayText = appendProactiveQuotaWarning(
      formatQueuedReplayText(textItems, {
        includeImageUrlForItem(item) {
          const mode = resolveImageDeliveryMode({
            source: item?.source,
            title: item?.title,
            content: item?.content,
            rawPayload: null,
          });
          return mode !== "image_only";
        },
        includeFileUrlForItem(item) {
          return !item?.fileUrl;
        },
      }),
      await getNextProactiveCount(botId, targetId),
    );
    try {
      await sendWeixinText({
        account,
        to: targetId,
        text: replayText,
      });
      await noteProactiveWindowDelivery(botId, targetId);
      await appendLog("outbound", `积存重放 -> ${botId}:${targetId}: ${truncateText(replayText, 120)}`, {
        botId,
        targetId,
      });
      await appendConversationMessage({
        botId,
        targetId,
        direction: "outbound",
        text: replayText,
        source: "pending-replay",
      });
      sentIds.push(...textItems.map((item) => item.id));
    } catch (error) {
      return {
        sentIds,
        failed: textItems.map((item) => ({
          id: item.id,
          error: error instanceof Error ? error.message : String(error),
        })),
      };
    }
  }

  for (const item of imageItems) {
    const proactiveCheck = await canActivelyPush(botId, targetId, item.priority || "important");
    if (!proactiveCheck.allowed) {
      break;
    }

    try {
      await sendWeixinTextAndImage({
        account,
        to: targetId,
        text: "",
        imageUrl: item.imageUrl,
      });
      await noteProactiveWindowDelivery(botId, targetId);
      await appendLog(
        "outbound",
        `积存图片重放 -> ${botId}:${targetId}: ${truncateText(item.title || item.content || item.imageUrl, 120)}`,
        {
          botId,
          targetId,
        },
      );
      await appendConversationMessage({
        botId,
        targetId,
        direction: "outbound",
        text: `[图片] ${item.imageUrl}`,
        source: "pending-replay-image",
      });
      sentIds.push(item.id);
    } catch (error) {
      failed.push({
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  for (const item of fileItems) {
    const proactiveCheck = await canActivelyPush(botId, targetId, item.priority || "important");
    if (!proactiveCheck.allowed) {
      break;
    }

    try {
      const fileResource = await resolveOutboundFileResource({
        fileUrl: item.fileUrl,
        fileName: item.fileName,
      });
      if (!fileResource) {
        throw new Error("积存文件缺少 fileUrl，无法重放");
      }
      const filePlan = await buildOutboundFilePlan({ fileResource });
      if (filePlan.mode === "reject") {
        throw new Error(filePlan.fallbackReason);
      }
      if (filePlan.mode === "link") {
        const fallbackText = appendProactiveQuotaWarning(
          formatFileUrlFallbackText(item.renderedText || [item.title, item.content].filter(Boolean).join("\n\n"), filePlan.sourceUrl || item.fileUrl, filePlan.fileName, filePlan.fallbackReason),
          await getNextProactiveCount(botId, targetId),
        );
        await sendWeixinText({
          account,
          to: targetId,
          text: fallbackText,
        });
        await noteProactiveWindowDelivery(botId, targetId);
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: fallbackText,
          source: "pending-replay-file-link",
        });
      } else {
        const uploaded = await uploadFileAttachmentToWeixin({
          account,
          to: targetId,
          buffer: filePlan.fileBuffer,
          fileName: filePlan.fileName,
        });
        await sendWeixinFile({
          account,
          to: targetId,
          uploaded,
        });
        await noteProactiveWindowDelivery(botId, targetId);
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: `[文件] ${filePlan.fileName}`,
          source: "pending-replay-file",
        });
      }
      await appendLog(
        "outbound",
        `积存文件重放 -> ${botId}:${targetId}: ${truncateText(item.fileName || item.title || item.fileUrl, 120)}`,
        {
          botId,
          targetId,
        },
      );
      sentIds.push(item.id);
    } catch (error) {
      failed.push({
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return { sentIds, failed };
}

async function listPendingNotificationsOverview(limit = 20) {
  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT id, created_at, bot_id, target_id, source, category, priority, title, content, rendered_text, file_name, state
     FROM pending_notifications
     WHERE state = 'queued'
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );
  return (result[0]?.values || []).map((row) => ({
    id: row[0],
    createdAt: row[1],
    botId: row[2],
    targetId: row[3],
    source: row[4],
    category: row[5],
    priority: row[6],
    title: row[7],
    content: row[8],
    renderedText: row[9],
    fileName: row[10] || "",
    state: row[11],
  }));
}

async function listDeliveryWindowsOverview(limit = 50) {
  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT bot_id, target_id, last_user_message_at, proactive_count, last_proactive_message_at, updated_at
     FROM delivery_windows
     ORDER BY updated_at DESC
     LIMIT ?`,
    [limit],
  );
  return (result[0]?.values || []).map((row) => ({
    botId: row[0],
    targetId: row[1],
    lastUserMessageAt: row[2],
    proactiveCount: Number(row[3] || 0),
    lastProactiveMessageAt: row[4],
    updatedAt: row[5],
  }));
}

async function listDeliveryWindowsForReminder() {
  const db = await ensureSqliteDb();
  const result = db.exec(
    `SELECT bot_id, target_id, last_user_message_at, proactive_count, last_proactive_message_at, closing_reminder_sent_at, updated_at
     FROM delivery_windows`,
  );
  return (result[0]?.values || []).map((row) => ({
    botId: row[0],
    targetId: row[1],
    lastUserMessageAt: row[2] || "",
    proactiveCount: Number(row[3] || 0),
    lastProactiveMessageAt: row[4] || "",
    closingReminderSentAt: row[5] || "",
    updatedAt: row[6] || "",
  }));
}

async function sendWindowClosingReminder(window) {
  const proactiveCheck = await canActivelyPush(window.botId, window.targetId, "important");
  if (!proactiveCheck.allowed) {
    return false;
  }
  const account = await getActiveAccount(window.botId);
  if (!account) {
    return false;
  }

  const reminderText =
    buildProactiveReminderText(await getNextProactiveCount(window.botId, window.targetId), {
      isWindowClosing: true,
    }) || buildWindowClosingReminderText();

  await sendWeixinText({
    account,
    to: window.targetId,
    text: reminderText,
  });
  await noteProactiveWindowDelivery(window.botId, window.targetId);
  await markWindowClosingReminderSent(window.botId, window.targetId);
  await appendLog(
    "outbound",
    `窗口提醒 -> ${window.botId}:${window.targetId}: ${truncateText(reminderText, 120)}`,
    {
      botId: window.botId,
      targetId: window.targetId,
    },
  );
  await appendConversationMessage({
    botId: window.botId,
    targetId: window.targetId,
    direction: "outbound",
    text: reminderText,
    source: "window-reminder",
  });
  return true;
}

async function processDeliveryWindowReminders() {
  if (SKIP_REMOTE_BOOT || runtime.status === "test_mode") {
    return;
  }

  const now = Date.now();
  const windows = await listDeliveryWindowsForReminder();
  for (const window of windows) {
    const lastUserAt = new Date(window.lastUserMessageAt).getTime();
    if (!Number.isFinite(lastUserAt)) {
      continue;
    }
    const expiresAt = lastUserAt + PROACTIVE_WINDOW_HOURS * 60 * 60_000;
    const remindAt = expiresAt - WINDOW_CLOSING_REMINDER_LEAD_MS;
    if (now < remindAt || now >= expiresAt) {
      continue;
    }
    const reminderSentAt = new Date(window.closingReminderSentAt || "").getTime();
    if (Number.isFinite(reminderSentAt) && reminderSentAt >= lastUserAt) {
      continue;
    }

    try {
      await sendWindowClosingReminder(window);
    } catch (error) {
      await appendLog(
        "error",
        `窗口提醒发送失败: ${window.botId}:${window.targetId}: ${error instanceof Error ? error.message : String(error)}`,
        {
          botId: window.botId,
          targetId: window.targetId,
        },
      );
    }
  }
}

function startDeliveryWindowReminderLoop() {
  if (runtime.deliveryWindowReminderTimer || SKIP_REMOTE_BOOT) {
    return;
  }

  runtime.deliveryWindowReminderTimer = setInterval(() => {
    void processDeliveryWindowReminders();
  }, DELIVERY_WINDOW_REMINDER_POLL_MS);
  void processDeliveryWindowReminders();
}

async function sendPushToRecipients({
  recipients,
  text,
  imageUrl = "",
  fileUrl = "",
  filePath = "",
  fileName = "",
  source = "push",
  notificationContext = {},
}) {
  const results = [];
  const normalizedFileUrl = String(fileUrl || "").trim();
  const normalizedFilePath = String(filePath || "").trim();
  const normalizedFileName = normalizeOutboundFileName(fileName || inferFileNameFromUrl(fileUrl) || "attachment.bin");
  let sharedFileBundlePromise = null;

  const getSharedFileBundle = async () => {
    if (!normalizedFileUrl && !normalizedFilePath) {
      return null;
    }
    if (!sharedFileBundlePromise) {
      sharedFileBundlePromise = (async () => {
        const resource = await resolveOutboundFileResource({
          fileUrl: normalizedFileUrl,
          filePath: normalizedFilePath,
          fileName: normalizedFileName,
        });
        const plan = resource ? await buildOutboundFilePlan({ fileResource: resource }) : null;
        return { resource, plan };
      })();
    }
    return sharedFileBundlePromise;
  };

  for (const recipient of recipients) {
    const botId = normalizeBotId(recipient?.botId) || getDefaultBotId();
    const targetId = String(recipient?.targetId || "").trim();
    if (!botId || !targetId) {
      continue;
    }

    const classification = classifyNotificationMeta({
      source: notificationContext.source || source,
      title: notificationContext.title || text,
      content: notificationContext.content || text,
    });
    const imageDeliveryMode = resolveImageDeliveryMode({
      source: notificationContext.source || source,
      title: notificationContext.title || text,
      content: notificationContext.content || text,
      rawPayload: notificationContext.rawPayload,
    });
    const messageWeight = getWeixinMessageWeight({
      text,
      imageUrl,
      imageDeliveryMode,
      fileUrl: normalizedFileUrl,
      filePath: normalizedFilePath,
    });
    const proactiveCheck = await canActivelyPush(botId, targetId, classification.priority, messageWeight);
    if (!proactiveCheck.allowed) {
      const queueId = await enqueuePendingNotification({
        botId,
        targetId,
        source: notificationContext.source || source,
        category: classification.category,
        priority: classification.priority,
        title: notificationContext.title || text,
        content: notificationContext.content || text,
        renderedText: text,
        imageUrl,
        fileUrl: normalizedFileUrl,
        fileName: normalizedFileName,
        rawPayload: notificationContext.rawPayload,
        extra: {
          reason: proactiveCheck.reason,
        },
      });
      results.push({
        botId,
        targetId,
        ok: true,
        deferred: true,
        queueId,
        reason: proactiveCheck.reason,
        priority: classification.priority,
        category: classification.category,
      });
      await appendLog(
        "system",
        `通知已入队: ${botId}:${targetId} (${classification.category}/${classification.priority})`,
        {
          botId,
          targetId,
          rawPayload: notificationContext.rawPayload,
        },
      );
      continue;
    }

    const account = await getActiveAccount(botId);
    if (!account) {
      results.push({
        botId,
        targetId,
        ok: false,
        error: `机器人 ${botId} 尚未登录，请先扫码登录`,
      });
      continue;
    }

    try {
      const fileBundle =
        normalizedFileUrl || normalizedFilePath ? await getSharedFileBundle() : null;
      const filePlan = fileBundle?.plan || null;
      const effectiveFileUrl = normalizedFileUrl || fileBundle?.resource?.sourceUrl || "";
      const effectiveFileName = filePlan?.fileName || normalizedFileName;
      if (filePlan?.mode === "reject") {
        throw new Error(filePlan.fallbackReason);
      }
      const textWithWarning =
        imageDeliveryMode === "image_only" && !filePlan
          ? ""
          : appendProactiveQuotaWarning(
              filePlan?.mode === "link"
                ? formatFileUrlFallbackText(
                    text,
                    effectiveFileUrl,
                    effectiveFileName,
                    filePlan.fallbackReason,
                  )
                : imageDeliveryMode === "text_with_url"
                ? formatImageUrlFallbackText(text, imageUrl, {
                    label: getImageUrlLabel({
                      source: notificationContext.source || source,
                      title: notificationContext.title || text,
                      content: notificationContext.content || text,
                    }),
                  })
                : text,
              await getNextProactiveCount(botId, targetId, messageWeight || 1),
            );
      const outboundConversationText =
        textWithWarning ||
        (filePlan ? `[文件] ${effectiveFileName}` : imageUrl ? `[图片] ${imageUrl}` : "[空消息]");
      if (filePlan?.mode === "file") {
        const uploadedFile = await uploadFileAttachmentToWeixin({
          account,
          to: targetId,
          buffer: filePlan.fileBuffer,
          fileName: effectiveFileName,
        });
        await sendWeixinTextAndFile({
          account,
          to: targetId,
          text: textWithWarning,
          file: uploadedFile,
        });
        results.push({
          botId,
          targetId,
          ok: true,
          degraded: false,
          compressed: filePlan.compressed,
        });
        await noteProactiveWindowDelivery(botId, targetId, textWithWarning ? 2 : 1);
        await appendLog(
          "outbound",
          `${source} -> ${botId}:${targetId}: ${outboundConversationText}`,
          { botId, targetId },
        );
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: outboundConversationText,
          source,
        });
      } else if (filePlan?.mode === "link") {
        await sendWeixinText({
          account,
          to: targetId,
          text: textWithWarning,
        });
        results.push({ botId, targetId, ok: true, degraded: true });
        await noteProactiveWindowDelivery(botId, targetId);
        await appendLog(
          "outbound",
          `${source} -> ${botId}:${targetId}: 文件按策略改为链接发送`,
          { botId, targetId },
        );
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: textWithWarning,
          source: `${source}-degraded`,
        });
      } else if (imageUrl && imageDeliveryMode === "text_with_url") {
        await sendWeixinText({
          account,
          to: targetId,
          text: textWithWarning,
        });
        results.push({ botId, targetId, ok: true, degraded: true });
        await noteProactiveWindowDelivery(botId, targetId);
        await appendLog(
          "outbound",
          `${source} -> ${botId}:${targetId}: 图文按策略改为文本+链接发送`,
          { botId, targetId },
        );
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: textWithWarning,
          source: `${source}-degraded`,
        });
      } else if (imageUrl) {
        await sendWeixinTextAndImage({
          account,
          to: targetId,
          text: textWithWarning,
          imageUrl,
        });
        results.push({ botId, targetId, ok: true, degraded: false });
        await noteProactiveWindowDelivery(botId, targetId, messageWeight);
        await appendLog("outbound", `${source} -> ${botId}:${targetId}: ${outboundConversationText}`, {
          botId,
          targetId,
        });
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: outboundConversationText,
          source: imageDeliveryMode === "image_only" ? `${source}-image-only` : source,
        });
      } else {
        await sendWeixinText({
          account,
          to: targetId,
          text: textWithWarning,
        });
        results.push({ botId, targetId, ok: true, degraded: false });
        await noteProactiveWindowDelivery(botId, targetId, messageWeight);
        await appendLog("outbound", `${source} -> ${botId}:${targetId}: ${outboundConversationText}`, {
          botId,
          targetId,
        });
        await appendConversationMessage({
          botId,
          targetId,
          direction: "outbound",
          text: outboundConversationText,
          source,
        });
      }
    } catch (error) {
      if (normalizedFileUrl) {
        const degradedText = appendProactiveQuotaWarning(
          formatFileUrlFallbackText(
            text,
            normalizedFileUrl,
            normalizedFileName,
            "文件发送失败，已改为链接发送",
          ),
          await getNextProactiveCount(botId, targetId, messageWeight || 1),
        );
        try {
          await sendWeixinText({
            account,
            to: targetId,
            text: degradedText,
          });
          results.push({ botId, targetId, ok: true, degraded: true });
          await noteProactiveWindowDelivery(botId, targetId);
          await appendLog(
            "outbound",
            `${source} -> ${botId}:${targetId}: 文件发送失败，已降级为文本链接发送`,
            { botId, targetId },
          );
          await appendConversationMessage({
            botId,
            targetId,
            direction: "outbound",
            text: degradedText,
            source: `${source}-degraded`,
          });
          continue;
        } catch {
          // 继续走统一失败处理
        }
      }

      if (imageUrl && imageDeliveryMode === "upload") {
        const degradedText = appendProactiveQuotaWarning(
          formatImageUrlFallbackText(text, imageUrl, {
            label: getImageUrlLabel({
              source: notificationContext.source || source,
              title: notificationContext.title || text,
              content: notificationContext.content || text,
            }),
          }),
          await getNextProactiveCount(botId, targetId),
        );
        try {
          await sendWeixinText({
            account,
            to: targetId,
            text: degradedText,
          });
          results.push({ botId, targetId, ok: true, degraded: true });
          await noteProactiveWindowDelivery(botId, targetId);
          await appendLog(
            "outbound",
            `${source} -> ${botId}:${targetId}: 图文发送失败，已降级为文本发送`,
            { botId, targetId },
          );
          await appendConversationMessage({
            botId,
            targetId,
            direction: "outbound",
            text: degradedText,
            source: `${source}-degraded`,
          });
          continue;
        } catch {
          // 继续走统一失败处理
        }
      }

      const message = error instanceof Error ? error.message : String(error);
      results.push({ botId, targetId, ok: false, error: message });
      await appendLog("error", `${source} -> ${botId}:${targetId} 发送失败: ${message}`, {
        botId,
        targetId,
      });
    }
  }

  return results;
}

async function buildStateResponse() {
  const defaultBotId = getDefaultBotId();
  const defaultBot = defaultBotId ? getBotById(defaultBotId) : null;
  const defaultBotRuntime = defaultBotId ? ensureBotRuntime(defaultBotId) : null;
  const pendingNotifications = await listPendingNotificationsOverview(20);
  const deliveryWindows = await listDeliveryWindowsOverview(50);
  const logs = await listRecentLogEntries(10);
  const conversations = await listConversationMap(MAX_CONVERSATION_ITEMS);
  return {
    app: {
      port: PORT,
      startedAt: runtime.startedAt,
      lanIp: getLanIp(),
    },
    config: {
      webhookToken: store.config.webhookToken,
      baseUrl: store.config.baseUrl,
      botType: store.config.botType,
      publicBaseUrl: store.config.publicBaseUrl,
      updatedAt: store.config.updatedAt,
    },
    wechat: {
      botId: defaultBotId || null,
      status: defaultBotRuntime?.status || runtime.status,
      accountId: defaultBot?.accountId || defaultBotRuntime?.currentAccountId || runtime.currentAccountId || null,
      qrCodeDataUrl: defaultBotRuntime?.qrCodeDataUrl || runtime.qrCodeDataUrl || null,
      qrCodeText: defaultBotRuntime?.qrCodeText || runtime.qrCodeText || null,
      qrStatus: defaultBotRuntime?.qrStatus || runtime.qrStatus || null,
      message: defaultBotRuntime?.qrMessage || runtime.qrMessage || "",
      lastError: defaultBotRuntime?.lastError || runtime.lastError || "",
    },
    bots: {
      defaultBotId: defaultBotId || null,
      items: store.bots.items.map(buildBotState),
    },
    targets: store.targets.items,
    users: {
      items: store.users.items,
    },
    notificationRules: {
      items: store.notificationRules.items,
    },
    logs,
    chat: {
      conversations,
    },
    queue: {
      pendingNotifications,
      deliveryWindows,
    },
    personalCaptures: {
      listPath: "/api/personal-captures",
      exportPath: "/api/personal-captures/export",
      kinds: Object.entries(PERSONAL_CAPTURE_KIND_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
      statuses: Object.entries(PERSONAL_CAPTURE_STATUS_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    },
    integrations: {
      items: store.integrations.items.map(buildIntegrationState),
      recentDispatches: [...store.dispatches.items].slice(-12).reverse(),
      adapterTypes: KNOWN_ADAPTER_TYPES.map((item) => ({
        value: item,
        label: ADAPTER_LABELS[item] || item,
      })),
    },
  };
}

function requireWebhookAuth(req, res, next) {
  if (!requireExpectedToken(req, res, store.config.webhookToken, "Webhook Token")) {
    return;
  }

  next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: runtime.status,
    accountId: runtime.currentAccountId || null,
  });
});

app.get("/api/state", (_req, res) => {
  Promise.resolve(buildStateResponse()).then((payload) => res.json(payload));
});

app.get("/api/personal-captures", async (req, res) => {
  const botId =
    typeof req.query.botId === "string" && req.query.botId.trim()
      ? normalizeBotId(req.query.botId)
      : getDefaultBotId();
  const targetId =
    typeof req.query.targetId === "string" && req.query.targetId.trim()
      ? req.query.targetId.trim()
      : "";
  const status =
    typeof req.query.status === "string" && req.query.status.trim()
      ? req.query.status.trim()
      : "open";
  const kind =
    typeof req.query.kind === "string" && req.query.kind.trim() ? req.query.kind.trim() : "";
  const limitRaw =
    typeof req.query.limit === "string" && req.query.limit.trim() ? req.query.limit.trim() : "";
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(limitRaw || String(PERSONAL_CAPTURE_LIST_LIMIT), 10) || PERSONAL_CAPTURE_LIST_LIMIT),
  );

  if (!targetId) {
    return res.status(400).json({ error: "targetId 不能为空" });
  }

  const items = await listPersonalCaptures({
    botId,
    targetId,
    status,
    kind,
    limit,
  });
  const summary = await summarizePersonalCaptureCounts(botId, targetId);

  return res.json({
    botId,
    targetId,
    status: normalizePersonalCaptureListStatus(status),
    kind: kind ? normalizePersonalCaptureKind(kind) : "",
    summary,
    items,
    exportUrls: buildPersonalCaptureExportUrls(botId, targetId, normalizePersonalCaptureListStatus(status)),
  });
});

app.get("/api/personal-captures/export", async (req, res) => {
  const botId =
    typeof req.query.botId === "string" && req.query.botId.trim()
      ? normalizeBotId(req.query.botId)
      : getDefaultBotId();
  const targetId =
    typeof req.query.targetId === "string" && req.query.targetId.trim()
      ? req.query.targetId.trim()
      : "";
  const status =
    typeof req.query.status === "string" && req.query.status.trim()
      ? req.query.status.trim()
      : "open";
  const format =
    typeof req.query.format === "string" && req.query.format.trim()
      ? req.query.format.trim()
      : "openai-responses";
  const limitRaw =
    typeof req.query.limit === "string" && req.query.limit.trim() ? req.query.limit.trim() : "";
  const limit = Math.min(
    PERSONAL_CAPTURE_EXPORT_LIMIT,
    Math.max(1, Number.parseInt(limitRaw || String(PERSONAL_CAPTURE_EXPORT_LIMIT), 10) || PERSONAL_CAPTURE_EXPORT_LIMIT),
  );

  if (!targetId) {
    return res.status(400).json({ error: "targetId 不能为空" });
  }

  const items = await listPersonalCaptures({
    botId,
    targetId,
    status,
    limit,
  });
  const summary = await summarizePersonalCaptureCounts(botId, targetId);
  const payload = buildPersonalCaptureOpenAiExports({
    botId,
    targetId,
    entries: items,
    summary,
  });

  if (format === "markdown") {
    return res.type("text/markdown").send(buildPersonalCaptureExportText(items, summary));
  }

  if (format === "openai-chat") {
    return res.json({
      ...payload,
      exportFormat: "openai-chat",
      request: payload.openai.chatCompletions,
    });
  }

  if (format === "json" || format === "raw") {
    return res.json({
      ...payload,
      exportFormat: "json",
    });
  }

  return res.json({
    ...payload,
    exportFormat: "openai-responses",
    request: payload.openai.responses,
  });
});

app.get("/api/test/connectivity", async (_req, res) => {
  const summary = await runConnectivityChecks();
  await appendLog(
    "system",
    `连通性检测: ${summary.passCount}/${summary.total} 项通过`,
  );
  return res.json(summary);
});

app.post("/api/config", async (req, res) => {
  const token =
    typeof req.body?.webhookToken === "string"
      ? req.body.webhookToken.trim()
      : store.config.webhookToken;
  const publicBaseUrl =
    typeof req.body?.publicBaseUrl === "string"
      ? req.body.publicBaseUrl.trim()
      : store.config.publicBaseUrl;

  if (!token || token.length < 8) {
    return res.status(400).json({ error: "Webhook Token 至少需要 8 个字符" });
  }

  if (publicBaseUrl) {
    try {
      new URL(publicBaseUrl);
    } catch {
      return res.status(400).json({ error: "Public Base URL 格式无效" });
    }
  }

  store.config.webhookToken = token;
  store.config.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  store.config.updatedAt = new Date().toISOString();
  await writeJson(CONFIG_FILE, store.config);
  await appendLog("system", "全局配置已更新");
  return res.json(await buildStateResponse());
});

app.post("/api/config/token", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (token.length < 8) {
    return res.status(400).json({ error: "Token 至少需要 8 个字符" });
  }

  store.config.webhookToken = token;
  store.config.updatedAt = new Date().toISOString();
  await writeJson(CONFIG_FILE, store.config);
  await appendLog("system", "Webhook Token 已更新");
  return res.json(await buildStateResponse());
});

app.post("/api/bots", async (req, res) => {
  try {
    await saveBot(req.body ?? {});
    return res.json(await buildStateResponse());
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete("/api/bots/:botId", async (req, res) => {
  const existing = getBotById(req.params.botId);
  if (!existing) {
    return res.status(404).json({ error: "机器人不存在" });
  }
  await stopBotMonitor(existing.botId);
  await deleteBot(existing.botId);
  return res.json(await buildStateResponse());
});

app.post("/api/wechat/login", async (_req, res) => {
  try {
    const defaultBotId = getDefaultBotId() || "cz";
    if (!getBotById(defaultBotId)) {
      await saveBot({
        botId: defaultBotId,
        name: defaultBotId,
        isDefaultSender: true,
      });
    }
    await startLoginSession(defaultBotId, true);
    return res.json(await buildStateResponse());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendLog("error", `生成微信二维码失败: ${message}`);
    return res.status(500).json({ error: message });
  }
});

app.post("/api/bots/:botId/login", async (req, res) => {
  try {
    await saveBot({
      botId: req.params.botId,
      name: req.body?.name || req.params.botId,
      isDefaultSender: req.body?.isDefaultSender === true,
    });
    await startLoginSession(req.params.botId, true);
    return res.json(await buildStateResponse());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendLog("error", `生成机器人二维码失败: ${message}`, {
      botId: normalizeBotId(req.params.botId),
    });
    return res.status(500).json({ error: message });
  }
});

app.post("/api/chat/send", async (req, res) => {
  const botId = typeof req.body?.botId === "string" ? normalizeBotId(req.body.botId) : "";
  const effectiveBotId = botId || getDefaultBotId();
  const targetId = typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const fileUrl = typeof req.body?.fileUrl === "string" ? req.body.fileUrl.trim() : "";
  const filePath = typeof req.body?.filePath === "string" ? req.body.filePath.trim() : "";
  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";

  if (!targetId) {
    return res.status(400).json({ error: "targetId 不能为空" });
  }

  if (!text && !fileUrl && !filePath) {
    return res.status(400).json({ error: "text、fileUrl、filePath 至少需要一个" });
  }

  const account = await getActiveAccount(effectiveBotId);
  if (!account) {
    return res.status(409).json({ error: "微信尚未登录，请先扫码绑定 ClawBot" });
  }

  try {
    await upsertTarget(effectiveBotId, targetId);
    const plannedMessageWeight = fileUrl || filePath ? (text ? 2 : 1) : 1;
    // Keep direct-send quota enforcement aligned with the shared user window:
    // canActivelyPush(effectiveBotId, targetId, "important")
    const proactiveCheck = await canActivelyPush(
      effectiveBotId,
      targetId,
      "important",
      plannedMessageWeight,
    );
    if (!proactiveCheck.allowed) {
      return res.status(409).json({
        error: formatDirectSendWindowRestrictionMessage(proactiveCheck.reason),
        reason: proactiveCheck.reason,
      });
    }
    if (fileUrl || filePath) {
      const fileResource = await resolveOutboundFileResource({ fileUrl, filePath, fileName });
      if (!fileResource) {
        throw new Error("未提供可发送的文件");
      }
      const filePlan = await buildOutboundFilePlan({ fileResource });
      if (filePlan.mode === "reject") {
        throw new Error(filePlan.fallbackReason);
      }
      if (filePlan.mode === "link") {
        const degradedText = appendProactiveQuotaWarning(
          formatFileUrlFallbackText(text, filePlan.sourceUrl || fileUrl, filePlan.fileName, filePlan.fallbackReason),
          await getNextProactiveCount(effectiveBotId, targetId),
        );
        await sendWeixinText({
          account,
          to: targetId,
          text: degradedText,
        });
        await noteProactiveWindowDelivery(effectiveBotId, targetId);
        await appendLog("outbound", `控制台测试 -> ${effectiveBotId}:${targetId}: 文件按策略改为链接发送`, {
          botId: effectiveBotId,
          targetId,
        });
        await appendConversationMessage({
          botId: effectiveBotId,
          targetId,
          direction: "outbound",
          text: degradedText,
          source: `web-console:${effectiveBotId}-file-link`,
        });
      } else {
        const messageWeight = text ? 2 : 1;
        const textWithWarning = text
          ? appendProactiveQuotaWarning(
              text,
              await getNextProactiveCount(effectiveBotId, targetId, messageWeight),
            )
          : "";
        const uploadedFile = await uploadFileAttachmentToWeixin({
          account,
          to: targetId,
          buffer: filePlan.fileBuffer,
          fileName: filePlan.fileName,
        });
        await sendWeixinTextAndFile({
          account,
          to: targetId,
          text: textWithWarning,
          file: uploadedFile,
        });
        await noteProactiveWindowDelivery(effectiveBotId, targetId, messageWeight);
        await appendLog("outbound", `控制台测试 -> ${effectiveBotId}:${targetId}: [文件] ${filePlan.fileName}`, {
          botId: effectiveBotId,
          targetId,
        });
        await appendConversationMessage({
          botId: effectiveBotId,
          targetId,
          direction: "outbound",
          text: `[文件] ${filePlan.fileName}`,
          source: `web-console:${effectiveBotId}${filePlan.compressed ? "-file-zip" : "-file"}`,
        });
      }
    } else {
      const textWithWarning = appendProactiveQuotaWarning(
        text,
        await getNextProactiveCount(effectiveBotId, targetId),
      );
      await sendWeixinText({
        account,
        to: targetId,
        text: textWithWarning,
      });
      await noteProactiveWindowDelivery(effectiveBotId, targetId);
      await appendLog("outbound", `控制台测试 -> ${effectiveBotId}:${targetId}: ${textWithWarning}`, {
        botId: effectiveBotId,
        targetId,
      });
      await appendConversationMessage({
        botId: effectiveBotId,
        targetId,
        direction: "outbound",
        text: textWithWarning,
        source: `web-console:${effectiveBotId}`,
      });
    }
    return res.json(await buildStateResponse());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendLog("error", `控制台测试发送失败 -> ${targetId}: ${message}`, {
      targetId,
    });
    return res.status(500).json({ error: message });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    await saveUser(req.body ?? {});
    return res.json(await buildStateResponse());
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete("/api/users/:userId", async (req, res) => {
  const existing = getUserById(req.params.userId);
  if (!existing) {
    return res.status(404).json({ error: "家庭用户不存在" });
  }

  await deleteUser(existing.userId);
  return res.json(await buildStateResponse());
});

app.post("/api/notification-rules", async (req, res) => {
  try {
    await saveNotificationRule(req.body ?? {});
    return res.json(await buildStateResponse());
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete("/api/notification-rules/:ruleId", async (req, res) => {
  const existing = getNotificationRuleById(req.params.ruleId);
  if (!existing) {
    return res.status(404).json({ error: "通知规则不存在" });
  }

  await deleteNotificationRule(existing.id);
  return res.json(await buildStateResponse());
});

app.post("/api/integrations", async (req, res) => {
  try {
    await saveIntegration(req.body ?? {});
    return res.json(await buildStateResponse());
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.delete("/api/integrations/:id", async (req, res) => {
  const integration = getIntegrationById(req.params.id);
  if (!integration) {
    return res.status(404).json({ error: "集成不存在" });
  }

  await deleteIntegration(integration.id);
  return res.json(await buildStateResponse());
});

app.post("/api/integrations/:id/test", async (req, res) => {
  const integration = getIntegrationById(req.params.id);
  if (!integration) {
    return res.status(404).json({ error: "集成不存在" });
  }

  if (!integration.outgoingUrl) {
    return res.status(400).json({ error: "该集成尚未配置外发 Webhook URL" });
  }

  try {
    const explicitBotId = typeof req.body?.botId === "string" ? normalizeBotId(req.body.botId) : "";
    const explicitTargetId =
      typeof req.body?.targetId === "string" && req.body.targetId.trim()
        ? req.body.targetId.trim()
        : "";
    const fallbackTarget = store.targets.items[0] || null;
    const botId = explicitBotId || fallbackTarget?.botId || getDefaultBotId();
    const targetId = explicitTargetId || fallbackTarget?.targetId || "manual-test";
    const commandAlias = getEffectiveCommandAliases(integration)[0] || integration.alias;
    const requestedCommand =
      typeof req.body?.command === "string" && req.body.command.trim()
        ? req.body.command.trim()
        : "";
    const normalizedRequestedCommand = (() => {
      if (!requestedCommand || integration.adapterType !== "moviepilot-rest") {
        return requestedCommand;
      }

      const trimmed = requestedCommand.trim();
      const aliasSet = new Set(
        getEffectiveCommandAliases(integration)
          .map((item) => normalizeCommandAlias(item))
          .filter(Boolean),
      );
      const normalizedTrimmed = normalizeCommandAlias(trimmed);
      if (aliasSet.has(normalizedTrimmed)) {
        return "";
      }

      const pieces = trimmed.split(/\s+/);
      const firstToken = normalizeCommandAlias(pieces[0] || "");
      if (aliasSet.has(firstToken)) {
        return pieces.slice(1).join(" ").trim();
      }

      return trimmed;
    })();
    const result =
      integration.adapterType === "moviepilot-rest"
        ? await callMoviePilotRestIntegration({
            integration,
            botId,
            targetId,
            rawText: `/${commandAlias} ${normalizedRequestedCommand || ""}`.trim(),
            commandText: normalizedRequestedCommand || "",
            source: "web-console-test",
          })
        : supportsInteractiveIntegrationSession(integration.adapterType)
          ? await callVideoDownloaderIntegration({
              integration,
              botId,
              targetId,
              rawText: `/${commandAlias} ${normalizedRequestedCommand || "帮助"}`.trim(),
              commandText: normalizedRequestedCommand || "",
              source: "web-console-test",
            })
        : await callOutgoingIntegration({
            integration,
            botId,
            targetId,
            rawText: `/${commandAlias} ping`,
            commandText: "ping",
            source: "web-console-test",
          });
    return res.json({
      ok: true,
      botId,
      targetId,
      ...result,
      state: await buildStateResponse(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/integrations/:alias/push", async (req, res) => {
  const integration = getIntegrationByAlias(req.params.alias);
  if (!integration || !integration.enabled) {
    return res.status(404).json({ error: "集成不存在或未启用" });
  }

  if (!requireExpectedToken(req, res, integration.incomingToken, "集成 Token")) {
    return;
  }

  const parsed = normalizeIncomingByAdapter(integration.adapterType, req.body ?? {});
  if (integration.adapterType === "moviepilot" && parsed.title === "系统通知") {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: "拦截到系统通知，已忽略推送",
    });
  }
  if (parsed.imageUrl && (parsed.fileUrl || parsed.filePath)) {
    return res.status(400).json({ error: "一次只支持图片或文件其中一种附件" });
  }

  const recipientSelection = resolveRecipients(req.body ?? {}, integration.defaultTargetIds, {
    defaultCapabilities:
      integration.adapterType === "moviepilot" ? ["moviepilot"] : [],
    defaultSource: integration.adapterType === "moviepilot" ? "moviepilot" : "",
    integrationAlias: integration.alias,
    integrationName: integration.name,
    adapterType: integration.adapterType,
    parsed,
  });
  if (recipientSelection.missingUserIds.length) {
    return res.status(400).json({
      error: formatMissingUserIdsError(recipientSelection.missingUserIds),
    });
  }
  if (recipientSelection.missingCapabilities.length) {
    return res.status(400).json({
      error: formatMissingCapabilitiesError(recipientSelection.missingCapabilities),
    });
  }

  const recipients = recipientSelection.recipients;
  if (!recipients.length) {
    return res.status(409).json({
      error: "当前没有已激活的微信目标地址，请先在微信里给 ClawBot 发送任意消息激活一次",
    });
  }

  try {
    const results = await sendPushToRecipients({
      recipients,
      text: formatGeneralPushText(parsed),
      imageUrl: parsed.imageUrl || parsed.posterUrl || "",
      fileUrl: parsed.fileUrl || "",
      filePath: parsed.filePath || "",
      fileName: parsed.fileName || "",
      source: `${integration.name} 入站`,
      notificationContext: {
        source: integration.adapterType === "moviepilot" ? "moviepilot" : integration.alias,
        title: parsed.title,
        content: parsed.content,
        rawPayload: req.body ?? {},
      },
    });
    const hasFailure = results.some((item) => !item.ok);
    const allDeferred = results.length > 0 && results.every((item) => item.deferred);
    return res.status(hasFailure ? 207 : allDeferred ? 202 : 200).json({
      ok: !hasFailure,
      integration: buildIntegrationState(integration),
      parsed,
      recipients,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      integration: buildIntegrationState(integration),
      parsed,
    });
  }
});

app.post("/api/integrations/:alias/reply", async (req, res) => {
  const integration = getIntegrationByAlias(req.params.alias);
  if (!integration || !integration.enabled) {
    return res.status(404).json({ error: "集成不存在或未启用" });
  }

  if (!requireExpectedToken(req, res, integration.replyToken, "Reply Token")) {
    return;
  }

  const correlationId =
    typeof req.body?.correlationId === "string" ? req.body.correlationId.trim() : "";
  let targetId = typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
  let botId = typeof req.body?.botId === "string" ? normalizeBotId(req.body.botId) : "";
  const parsed = normalizeGenericIncomingPayload(req.body ?? {});

  if (correlationId) {
    const dispatch = getDispatchByCorrelationId(correlationId);
    if (!dispatch) {
      return res.status(404).json({ error: "未找到对应的任务号" });
    }
    if (dispatch.integrationId !== integration.id) {
      return res.status(409).json({ error: "任务号不属于当前集成" });
    }
    targetId = targetId || dispatch.targetId;
    botId = botId || normalizeBotId(dispatch.botId || "");
  }

  if (!targetId) {
    const recipientSelection = resolveRecipients(req.body ?? {}, [], {
      integrationAlias: integration.alias,
      integrationName: integration.name,
      adapterType: integration.adapterType,
      parsed,
    });
    if (recipientSelection.missingUserIds.length) {
      return res.status(400).json({
        error: formatMissingUserIdsError(recipientSelection.missingUserIds),
      });
    }
    if (recipientSelection.missingCapabilities.length) {
      return res.status(400).json({
        error: formatMissingCapabilitiesError(recipientSelection.missingCapabilities),
      });
    }
    if (recipientSelection.recipients.length > 1) {
      return res.status(400).json({ error: "reply 只能解析到单个 userId 或 targetId" });
    }
    targetId = recipientSelection.recipients[0]?.targetId || "";
    botId = botId || recipientSelection.recipients[0]?.botId || "";
  }

  if (!targetId) {
    return res.status(400).json({ error: "reply 需要提供 correlationId 或 targetId" });
  }
  if (!parsed.title && !parsed.content && !parsed.imageUrl && !parsed.fileUrl && !parsed.filePath) {
    return res.status(400).json({ error: "reply 未解析出可发送内容" });
  }
  if (parsed.imageUrl && (parsed.fileUrl || parsed.filePath)) {
    return res.status(400).json({ error: "reply 一次只支持图片或文件其中一种附件" });
  }

  try {
    await upsertTarget(botId, targetId);
    const results = await sendPushToRecipients({
      recipients: [
        {
          botId: botId || getDefaultBotId(),
          targetId,
        },
      ],
      text: formatGeneralPushText(parsed),
      imageUrl: parsed.imageUrl,
      fileUrl: parsed.fileUrl || "",
      filePath: parsed.filePath || "",
      fileName: parsed.fileName || "",
      source: `integration-reply:${integration.alias}`,
      notificationContext: {
        source: integration.alias,
        title: parsed.title,
        content: parsed.content,
        rawPayload: req.body ?? {},
      },
    });
    if (correlationId) {
      await updateDispatchRecord(correlationId, {
        status: "replied",
        responseSummary: truncateText(
          formatGeneralPushText(parsed) || (parsed.fileUrl || parsed.filePath ? "[文件回复]" : "[图片回复]"),
          200,
        ),
      });
    }
    const allDeferred = results.length > 0 && results.every((item) => item.deferred);
    return res.json({
      ok: results.every((item) => item.ok),
      queued: allDeferred,
      botId: botId || getDefaultBotId(),
      targetId,
      correlationId: correlationId || null,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/push", requireWebhookAuth, async (req, res) => {
  const parsed = normalizeGenericIncomingPayload(req.body ?? {});
  if (!parsed.title && !parsed.content && !parsed.imageUrl && !parsed.fileUrl && !parsed.filePath) {
    return res.status(400).json({
      error: "请求体至少需要包含可解析的 title、content、imageUrl 或 fileUrl/filePath",
    });
  }
  if (parsed.imageUrl && (parsed.fileUrl || parsed.filePath)) {
    return res.status(400).json({ error: "一次只支持图片或文件其中一种附件" });
  }

  const recipientSelection = resolveRecipients(req.body ?? {}, [], {
    parsed,
  });
  if (recipientSelection.missingUserIds.length) {
    return res.status(400).json({
      error: formatMissingUserIdsError(recipientSelection.missingUserIds),
    });
  }
  if (recipientSelection.missingCapabilities.length) {
    return res.status(400).json({
      error: formatMissingCapabilitiesError(recipientSelection.missingCapabilities),
    });
  }

  const recipients = recipientSelection.recipients;
  if (!recipients.length) {
    return res.status(409).json({
      error: "未匹配到任何接收人，请传入 userId/userIds、targetId/targetIds，或先配置默认接收人",
    });
  }

  try {
    const results = await sendPushToRecipients({
      recipients,
      text: formatGeneralPushText(parsed),
      imageUrl: parsed.imageUrl,
      fileUrl: parsed.fileUrl || "",
      filePath: parsed.filePath || "",
      fileName: parsed.fileName || "",
      source: parsed.sourceLabel || "通用推送",
      notificationContext: {
        source: parsed.sourceKey || req.body?.source || parsed.sourceLabel || "generic",
        title: parsed.title,
        content: parsed.content,
        rawPayload: req.body ?? {},
      },
    });
    const hasFailure = results.some((item) => !item.ok);
    const allDeferred = results.length > 0 && results.every((item) => item.deferred);
    return res.status(hasFailure ? 207 : allDeferred ? 202 : 200).json({
      ok: !hasFailure,
      parsed,
      recipients,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/push/moviepilot", requireWebhookAuth, async (req, res) => {
  const parsed = extractMoviePilotPayload(req.body ?? {});
  if (parsed.title === "系统通知") {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: "拦截到系统通知，已忽略推送",
    });
  }

  const recipientSelection = resolveRecipients(req.body ?? {}, [], {
    defaultCapabilities: ["moviepilot"],
    defaultSource: "moviepilot",
    parsed,
  });
  if (recipientSelection.missingUserIds.length) {
    return res.status(400).json({
      error: formatMissingUserIdsError(recipientSelection.missingUserIds),
    });
  }
  if (recipientSelection.missingCapabilities.length) {
    return res.status(400).json({
      error: formatMissingCapabilitiesError(recipientSelection.missingCapabilities),
    });
  }

  const recipients = recipientSelection.recipients;
  if (!recipients.length) {
    return res.status(409).json({
      error: "未匹配到任何接收人，请传入 userId/userIds、targetId/targetIds，或先配置默认接收人",
    });
  }

  try {
    const results = await sendPushToRecipients({
      recipients,
      text: formatGeneralPushText(parsed),
      imageUrl: parsed.posterUrl || parsed.imageUrl || "",
      source: "MoviePilot 推送",
      notificationContext: {
        source: "moviepilot",
        title: parsed.title,
        content: parsed.content,
        rawPayload: req.body ?? {},
      },
    });
    const hasFailure = results.some((item) => !item.ok);
    const allDeferred = results.length > 0 && results.every((item) => item.deferred);
    return res.status(hasFailure ? 207 : allDeferred ? 202 : 200).json({
      ok: !hasFailure,
      parsed,
      recipients,
      results,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      parsed,
    });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

async function initializeStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(OPENCLAW_ACCOUNT_DIR, { recursive: true });
  await ensureSqliteDb();

  const config = await readJson(CONFIG_FILE, null);
  store.config = {
    webhookToken:
      typeof config?.webhookToken === "string" && config.webhookToken.trim()
        ? config.webhookToken.trim()
        : createWebhookToken(),
    baseUrl:
      typeof config?.baseUrl === "string" && config.baseUrl.trim()
        ? config.baseUrl.trim()
        : DEFAULT_API_BASE_URL,
    botType:
      typeof config?.botType === "string" && config.botType.trim()
        ? config.botType.trim()
        : DEFAULT_BOT_TYPE,
    publicBaseUrl:
      DEFAULT_PUBLIC_BASE_URL ||
      (typeof config?.publicBaseUrl === "string" && config.publicBaseUrl.trim()
        ? config.publicBaseUrl.trim().replace(/\/+$/, "")
        : ""),
    updatedAt: new Date().toISOString(),
  };
  await writeJson(CONFIG_FILE, store.config);

  const savedAccountIds = await getSavedAccountIds();
  const bots = await readJson(BOTS_FILE, { items: [] });
  const initialBots =
    Array.isArray(bots?.items) && bots.items.length
      ? bots.items
      : savedAccountIds.length
        ? [
            {
              botId: "cz",
              name: "cz",
              accountId: savedAccountIds[0],
              enabled: true,
              isDefaultSender: true,
            },
          ]
        : [];
  store.bots = {
    items: initialBots
      .filter((item) => item && typeof item === "object")
      .map((item) => normalizeBotPayload(item))
      .filter((item) => item.botId),
  };
  await saveBotsStore();

  const defaultBotId = getDefaultBotId() || "cz";

  const targets = await readJson(TARGETS_FILE, { items: [] });
  store.targets = {
    items: Array.isArray(targets?.items)
      ? targets.items.filter(
          (item) => item && typeof item.targetId === "string" && item.targetId.trim(),
        ).map((item) => ({
          botId: normalizeBotId(item.botId) || defaultBotId,
          targetId: String(item.targetId || "").trim(),
          firstSeenAt: item.firstSeenAt || new Date().toISOString(),
          lastSeenAt: item.lastSeenAt || item.firstSeenAt || new Date().toISOString(),
        }))
      : [],
  };
  await writeJson(TARGETS_FILE, store.targets);

  const users = await readJson(USERS_FILE, { items: [] });
  store.users = {
    items: Array.isArray(users?.items)
      ? users.items
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.userId === "string" &&
              normalizeUserId(item.userId),
          )
          .map((item) => ({
            userId: normalizeUserId(item.userId),
            name:
              typeof item.name === "string" && item.name.trim()
                ? item.name.trim()
                : normalizeUserId(item.userId),
            enabled: item.enabled !== false,
            bindings: parseTargetBindings(
              {
                bindings: Array.isArray(item.bindings) ? item.bindings : [],
                targetId: typeof item.targetId === "string" ? item.targetId.trim() : "",
                botId: item.botId || defaultBotId,
              },
              null,
            ),
            capabilities: parseCapabilityList(item.capabilities),
            isDefaultRecipient: item.isDefaultRecipient === true || normalizeUserId(item.userId) === "cz",
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
          }))
      : [],
  };
  await saveUsersStore();

  const notificationRules = await readJson(NOTIFICATION_RULES_FILE, null);
  const initialNotificationRules = mergeDefaultNotificationRules(
    Array.isArray(notificationRules?.items) ? notificationRules.items : DEFAULT_NOTIFICATION_RULES,
  );
  store.notificationRules = {
    items: initialNotificationRules
      .filter((item) => item && typeof item === "object")
      .map((item) => normalizeNotificationRulePayload(item)),
  };
  await saveNotificationRulesStore();

  const logs = await readJson(LOGS_FILE, { items: [] });
  await importLegacyLogsToSqlite(Array.isArray(logs?.items) ? logs.items : []);
  store.logs = {
    items: await listRecentLogEntries(MAX_LOG_ITEMS),
  };

  const conversations = await readJson(CONVERSATIONS_FILE, { items: {} });
  await importLegacyConversationsToSqlite(
    conversations?.items && typeof conversations.items === "object"
      ? conversations.items
      : {},
  );
  store.conversations = {
    items: await listConversationMap(MAX_CONVERSATION_ITEMS),
  };

  const commandContexts = await readJson(COMMAND_CONTEXTS_FILE, { items: {} });
  store.commandContexts = {
    items:
      commandContexts?.items && typeof commandContexts.items === "object"
        ? commandContexts.items
        : {},
  };
  if (!(await pathExists(COMMAND_CONTEXTS_FILE))) {
    await writeJson(COMMAND_CONTEXTS_FILE, store.commandContexts);
  }

  const integrations = await readJson(INTEGRATIONS_FILE, { items: [] });
  store.integrations = {
    items: Array.isArray(integrations?.items)
      ? integrations.items
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.alias === "string" &&
              item.alias.trim(),
          )
          .map((item) =>
            normalizeIntegrationPayload(item, {
              id: item.id || crypto.randomUUID(),
              createdAt: item.createdAt || new Date().toISOString(),
            }),
          )
      : [],
  };
  await writeJson(INTEGRATIONS_FILE, store.integrations);

  const dispatches = await readJson(DISPATCHES_FILE, { items: [] });
  store.dispatches = {
    items: Array.isArray(dispatches?.items)
      ? dispatches.items
          .filter(
            (item) =>
              item &&
              typeof item === "object" &&
              typeof item.correlationId === "string" &&
              item.correlationId.trim(),
          )
          .slice(-MAX_DISPATCH_ITEMS)
      : [],
  };
  if (!(await pathExists(DISPATCHES_FILE))) {
    await writeJson(DISPATCHES_FILE, store.dispatches);
  }
}

async function initializeRuntime() {
  if (SKIP_REMOTE_BOOT) {
    runtime.currentAccountId = "";
    runtime.status = "test_mode";
    runtime.qrCodeText = "";
    runtime.qrCodeDataUrl = "";
    runtime.qrStatus = "";
    runtime.qrMessage = "Remote boot skipped by test mode.";
    runtime.lastError = "";
    runtime.loginSessionId = "";
    runtime.bots = {};
    for (const bot of store.bots.items) {
      runtime.bots[bot.botId] = {
        status: "test_mode",
        currentAccountId: bot.accountId || "",
        qrCodeText: "",
        qrCodeDataUrl: "",
        qrStatus: "",
        qrMessage: "Remote boot skipped by test mode.",
        lastError: "",
        loginSessionId: "",
        loginTask: null,
        botTask: null,
        botAbortController: null,
      };
    }
    return;
  }

  if (!store.bots.items.length) {
    const accountId = await getPrimaryAccountId();
    if (accountId) {
      await saveBot({
        botId: "cz",
        name: "cz",
        accountId,
        isDefaultSender: true,
      });
    }
  }

  if (store.bots.items.length) {
    for (const bot of store.bots.items) {
      ensureBotRuntime(bot.botId);
      if (bot.accountId) {
        const botRuntime = ensureBotRuntime(bot.botId);
        botRuntime.currentAccountId = bot.accountId;
        botRuntime.status = "logged_in";
        void startBotMonitor(bot.botId);
      } else {
        const botRuntime = ensureBotRuntime(bot.botId);
        botRuntime.status = "not_logged_in";
        void startLoginSession(bot.botId, false);
      }
    }
    syncLegacyRuntimeFromDefaultBot();
    return;
  }

  runtime.status = "not_logged_in";
  syncLegacyRuntimeFromDefaultBot();
}

await initializeStore();
await initializeRuntime();
startDeliveryWindowReminderLoop();

app.listen(PORT, "0.0.0.0", async () => {
  await appendLog(
    "system",
    `控制台已启动: http://${getLanIp()}:${PORT} (状态: ${runtime.status})`,
  );
});
