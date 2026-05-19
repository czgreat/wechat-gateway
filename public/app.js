let latestState = null;
let selectedTargetId = "";
let toastTimer = null;
let activeSectionId = "robotsSection";
const openUserEditors = new Set();

const STATUS_TEXT = {
  logged_in: "已登录",
  not_logged_in: "未登录",
  offline: "离线",
  test_mode: "测试模式",
};

const SOURCE_TEMPLATE_DEFS = {
  homeassistant: {
    label: "Home Assistant",
    summary: "家居状态、设备离线、告警类消息",
    capability: "ha_notice",
    preset: {
      id: "default-homeassistant",
      name: "Home Assistant 通知",
      source: "homeassistant",
      category: "",
      keywords: ["homeassistant", "home assistant", "ha"],
      botIds: [],
      capabilities: ["ha_notice"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  bilisync: {
    label: "BiliSync",
    summary: "UP 更新、同步完成、同步异常",
    capability: "bili_sync",
    preset: {
      id: "default-bilisync",
      name: "BiliSync 通知",
      source: "bilisync",
      category: "",
      keywords: ["bilisync", "bili-sync", "b站", "up主"],
      botIds: [],
      capabilities: ["bili_sync"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  ops: {
    label: "运维",
    summary: "服务状态、监控、异常告警",
    capability: "ops",
    preset: {
      id: "default-ops",
      name: "运维通知",
      source: "ops",
      category: "",
      keywords: ["ops", "glances", "告警", "运维", "监控"],
      botIds: [],
      capabilities: ["ops"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  jianfei: {
    label: "减肥",
    summary: "体重、热量、步数、饮食记录",
    capability: "diet",
    preset: {
      id: "default-jianfei",
      name: "减肥通知",
      source: "jianfei",
      category: "",
      keywords: ["jianfei", "减肥", "体重", "热量", "步数", "饮食"],
      botIds: [],
      capabilities: ["diet"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  codex: {
    label: "Codex",
    summary: "任务完成、运行结果、工作流消息",
    capability: "codex",
    preset: {
      id: "default-codex",
      name: "Codex 通知",
      source: "codex",
      category: "",
      keywords: ["codex"],
      botIds: [],
      capabilities: ["codex"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  moviepilot: {
    label: "MoviePilot",
    summary: "订阅、入库、下载、影视提醒",
    capability: "moviepilot",
    preset: {
      id: "default-moviepilot",
      name: "MoviePilot 通知",
      source: "moviepilot",
      category: "",
      keywords: ["moviepilot", "订阅", "入库", "下载", "影视", "mp"],
      botIds: [],
      capabilities: ["moviepilot"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  beike: {
    label: "贝壳",
    summary: "房源抓取、登录失效、风控提醒",
    capability: "beike",
    preset: {
      id: "default-beike",
      name: "贝壳通知",
      source: "beike",
      category: "",
      keywords: ["beike", "贝壳"],
      botIds: [],
      capabilities: ["beike"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
  pricereader: {
    label: "好价",
    summary: "好价命中、降价、补货提醒",
    capability: "pricereader",
    preset: {
      id: "default-pricereader",
      name: "好价通知",
      source: "pricereader",
      category: "",
      keywords: ["pricereader", "好价", "低价", "降价"],
      botIds: [],
      capabilities: ["pricereader"],
      userIds: [],
      enabled: true,
      allowDefaultRecipient: true,
    },
  },
};

const BASE_USER_CAPABILITIES = Object.values(SOURCE_TEMPLATE_DEFS).map((item) => ({
  value: item.capability,
  label: item.label,
}));

const RULE_PRESET_EXAMPLES = Object.fromEntries(
  Object.entries(SOURCE_TEMPLATE_DEFS).map(([key, item]) => [key, item.preset]),
);

const SECTION_IDS = [
  "robotsSection",
  "configSection",
  "integrationsSection",
  "peopleSection",
  "rulesSection",
  "chatSection",
];

const FIELD_HELP = {
  tokenInput:
    "旧版通用推送接口使用的全局 Token。示例：请求 /api/push 时携带 Authorization: Bearer <token>。",
  publicBaseUrlInput:
    "生成集成入站地址、回包地址和 replyWebhookUrl 时优先使用的外部地址。示例：http://localhost:23456。",
  integrationNameInput:
    "控制台里显示的集成名称。示例：MoviePilot 主实例、Grafana 告警。",
  integrationAliasInput:
    "别名会进入 URL 路径，也会默认成为微信命令名。示例：moviepilot、grafana、ops。",
  integrationTypeInput:
    "选择后会切换字段示例和默认命令风格。示例：MoviePilot、Grafana、Alertmanager。",
  integrationEnabledInput:
    "关闭后不会删除配置，只是不再响应该集成的入站调用和微信命令。",
  incomingTokenInput:
    "外部软件调用该集成入站地址时使用的专属 Token。示例：/api/integrations/moviepilot/push?token=...",
  replyTokenInput:
    "外部软件异步回包到微信时使用的专属 Token。示例：/api/integrations/moviepilot/reply?token=...",
  outgoingUrlInput:
    "微信里输入命令后，网关会把 payload POST 到这里。示例：https://your-app.example.com/wechat/commands。",
  outgoingBearerTokenInput:
    "若外部命令接口要求鉴权，网关会附带 Authorization: Bearer <token>。",
  commandAliasesInput:
    "微信里可触发该集成的额外命令名，逗号分隔。示例：mp, 影视, 搜索。",
  defaultTargetsInput:
    "入站消息未指定 targetId 时，默认发给这些目标。示例：wxid_1, group_2。",
  integrationNotesInput:
    "写给自己看的备注，不参与接口行为。示例：这是家里 NAS 上的 MoviePilot。",
  chatTargetSelect:
    "选择一个已经和机器人有过消息往来的目标。示例：个人会话或微信群内部 ID。",
  chatInput:
    "输入要发给微信的文本内容，也可以直接测试命令外发。示例：ping、/mp search dune、/ops restart app。",
  chatFileUrlInput:
    "可选，填写一个网关容器可访问的文件 URL。超限时会按规则尝试 ZIP 或改发下载链接。",
  chatFilePathInput:
    "可选，直接填写网关宿主/容器内可读的本地文件路径，仅用于当前控制台测试。",
  chatFileNameInput:
    "可选，覆盖附件展示文件名。未填写时会优先使用 URL 文件名或本地 basename。",
  botIdInput:
    "机器人 ID 是内部稳定标识。示例：cz、czg、wdc。",
  botNameInput:
    "给机器人起一个便于区分的名字。示例：主微信、工作微信。",
  userIdInput:
    "给家庭成员定义一个稳定 ID，供上游系统长期引用。示例：cz、wdc。",
  userTargetSelect:
    "这里按 botId 分组显示已激活目标，可多选保存，不再手填 targetId。",
  userCapabilitiesInput:
    "这里直接勾选这个用户要接收哪些来源。示例：Home Assistant、贝壳、好价、Codex。",
  notificationRuleSourceInput:
    "优先匹配上游 webhook 里的 source 字段。示例：jianfei、codex、moviepilot。",
  notificationRuleCategoryInput:
    "可选的二级分类，匹配 webhook 的 category 或 event。示例：daily_report、error。",
  notificationRuleKeywordsInput:
    "当上游没有稳定 source 时，可用关键词匹配标题或正文。",
  notificationRuleCapabilitiesInput:
    "命中规则后要投递给哪些能力组，逗号分隔。示例：diet、codex。",
  notificationRuleUserIdsInput:
    "若你想把某类通知直接发给固定家庭成员，可在这里填写 userId。",
  notificationRuleBotIdsInput:
    "限制这条规则只在选中的机器人作用域内生效，可多选。",
};

const SECTION_HELP = [
  {
    selector: "#botForm",
    help: "先新增机器人 ID，再用对应微信扫码登录。一个机器人只绑定一个微信账号。",
    placement: "before",
  },
  {
    selector: "#configForm",
    help: "这里管理旧版接口 Token 和外部 URL 基础地址。旧版 /api/push 与 /api/push/moviepilot 继续读取这里的 Token。",
    placement: "title-prev",
  },
  {
    selector: "#integrationForm",
    help: "这里定义不同软件的入站 webhook、微信命令外发和异步回包。先选适配器类型，再按示例填写。",
    placement: "title-prev",
  },
  {
    selector: "#chatForm",
    help: "这里可以直接向微信发测试文本、命令或文件附件。文件超出 24.5 MiB 时会按后端规则尝试 ZIP 或改发下载链接。",
    placement: "title-prev",
  },
  {
    selector: "#connectivityTestBtn",
    help: "检测常见外部站点是否可达，方便排查代理、海报抓取和第三方 API 网络问题。",
    placement: "before",
  },
  {
    selector: "#targetList",
    help: "展示已经被记录下来的目标 ID。对方先给机器人发过消息后，这里才会出现。",
    placement: "title-prev",
  },
  {
    selector: "#userForm",
    help: "这里把家庭用户和已有 bot / target 绑定起来，不再手填 targetId。",
    placement: "title-prev",
  },
  {
    selector: "#notificationRuleForm",
    help: "这里定义 jianfei、codex、moviepilot 等通知默认怎么分人。建议优先按 source 匹配，再补关键词兜底。",
    placement: "title-prev",
  },
  {
    selector: "#dispatchList",
    help: "展示微信命令转发给外部系统后的最近任务记录，例如任务号、状态、错误摘要。",
    placement: "title-prev",
  },
  {
    selector: "#logList",
    help: "记录最近的系统事件、消息收发和错误，例如二维码刷新、集成保存、发送失败。",
    placement: "title-prev",
  },
];

const BOX_HELP = [
  {
    targetId: "accountId",
    help: "当前已绑定的微信 ClawBot 账号 ID。扫码登录成功后会显示在这里。",
  },
  {
    targetId: "lanIp",
    help: "控制台推断出的宿主机局域网 IP，可用于局域网内访问控制台。",
  },
  {
    targetId: "targetCount",
    help: "已记录的微信目标数量。对方先发过消息后，这里会增加。",
  },
];

const STATIC_NOTES = {
  tokenInput: "建议只保留给旧版接口兼容使用，新集成更推荐独立 Token。",
  publicBaseUrlInput: "Docker 或反向代理场景建议显式填写，避免生成错误端口。",
  integrationTypeInput: "切换类型后，下方示例、占位和字段说明会自动变化。",
  integrationEnabledInput: "关闭后不会删除配置，只会暂停该集成的所有收发。",
  chatTargetSelect: "目标需要先给机器人发过消息，才会出现在这里。",
  chatInput: "这里既可以测试普通文本，也可以测试 /mp、/mon、/ops 这类命令。",
  chatFileUrlInput: "远程附件推荐优先走 URL；网关会自己下载并决定是否压缩成 ZIP。",
  chatFilePathInput: "仅限当前机器本地测试；不会暴露给外部项目。",
  chatFileNameInput: "可为空；为空时会自动推断。"
};

function showToast(message, kind = "success") {
  const host = byId("toastArea");
  if (!host || !message) return;
  host.innerHTML = `<div class="toast-note ${kind === "error" ? "error" : kind === "info" ? "info" : ""}">${escapeHtml(message)}</div>`;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    host.innerHTML = "";
  }, 2600);
}

const PRESETS = {
  generic: {
    title: "通用集成",
    description: "适合自定义脚本、简单通知器或你自己的业务接口。",
    inboundExample: "入站示例：POST /api/integrations/ops/push?token=...",
    commandExample: "微信命令示例：/ops restart moviepilot",
    placeholders: {
      integrationNameInput: "例如：通用运维脚本",
      integrationAliasInput: "例如：ops",
      incomingTokenInput: "可留空自动生成",
      replyTokenInput: "可留空自动生成",
      outgoingUrlInput: "例如：https://example.com/wechat/commands",
      outgoingBearerTokenInput: "可选，例如 abc123",
      commandAliasesInput: "例如：ops, 运维, 重启",
      defaultTargetsInput: "例如：wxid_xxx, group_xxx",
      integrationNotesInput: "可选：记录用途、部署位置等",
    },
    notes: {
      integrationNameInput: "建议写成你自己容易分辨的业务名或脚本名。",
      integrationAliasInput: "推荐使用短且稳定的英文别名，会直接出现在 URL 里。",
      incomingTokenInput: "用于别的软件推送到微信，通常复制给对方系统。",
      replyTokenInput: "用于对方系统异步把执行结果再发回微信。",
      outgoingUrlInput: "微信里的命令会被 POST 到这里。",
      outgoingBearerTokenInput: "若外部服务无鉴权，可留空。",
      commandAliasesInput: "多个别名用逗号分隔，微信里任意一个都能触发。",
      defaultTargetsInput: "不填时，通用入站默认群发到当前已保存目标。",
      integrationNotesInput: "只做备注，不参与程序逻辑。",
    },
  },
  moviepilot: {
    title: "MoviePilot",
    description: "适合 MoviePilot 通知入站，作为普通 webhook 通知适配器使用，不负责 /mp 命令。",
    inboundExample: "入站示例：MoviePilot Webhook 指向 /api/integrations/moviepilot/push?token=...",
    commandExample: "用途示例：MoviePilot -> WeChat 图文通知，不建议绑定 /mp 命令",
    placeholders: {
      integrationNameInput: "例如：MoviePilot 通知",
      integrationAliasInput: "例如：moviepilot",
      incomingTokenInput: "复制给 MoviePilot Webhook",
      replyTokenInput: "可选：给外部回包器用",
      outgoingUrlInput: "通知型集成通常不需要外发地址",
      outgoingBearerTokenInput: "通知型集成通常留空",
      commandAliasesInput: "建议留空，避免和 /mp 命令冲突",
      defaultTargetsInput: "例如：group_moviepilot",
      integrationNotesInput: "例如：仅用于 MoviePilot 消息通知",
    },
    notes: {
      integrationNameInput: "建议区分通知型、测试型或不同环境。",
      integrationAliasInput: "建议保留 moviepilot 作为通知型 webhook 适配器的路径别名。",
      incomingTokenInput: "MoviePilot 通知回调建议使用独立 Token，不要和旧版全局 Token 混用。",
      replyTokenInput: "仅当你有额外的异步回包链路时才需要。",
      outgoingUrlInput: "普通 MoviePilot 通知型集成不需要微信命令外发地址。",
      outgoingBearerTokenInput: "普通 MoviePilot 通知型集成通常留空。",
      commandAliasesInput: "这里建议留空，/mp 命令交给 MoviePilot REST 集成。",
      defaultTargetsInput: "可指定一个影视群或你的个人会话作为默认接收方。",
      integrationNotesInput: "备注这是通知型，不是命令型。",
    },
  },
  "moviepilot-rest": {
    title: "MoviePilot REST",
    description: "适合把微信里的 /mp 命令直接映射到 MoviePilot 官方 REST API，不再走 webhook 事件入口。",
    inboundExample: "命令模式示例：/mp media dune 或 /mp sub list",
    commandExample: "默认 API 根地址：http://localhost:23671",
    placeholders: {
      integrationNameInput: "默认：MoviePilot Main",
      integrationAliasInput: "默认：moviepilot-rest",
      incomingTokenInput: "默认：wechat-mp-inbound-23671",
      replyTokenInput: "默认：wechat-mp-reply-23671",
      outgoingUrlInput: "默认：http://localhost:23671",
      outgoingBearerTokenInput: "默认：5965856sd89sd85df",
      commandAliasesInput: "默认：mp",
      defaultTargetsInput: "例如：group_moviepilot",
      integrationNotesInput: "默认：MoviePilot REST direct command mode",
    },
    defaults: {
      integrationNameInput: "MoviePilot Main",
      integrationAliasInput: "moviepilot-rest",
      incomingTokenInput: "wechat-mp-inbound-23671",
      replyTokenInput: "wechat-mp-reply-23671",
      outgoingUrlInput: "http://localhost:23671",
      outgoingBearerTokenInput: "5965856sd89sd85df",
      commandAliasesInput: "mp",
      integrationNotesInput:
        "Default MP REST target: http://localhost:23671, token=5965856sd89sd85df",
    },
    notes: {
      integrationNameInput: "当前默认集成就是这个模式，保存后即可直接测试 /mp 命令。",
      integrationAliasInput: "默认用 moviepilot-rest，和普通通知型 moviepilot 路径分开。",
      incomingTokenInput: "如果以后还要给这个集成保留入站地址，可以继续使用这里的专属 Token。",
      replyTokenInput: "为后续异步回包预留，不影响当前 /mp 命令直连模式。",
      outgoingUrlInput: "这里填 MoviePilot 根地址，不是 /api/v1/webhook/ 完整地址。",
      outgoingBearerTokenInput: "这里直接填 MoviePilot API token，命令执行时会自动拼到 query token 上。",
      commandAliasesInput: "默认只保留 mp，避免和别的集成冲突。",
      defaultTargetsInput: "不填时，/mp 命令只回当前发命令的微信会话。",
      integrationNotesInput: "用于记录这个默认直连模式的用途和环境。",
    },
  },
  "video-downloader": {
    title: "视频下载",
    description: "适合接 AI 字幕、下载和音频提取服务，推荐统一使用 zm 显式命令。",
    inboundExample: "命令模式示例：zm https://... / zm 下载 https://... / zm 音频 https://...",
    commandExample: "字幕命令示例：zm md https://... / zm word https://... / zm md word https://...",
    placeholders: {
      integrationNameInput: "例如：AI 字幕",
      integrationAliasInput: "例如：video",
      incomingTokenInput: "可留空自动生成",
      replyTokenInput: "可留空自动生成",
      outgoingUrlInput: "例如：http://video-worker:8090/api/wechat/dispatch",
      outgoingBearerTokenInput: "可选，例如 video-secret",
      commandAliasesInput: "例如：zm",
      defaultTargetsInput: "例如：wxid_xxx, group_xxx",
      integrationNotesInput: "例如：yt-dlp + AI 字幕处理器",
    },
    defaults: {
      integrationNameInput: "AI 字幕",
      integrationAliasInput: "ai-subtitle",
      commandAliasesInput: "zm",
      integrationNotesInput: "显式 zm 命令驱动的字幕/下载/音频提取",
    },
    notes: {
      integrationNameInput: "建议写成你在微信里能一眼认出的功能名。",
      integrationAliasInput: "推荐固定为 ai-subtitle，方便网关把 zm 命令定向到这个集成。",
      incomingTokenInput: "如果后续还有外部系统往这个集成推消息，可以继续复用。",
      replyTokenInput: "AI 字幕服务异步回传字幕、下载文件或音频结果时使用。",
      outgoingUrlInput: "这里填你的视频处理 Docker 暴露的 webhook 地址。",
      outgoingBearerTokenInput: "视频服务要求 Bearer 鉴权时填写。",
      commandAliasesInput: "建议保留 zm；网关帮助菜单和显式字幕命令都按 zm 展示。",
      defaultTargetsInput: "通常不需要填，命令型集成默认只回当前会话。",
      integrationNotesInput: "备注运行机器、模型、存储路径，以及是否支持音频提取。",
    },
  },
  "uptime-kuma": {
    title: "Uptime Kuma",
    description: "适合站点在线/离线通知，推荐搭配 mon 命令别名。",
    inboundExample: "入站示例：Uptime Kuma Webhook 指向 /api/integrations/uptime-kuma/push?token=...",
    commandExample: "微信命令示例：/mon status homepage",
    placeholders: {
      integrationNameInput: "例如：Uptime Kuma 站点告警",
      integrationAliasInput: "例如：uptime-kuma",
      incomingTokenInput: "复制给 Uptime Kuma Webhook",
      replyTokenInput: "可选：给你的告警处理器回包用",
      outgoingUrlInput: "例如：https://example.com/monitor/commands",
      outgoingBearerTokenInput: "例如：monitor-secret",
      commandAliasesInput: "例如：mon, 监控, uptime",
      defaultTargetsInput: "例如：group_monitor",
      integrationNotesInput: "例如：公网站点告警群",
    },
    notes: {
      integrationNameInput: "建议写明监控范围，如网站、NAS、下载机。",
      integrationAliasInput: "建议保留 uptime-kuma 或简化为 kuma。",
      incomingTokenInput: "Uptime Kuma 调用入站地址时使用。",
      replyTokenInput: "若你的外部处理器会把操作结果回发给微信，就需要它。",
      outgoingUrlInput: "可接你自己的监控命令处理器，例如查询状态、静默等。",
      outgoingBearerTokenInput: "没有鉴权要求可留空。",
      commandAliasesInput: "mon 是最常见的写法，适合在微信里快速输入。",
      defaultTargetsInput: "不填则按当前已保存目标处理。",
      integrationNotesInput: "备注这个集成负责哪些监控来源。",
    },
  },
  grafana: {
    title: "Grafana",
    description: "适合 Grafana Alerting 或 Grafana OnCall 风格通知。",
    inboundExample: "入站示例：Grafana Webhook 指向 /api/integrations/grafana/push?token=...",
    commandExample: "微信命令示例：/mon silence api-error",
    placeholders: {
      integrationNameInput: "例如：Grafana 告警中心",
      integrationAliasInput: "例如：grafana",
      incomingTokenInput: "复制给 Grafana Webhook",
      replyTokenInput: "可选：给告警操作执行器回包用",
      outgoingUrlInput: "例如：https://example.com/grafana/commands",
      outgoingBearerTokenInput: "例如：grafana-bearer-token",
      commandAliasesInput: "例如：mon, grafana, 告警",
      defaultTargetsInput: "例如：group_grafana",
      integrationNotesInput: "例如：生产环境 Grafana",
    },
    notes: {
      integrationNameInput: "建议带上环境名，如生产 Grafana、测试 Grafana。",
      integrationAliasInput: "建议保持 grafana，便于接口路径统一。",
      incomingTokenInput: "Grafana Alerting 的 webhook 通知应使用这里的独立 Token。",
      replyTokenInput: "如果外部命令处理器会异步把静默结果返回给微信，用这里。",
      outgoingUrlInput: "适合接你自己的静默、确认、跳转等命令处理器。",
      outgoingBearerTokenInput: "外部命令处理器需要鉴权时填写。",
      commandAliasesInput: "可配置 mon、grafana、静默等短命令。",
      defaultTargetsInput: "建议指定运维群或值班群。",
      integrationNotesInput: "备注 Grafana 地址、环境或相关团队。",
    },
  },
  alertmanager: {
    title: "Alertmanager",
    description: "适合 Prometheus Alertmanager 告警入站，推荐和运维命令一起使用。",
    inboundExample: "入站示例：Alertmanager Webhook 指向 /api/integrations/alertmanager/push?token=...",
    commandExample: "微信命令示例：/mon ack cpu-high",
    placeholders: {
      integrationNameInput: "例如：Prometheus Alertmanager",
      integrationAliasInput: "例如：alertmanager",
      incomingTokenInput: "复制给 Alertmanager Webhook",
      replyTokenInput: "可选：给告警处理器回包用",
      outgoingUrlInput: "例如：https://example.com/alertmanager/commands",
      outgoingBearerTokenInput: "例如：alert-secret",
      commandAliasesInput: "例如：mon, am, 告警",
      defaultTargetsInput: "例如：group_sre",
      integrationNotesInput: "例如：生产集群 Alertmanager",
    },
    notes: {
      integrationNameInput: "建议标明负责的集群或环境。",
      integrationAliasInput: "通常写 alertmanager 或 am。",
      incomingTokenInput: "Prometheus Alertmanager 的 webhook 应指向这里。",
      replyTokenInput: "需要异步回包给微信时使用。",
      outgoingUrlInput: "适合接你自己的 ack、silence、查询类命令服务。",
      outgoingBearerTokenInput: "没有鉴权要求时可以留空。",
      commandAliasesInput: "可同时配 mon、am、告警等多个写法。",
      defaultTargetsInput: "建议指定值班群，减少误发。",
      integrationNotesInput: "备注集群名、命名空间或团队信息。",
    },
  },
};

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("zh-CN", { hour12: false });
}

function getExternalBaseUrl(state) {
  if (state?.config?.publicBaseUrl) {
    return String(state.config.publicBaseUrl).replace(/\/+$/, "");
  }
  const port = window.location.port || state?.app?.port || "";
  const lanIp = state?.app?.lanIp || "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(lanIp)) {
    return `${window.location.protocol}//${lanIp}${port ? `:${port}` : ""}`;
  }
  return window.location.origin;
}

function createHint(helpText) {
  const hint = document.createElement("span");
  hint.className = "hint-dot";
  hint.dataset.help = helpText;
  hint.textContent = "?";
  return hint;
}

function createCopyButton(targetId, kind, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn copy-btn";
  button.dataset.copyTarget = targetId;
  button.dataset.copyKind = kind;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = '<span class="copy-icon">⧉</span>';
  return button;
}

function markCopied(button) {
  flashCopyState(button, "copied", "✓");
}

function markCopyFailed(button) {
  flashCopyState(button, "copy-failed", "!");
}

function flashCopyState(button, className, icon) {
  const original = button.innerHTML;
  button.classList.add(className);
  button.innerHTML = `<span class="copy-icon">${icon}</span>`;
  setTimeout(() => {
    button.classList.remove(className);
    button.innerHTML = original;
  }, 1200);
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);

  let ok = false;
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    textarea.remove();
  }

  return ok;
}

async function copyText(text, button = null) {
  if (!text) {
    if (button) markCopyFailed(button);
    return false;
  }

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      if (button) markCopied(button);
      return true;
    }
  } catch {
    // fall through to execCommand fallback
  }

  const ok = fallbackCopyText(text);
  if (button) {
    if (ok) {
      markCopied(button);
    } else {
      markCopyFailed(button);
    }
  }
  return ok;
}

function ensureInputCopyButton(id, title) {
  const input = byId(id);
  if (!input || input.dataset.copyReady === "1") return;

  const wrapper = document.createElement("div");
  wrapper.className = "input-group";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  wrapper.appendChild(createCopyButton(id, "input", title));
  input.dataset.copyReady = "1";
}

function ensureTextCopyButton(id, title) {
  const target = byId(id);
  if (!target || target.dataset.copyReady === "1") return;

  const row = document.createElement("div");
  row.className = "value-row";
  target.parentNode.insertBefore(row, target);
  row.appendChild(target);
  row.appendChild(createCopyButton(id, "text", title));
  target.dataset.copyReady = "1";
}

function ensureFieldHint(fieldId, helpText) {
  const label = document.querySelector(`label[for="${fieldId}"]`);
  if (!label || label.dataset.hintReady === "1") return;
  label.classList.add("d-inline-flex", "align-items-center", "gap-2");
  label.appendChild(createHint(helpText));
  label.dataset.hintReady = "1";
}

function ensureFieldNote(fieldId) {
  const field = byId(fieldId);
  if (!field) return null;

  const noteId = `${fieldId}Note`;
  let note = byId(noteId);
  if (note) return note;

  note = document.createElement("div");
  note.id = noteId;
  note.className = "field-note";
  const anchor = field.closest(".input-group") || field.closest(".form-check") || field;
  anchor.insertAdjacentElement("afterend", note);
  return note;
}

function ensureBoxHint(targetId, helpText) {
  const target = byId(targetId);
  if (!target) return;
  const box = target.closest(".box");
  const title = box?.querySelector(".small");
  if (!title || title.dataset.hintReady === "1") return;
  title.classList.add("d-inline-flex", "align-items-center", "gap-2");
  title.appendChild(createHint(helpText));
  title.dataset.hintReady = "1";
}

function ensureSectionHint(config) {
  const anchor = document.querySelector(config.selector);
  if (!anchor || anchor.dataset.sectionHintReady === "1") return;

  let container = null;
  if (config.placement === "before") {
    container = anchor.parentElement?.querySelector("h2, .h5");
  } else if (config.placement === "title-prev") {
    container = anchor.parentElement?.querySelector("h2");
  }

  if (container && !container.dataset.hintReady) {
    container.classList.add("d-inline-flex", "align-items-center", "gap-2");
    container.appendChild(createHint(config.help));
    container.dataset.hintReady = "1";
  }

  anchor.dataset.sectionHintReady = "1";
}

function ensureAdapterPresetBox() {
  if (byId("adapterPresetBox")) return;
  const form = byId("integrationForm");
  if (!form) return;

  const card = document.createElement("div");
  card.id = "adapterPresetBox";
  card.className = "preset-card mb-3";
  card.innerHTML = `
    <div id="adapterPresetTitle" class="preset-title">通用集成</div>
    <div id="adapterPresetDesc" class="small-muted">通用集成适合自定义脚本、简单通知器或你自己的业务接口。</div>
    <div id="adapterPresetInbound" class="preset-code mono">入站示例：POST /api/integrations/ops/push?token=...</div>
    <div id="adapterPresetCommand" class="preset-code mono">微信命令示例：/ops restart moviepilot</div>
  `;
  form.insertAdjacentElement("beforebegin", card);
}

function ensureUiEnhancements() {
  Object.entries(STATIC_NOTES).forEach(([fieldId, noteText]) => {
    const note = ensureFieldNote(fieldId);
    if (note && !note.textContent.trim()) note.textContent = noteText;
  });
  ensureAdapterPresetBox();

  Object.entries(FIELD_HELP).forEach(([fieldId, helpText]) => {
    ensureFieldHint(fieldId, helpText);
    ensureFieldNote(fieldId);
  });

  SECTION_HELP.forEach((item) => ensureSectionHint(item));
  BOX_HELP.forEach((item) => ensureBoxHint(item.targetId, item.help));

  ensureInputCopyButton("tokenInput", "复制旧版 Token");
  ensureInputCopyButton("incomingTokenInput", "复制入站 Token");
  ensureInputCopyButton("replyTokenInput", "复制回包 Token");
  ensureInputCopyButton("outgoingUrlInput", "复制外发地址");
  ensureInputCopyButton("outgoingBearerTokenInput", "复制 Bearer Token");

  ensureTextCopyButton("pushUrl", "复制通用推送地址");
  ensureTextCopyButton("moviePilotUrl", "复制 MoviePilot 地址");
}

function applyAdapterPreset(type) {
  const preset = PRESETS[type] || PRESETS.generic;

  if (byId("adapterPresetTitle")) byId("adapterPresetTitle").textContent = preset.title;
  if (byId("adapterPresetDesc")) byId("adapterPresetDesc").textContent = preset.description;
  if (byId("adapterPresetInbound")) byId("adapterPresetInbound").textContent = preset.inboundExample;
  if (byId("adapterPresetCommand")) byId("adapterPresetCommand").textContent = preset.commandExample;

  Object.entries(preset.placeholders).forEach(([fieldId, placeholder]) => {
    const field = byId(fieldId);
    if (field) field.placeholder = placeholder;
  });

  if (preset.defaults) {
    Object.entries(preset.defaults).forEach(([fieldId, defaultValue]) => {
      const field = byId(fieldId);
      if (!field) return;
      const currentValue = "value" in field ? String(field.value || "").trim() : "";
      if (!currentValue) {
        field.value = defaultValue;
      }
    });
  }

  Object.entries(preset.notes).forEach(([fieldId, noteText]) => {
    const note = ensureFieldNote(fieldId);
    if (note) note.textContent = noteText;
  });
}

function fillIntegrationForm(item) {
  byId("integrationIdInput").value = item.id || "";
  byId("integrationNameInput").value = item.name || "";
  byId("integrationAliasInput").value = item.alias || "";
  byId("integrationTypeInput").value = item.adapterType || "generic";
  byId("integrationEnabledInput").checked = item.enabled !== false;
  byId("incomingTokenInput").value = item.incomingToken || "";
  byId("replyTokenInput").value = item.replyToken || "";
  byId("outgoingUrlInput").value = item.outgoingUrl || "";
  byId("outgoingBearerTokenInput").value = item.outgoingBearerToken || "";
  byId("commandAliasesInput").value = (item.commandAliases || []).join(", ");
  byId("defaultTargetsInput").value = (item.defaultTargetIds || []).join(", ");
  if (byId("integrationNotesInput")) {
    byId("integrationNotesInput").value = item.notes || "";
  }
  applyAdapterPreset(item.adapterType || "generic");
}

function resetIntegrationForm() {
  byId("integrationIdInput").value = "";
  clearIntegrationInputValues();
  byId("integrationTypeInput").value = "generic";
  byId("integrationEnabledInput").checked = true;
  applyAdapterPreset("generic");
}

function clearIntegrationInputValues() {
  byId("integrationNameInput").value = "";
  byId("integrationAliasInput").value = "";
  byId("incomingTokenInput").value = "";
  byId("replyTokenInput").value = "";
  byId("outgoingUrlInput").value = "";
  byId("outgoingBearerTokenInput").value = "";
  byId("commandAliasesInput").value = "";
  byId("defaultTargetsInput").value = "";
  if (byId("integrationNotesInput")) {
    byId("integrationNotesInput").value = "";
  }
}

function fillBotForm(item) {
  byId("botIdInput").value = item.botId || "";
  byId("botNameInput").value = item.name || "";
  byId("botDefaultInput").checked = item.isDefaultSender === true;
}

function resetBotForm() {
  byId("botIdInput").value = "";
  byId("botNameInput").value = "";
  byId("botDefaultInput").checked = false;
}

function getSelectedValues(select) {
  return Array.from(select?.selectedOptions || []).map((item) => item.value).filter(Boolean);
}

function setSelectedValues(select, values) {
  const selected = new Set(values || []);
  for (const option of Array.from(select?.options || [])) {
    option.selected = selected.has(option.value);
  }
}

function getCheckedValues(container) {
  return Array.from(container?.querySelectorAll('input[type="checkbox"]:checked') || [])
    .map((item) => item.value)
    .filter(Boolean);
}

function setCheckedValues(container, values) {
  const selected = new Set(values || []);
  for (const input of Array.from(container?.querySelectorAll('input[type="checkbox"]') || [])) {
    input.checked = selected.has(input.value);
  }
}

function setActiveSection(sectionId, syncHash = true) {
  const normalized = SECTION_IDS.includes(sectionId) ? sectionId : SECTION_IDS[0];
  activeSectionId = normalized;

  for (const id of SECTION_IDS) {
    const section = byId(id);
    if (section) {
      section.hidden = id !== normalized;
    }
  }

  document.querySelectorAll("[data-section-link]").forEach((link) => {
    link.classList.toggle("active", link.dataset.sectionLink === normalized);
  });

  if (syncHash && window.location.hash !== `#${normalized}`) {
    history.replaceState(null, "", `#${normalized}`);
  }
}

function getCapabilityOptions(state) {
  const dynamicValues = new Set();
  for (const item of state?.users?.items || []) {
    for (const capability of item.capabilities || []) {
      if (capability) dynamicValues.add(capability);
    }
  }
  for (const item of state?.notificationRules?.items || []) {
    for (const capability of item.capabilities || []) {
      if (capability) dynamicValues.add(capability);
    }
  }

  const options = new Map(BASE_USER_CAPABILITIES.map((item) => [item.value, item.label]));
  for (const capability of dynamicValues) {
    if (!options.has(capability)) {
      options.set(capability, capability);
    }
  }
  return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
}

function resetUserForm() {
  byId("userIdInput").value = "";
  byId("userNameInput").value = "";
  setCheckedValues(byId("userCapabilitiesInput"), []);
  byId("userDefaultRecipientInput").checked = false;
  if (byId("userTargetSelect")) {
    setSelectedValues(byId("userTargetSelect"), []);
  }
  updateUserTargetHint();
  updateUserCapabilitiesHint();
}

function fillNotificationRuleForm(item) {
  byId("notificationRuleIdInput").value = item.id || "";
  byId("notificationRuleNameInput").value = item.name || "";
  byId("notificationRuleSourceInput").value = item.source || "";
  byId("notificationRuleCategoryInput").value = item.category || "";
  byId("notificationRuleKeywordsInput").value = (item.keywords || []).join(", ");
  setSelectedValues(byId("notificationRuleBotIdsInput"), item.botIds || []);
  byId("notificationRuleCapabilitiesInput").value = (item.capabilities || []).join(", ");
  byId("notificationRuleUserIdsInput").value = (item.userIds || []).join(", ");
  byId("notificationRuleEnabledInput").checked = item.enabled !== false;
  byId("notificationRuleAllowDefaultInput").checked = item.allowDefaultRecipient !== false;
}

function resetNotificationRuleForm() {
  byId("notificationRuleIdInput").value = "";
  byId("notificationRuleNameInput").value = "";
  byId("notificationRuleSourceInput").value = "";
  byId("notificationRuleCategoryInput").value = "";
  byId("notificationRuleKeywordsInput").value = "";
  setSelectedValues(byId("notificationRuleBotIdsInput"), []);
  byId("notificationRuleCapabilitiesInput").value = "";
  byId("notificationRuleUserIdsInput").value = "";
  byId("notificationRuleEnabledInput").checked = true;
  byId("notificationRuleAllowDefaultInput").checked = true;
}

function applyRulePreset(presetId) {
  const preset = RULE_PRESET_EXAMPLES[presetId];
  if (!preset) return;
  fillNotificationRuleForm(preset);
  showToast(`已套用 ${preset.name} 模板`, "info");
}

function renderRulePresets() {
  const list = byId("rulePresetList");
  if (!list) return;
  list.innerHTML = Object.entries(SOURCE_TEMPLATE_DEFS)
    .map(
      ([key, item]) => `
        <div class="col-12 col-xl-4">
          <div class="box">
            <div class="small text-uppercase text-secondary">来源模板</div>
            <strong class="d-block mt-2">${escapeHtml(item.label)}</strong>
            <div class="small-muted mt-2">${escapeHtml(item.summary)}</div>
            <div class="small-muted mt-2">source: \`${escapeHtml(item.preset.source)}\`</div>
            <button class="btn btn-sm btn-outline-success mt-3" type="button" data-rule-preset="${escapeHtml(key)}">套用模板</button>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderIntegrationTypes(state) {
  const select = byId("integrationTypeInput");
  const currentValue = select.value || "generic";
  const items = state.integrations?.adapterTypes || [];
  select.innerHTML = items
    .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
    .join("");
  select.value = items.some((item) => item.value === currentValue) ? currentValue : "generic";
}

function renderBots(state) {
  const list = byId("botList");
  if (!list) return;

  const items = state.bots?.items || [];
  list.innerHTML = items.length
    ? items
        .map((item) => `
          <div class="box ${item.isDefaultSender ? "border-success-subtle" : ""}">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <strong>${escapeHtml(item.name || item.botId)}</strong>
                <div class="small-muted mono mt-1">${escapeHtml(item.botId || "")}</div>
              </div>
              <div class="text-end">
                <div class="small-muted">${escapeHtml(STATUS_TEXT[item.status] || item.status || "未知")}</div>
                ${item.isDefaultSender ? '<div class="small text-success mt-1">当前默认</div>' : ""}
              </div>
            </div>
            <div class="small mt-2"><strong>微信账号：</strong><span class="mono">${escapeHtml(item.accountId || "未登录")}</span></div>
            <div class="small mt-2"><strong>默认机器人：</strong>${item.isDefaultSender ? "是" : "否"}</div>
            ${item.qrCodeDataUrl ? `<div class="text-center mt-3"><img class="img-fluid rounded" src="${item.qrCodeDataUrl}" alt="bot qr code" /></div>` : ""}
            <div class="small-muted mt-2">${escapeHtml(item.message || item.lastError || "")}</div>
            <div class="d-flex gap-2 flex-wrap mt-3">
              <button class="btn btn-sm btn-outline-success" data-bot-action="edit" data-bot-id="${escapeHtml(item.botId)}">编辑</button>
              <button class="btn btn-sm btn-outline-primary" data-bot-action="login" data-bot-id="${escapeHtml(item.botId)}">扫码登录</button>
              <button class="btn btn-sm btn-outline-secondary" data-bot-action="default" data-bot-id="${escapeHtml(item.botId)}" ${item.isDefaultSender ? "disabled" : ""}>${item.isDefaultSender ? "已是默认" : "设为默认"}</button>
              <button class="btn btn-sm btn-outline-danger" data-bot-action="delete" data-bot-id="${escapeHtml(item.botId)}">删除</button>
            </div>
          </div>
        `)
        .join("")
    : '<div class="small-muted">暂无机器人账号。</div>';
}

function buildUsersByTargetKey(state) {
  const usersByTargetKey = new Map();
  for (const user of state.users?.items || []) {
    for (const binding of user.bindings || []) {
      const targetKey = `${binding.botId}::${binding.targetId}`;
      const current = usersByTargetKey.get(targetKey) || [];
      current.push(user.userId || user.name || binding.targetId);
      usersByTargetKey.set(targetKey, current);
    }
  }
  return usersByTargetKey;
}

function renderPeopleOverview(state) {
  const list = byId("peopleOverview");
  if (!list) return;

  const bots = state.bots?.items || [];
  const targets = state.targets || [];
  const usersByTargetKey = buildUsersByTargetKey(state);
  const targetsByBotId = new Map();

  for (const target of targets) {
    const current = targetsByBotId.get(target.botId) || [];
    current.push(target);
    targetsByBotId.set(target.botId, current);
  }

  list.innerHTML = bots.length
    ? bots
        .map((bot) => {
          const botTargets = targetsByBotId.get(bot.botId) || [];
          const boundUsers = new Map();
          for (const target of botTargets) {
            const targetKey = `${bot.botId}::${target.targetId}`;
            for (const userId of usersByTargetKey.get(targetKey) || []) {
              boundUsers.set(userId, userId);
            }
          }

          const targetMarkup = botTargets.length
            ? botTargets
                .map((target) => {
                  const targetKey = `${bot.botId}::${target.targetId}`;
                  const users = usersByTargetKey.get(targetKey) || [];
                  return `
                    <div class="relationship-item">
                      <div class="relationship-item-header">
                        <div class="mono fw-semibold">${escapeHtml(target.targetId)}</div>
                        <div class="small-muted">${escapeHtml(formatDate(target.lastSeenAt))}</div>
                      </div>
                      <div class="small-muted mt-2">绑定用户：${escapeHtml(users.join(", ") || "未绑定")}</div>
                      <div class="small-muted">首次激活：${escapeHtml(formatDate(target.firstSeenAt))}</div>
                    </div>
                  `;
                })
                .join("")
            : '<div class="small-muted">暂无已激活目标。让对应微信先给这个机器人发一条消息，目标才会出现在这里。</div>';

          return `
            <article class="relationship-card ${bot.isDefaultSender ? "relationship-card-primary" : ""}">
              <div class="relationship-header">
                <div>
                  <div class="relationship-title">
                    <strong>${escapeHtml(bot.name || bot.botId)}</strong>
                    <span class="bot-pill mono">${escapeHtml(bot.botId || "-")}</span>
                    ${bot.isDefaultSender ? '<span class="status-pill default">默认发送</span>' : ""}
                  </div>
                  <div class="small-muted mono mt-2">${escapeHtml(bot.accountId || "未登录")}</div>
                </div>
                <div class="status-pill">${escapeHtml(STATUS_TEXT[bot.status] || bot.status || "未知")}</div>
              </div>
              <div class="metric-grid">
                <div class="metric-card">
                  <div class="metric-label">目标数</div>
                  <div class="metric-value">${botTargets.length}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">绑定用户</div>
                  <div class="metric-value">${boundUsers.size}</div>
                </div>
                <div class="metric-card">
                  <div class="metric-label">默认身份</div>
                  <div class="metric-value">${bot.isDefaultSender ? "主用" : "备用"}</div>
                </div>
              </div>
              <div class="relationship-stack">
                ${targetMarkup}
              </div>
            </article>
          `;
        })
        .join("")
    : '<div class="small-muted">暂无机器人账号。</div>';
}

function renderTargets(state) {
  const targetList = byId("targetList");
  if (!targetList) return;
  if (!(state.targets || []).length) {
    targetList.innerHTML = '<div class="small-muted">暂无目标地址。</div>';
    return;
  }

  const usersByTargetId = buildUsersByTargetKey(state);
  const targetsByBotId = new Map();
  for (const item of state.targets || []) {
    const current = targetsByBotId.get(item.botId) || [];
    current.push(item);
    targetsByBotId.set(item.botId, current);
  }

  targetList.innerHTML = Array.from(targetsByBotId.entries())
    .map(([botId, items]) => `
      <div class="relationship-card">
        <div class="relationship-header">
          <div class="relationship-title">
            <strong>${escapeHtml((state.bots?.items || []).find((bot) => bot.botId === botId)?.name || botId)}</strong>
            <span class="bot-pill mono">${escapeHtml(botId || "-")}</span>
          </div>
          <div class="small-muted">${items.length} 个目标</div>
        </div>
        <div class="relationship-stack">
          ${items
            .map((item) => {
              const targetKey = `${item.botId}::${item.targetId}`;
              const boundUsers = usersByTargetId.get(targetKey) || [];
              return `
                <div class="relationship-item">
                  <div class="relationship-item-header">
                    <div class="mono fw-semibold">${escapeHtml(item.targetId)}</div>
                    <div class="small-muted">${escapeHtml(formatDate(item.lastSeenAt))}</div>
                  </div>
                  <div class="small-muted mt-2">绑定用户：${escapeHtml(boundUsers.join(", ") || "未绑定")}</div>
                  <div class="small-muted">首次激活：${escapeHtml(formatDate(item.firstSeenAt))}</div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `)
    .join("");
}

function renderUserTargetOptions(state) {
  const select = byId("userTargetSelect");
  if (!select) return;
  const current = getSelectedValues(select);

  const options = (state.targets || []).filter((item) => item?.targetId && item?.botId);

  select.innerHTML = options
    .map(
      (item) =>
        `<option value="${escapeHtml(`${item.botId}::${item.targetId}`)}">${escapeHtml(`${item.botId} | ${item.targetId}`)}</option>`,
    )
    .join("");
  setSelectedValues(select, current);
}

function buildUserTargetOptionsMarkup(state, selectedValues = []) {
  const selected = new Set(selectedValues || []);
  const options = (state.targets || []).filter((item) => item?.targetId && item?.botId);
  return options
    .map((item) => {
      const value = `${item.botId}::${item.targetId}`;
      return `<option value="${escapeHtml(value)}" ${selected.has(value) ? "selected" : ""}>${escapeHtml(`${item.botId} | ${item.targetId}`)}</option>`;
    })
    .join("");
}

function buildUserCapabilityOptionsMarkup(state, selectedValues = []) {
  const selected = new Set(selectedValues || []);
  return getCapabilityOptions(state)
    .map(
      (item) => `
        <label class="choice-chip">
          <input type="checkbox" value="${escapeHtml(item.value)}" ${selected.has(item.value) ? "checked" : ""} />
          <span>${escapeHtml(item.label)}</span>
        </label>
      `,
    )
    .join("");
}

function renderUserCapabilityOptions(state) {
  const container = byId("userCapabilitiesInput");
  if (!container) return;
  const current = getCheckedValues(container);
  const options = getCapabilityOptions(state);
  container.innerHTML = options
    .map(
      (item) => `
        <label class="choice-chip">
          <input type="checkbox" value="${escapeHtml(item.value)}" />
          <span>${escapeHtml(item.label)}</span>
        </label>
      `,
    )
    .join("");
  setCheckedValues(container, current);
  updateUserCapabilitiesHint();
}

function renderNotificationRuleBotOptions(state) {
  const select = byId("notificationRuleBotIdsInput");
  if (!select) return;
  const current = getSelectedValues(select);
  const items = state.bots?.items || [];
  select.innerHTML = items
    .map(
      (item) =>
        `<option value="${escapeHtml(item.botId)}">${escapeHtml(`${item.botId} | ${item.name || item.botId}`)}</option>`,
    )
    .join("");
  setSelectedValues(select, current);
}

function updateUserTargetHint() {
  const hint = byId("userTargetHint");
  if (!hint) return;
  const selected = getSelectedValues(byId("userTargetSelect"));
  hint.textContent = selected.length
    ? selected.map((item) => item.replace("::", " | ")).join(", ")
    : "从这里直接选择 bot / target 绑定关系。";
}

function updateUserCapabilitiesHint() {
  const hint = byId("userCapabilitiesHint");
  if (!hint) return;
  const selected = getCheckedValues(byId("userCapabilitiesInput"));
  hint.textContent = selected.length
    ? `当前已选择：${selected.map((item) => getCapabilityDisplayName(latestState || {}, item)).join("、")}`
    : "勾选后保存。这里代表这个用户能接收哪些通知类型。";
}

function buildCapabilityLabelMap(state) {
  return new Map(getCapabilityOptions(state).map((item) => [item.value, item.label]));
}

function getCapabilityDisplayName(state, capability) {
  const rawLabel = buildCapabilityLabelMap(state).get(capability) || capability || "";
  const parts = String(rawLabel).split("|").map((item) => item.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || capability;
}

function getUsersAddressedByRule(rule, state) {
  const addressed = new Set();
  for (const user of state.users?.items || []) {
    if (user.enabled === false || !(user.bindings || []).length) {
      continue;
    }
    if ((rule.userIds || []).includes(user.userId)) {
      addressed.add(user.userId);
      continue;
    }
    if ((rule.capabilities || []).some((capability) => (user.capabilities || []).includes(capability))) {
      addressed.add(user.userId);
    }
  }
  return addressed;
}

function getBindingTargetKeys(bindings, botIds = []) {
  const allowedBotIds = new Set(botIds || []);
  return (bindings || [])
    .filter((binding) => binding?.botId && binding?.targetId)
    .filter((binding) => !allowedBotIds.size || allowedBotIds.has(binding.botId))
    .map((binding) => `${binding.botId}::${binding.targetId}`);
}

function getExplicitTargetKeysForRule(rule, state) {
  const targetKeys = new Set();
  for (const user of state.users?.items || []) {
    if (user.enabled === false || !(user.bindings || []).length) {
      continue;
    }
    const directMatch = (rule.userIds || []).includes(user.userId);
    const capabilityMatch = (rule.capabilities || []).some((capability) =>
      (user.capabilities || []).includes(capability),
    );
    if (!directMatch && !capabilityMatch) {
      continue;
    }
    for (const targetKey of getBindingTargetKeys(user.bindings, rule.botIds || [])) {
      targetKeys.add(targetKey);
    }
  }
  return targetKeys;
}

function getUserByTargetKey(state, targetKey) {
  for (const user of state.users?.items || []) {
    if ((user.bindings || []).some((binding) => `${binding.botId}::${binding.targetId}` === targetKey)) {
      return user;
    }
  }
  return null;
}

function buildUserRoutingSummary(user, state, targetKey) {
  if (!user) {
    return [];
  }
  const rules = state.notificationRules?.items || [];
  const entries = [];

  for (const rule of rules) {
    if (rule.enabled === false) {
      continue;
    }

    const explicitTargetKeys = getExplicitTargetKeysForRule(rule, state);
    const explicitCurrent = explicitTargetKeys.has(targetKey);
    const directMatch = explicitCurrent && (rule.userIds || []).includes(user.userId);
    const matchedCapabilities = explicitCurrent
      ? (rule.capabilities || []).filter((capability) => (user.capabilities || []).includes(capability))
      : [];
    const fallbackMatch =
      !explicitTargetKeys.size &&
      user.isDefaultRecipient &&
      rule.allowDefaultRecipient !== false &&
      getBindingTargetKeys(user.bindings, rule.botIds || []).includes(targetKey);

    if (!directMatch && !matchedCapabilities.length && !fallbackMatch) {
      continue;
    }

    let reason = "默认发给你";
    let detail = "这类通知没有指定别人时，会先发给你。";
    if (directMatch) {
      reason = "直接发给你";
      detail = "这条规则直接指定把消息发给你。";
    } else if (matchedCapabilities.length) {
      reason = "按你勾选的来源";
      detail = `因为你勾选了「${matchedCapabilities
        .map((capability) => getCapabilityDisplayName(state, capability))
        .join(" / ")}」。`;
    }

    entries.push({
      id: rule.id,
      name: rule.name || rule.id,
      reason,
      detail,
    });
  }

  const reasonOrder = {
    "直接发给你": 0,
    "按你勾选的来源": 1,
    "默认发给你": 2,
  };

  return entries.sort((left, right) => {
    const orderDelta = (reasonOrder[left.reason] ?? 99) - (reasonOrder[right.reason] ?? 99);
    if (orderDelta !== 0) {
      return orderDelta;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function renderUsers(state) {
  const list = byId("userList");
  if (!list) return;

  const botNameById = new Map((state.bots?.items || []).map((item) => [item.botId, item.name || item.botId]));
  const targetItems = [...(state.targets || [])].sort((left, right) => {
    const botCompare = String(left.botId || "").localeCompare(String(right.botId || ""), "zh-CN");
    if (botCompare !== 0) {
      return botCompare;
    }
    return String(left.targetId || "").localeCompare(String(right.targetId || ""), "zh-CN");
  });

  list.innerHTML = targetItems.length
    ? targetItems
        .map((targetItem) => {
          const targetKey = `${targetItem.botId}::${targetItem.targetId}`;
          const linkedUser = getUserByTargetKey(state, targetKey);
          const routingSummary = buildUserRoutingSummary(linkedUser, state, targetKey);
          const capabilityLabels = (linkedUser?.capabilities || []).map((capability) => {
            const label = getCapabilityDisplayName(state, capability);
            return `<span class="capability-pill">${escapeHtml(label)}</span>`;
          });
          const deliveryNames = Array.from(new Set(routingSummary.map((entry) => entry.name)));
          const editorUserId = linkedUser?.userId || targetItem.botId || "";
          const editorName = linkedUser?.name || "";
          const editorCapabilities = linkedUser?.capabilities || [];
          const editorDefault = linkedUser?.isDefaultRecipient === true;
          const preservedTargetKeys = linkedUser
            ? (linkedUser.bindings || []).map((binding) => `${binding.botId}::${binding.targetId}`)
            : [targetKey];

          return `
          <article class="relationship-card ${linkedUser?.isDefaultRecipient ? "relationship-card-primary" : ""}">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <strong>${escapeHtml(linkedUser?.name || targetItem.botId || "未命名")}</strong>
                <div class="small-muted mono mt-1">${escapeHtml(linkedUser?.userId || targetItem.botId || "")}</div>
              </div>
              <div class="status-pill ${linkedUser?.isDefaultRecipient ? "default" : ""}">${linkedUser?.isDefaultRecipient ? "默认接收人" : linkedUser ? "已设置" : "待设置"}</div>
            </div>
            <div class="section-subcopy mt-2 mb-0">绑定目标</div>
            <div class="binding-list mt-2">
              <div class="binding-chip">
                <div class="binding-chip-top">
                  <span class="bot-pill mono">${escapeHtml(botNameById.get(targetItem.botId) || targetItem.botId || "-")}</span>
                  <span class="small-muted mono">${escapeHtml(targetItem.botId || "-")}</span>
                </div>
                <div class="mono">${escapeHtml(targetItem.targetId || "")}</div>
              </div>
            </div>
            <div class="section-subcopy mt-3 mb-0">已开通来源</div>
            <div class="capability-chip-list mt-2">
              ${capabilityLabels.length ? capabilityLabels.join("") : '<span class="small-muted">还没有设置。</span>'}
            </div>
            <div class="section-subcopy mt-3 mb-0">当前收到摘要</div>
            <div class="capability-chip-list mt-2">
              ${
                deliveryNames.length
                  ? deliveryNames.map((name) => `<span class="delivery-pill">${escapeHtml(name)}</span>`).join("")
                  : '<span class="small-muted">还没有任何通知会发到这张卡。</span>'
              }
            </div>
            <div class="d-flex gap-2 flex-wrap mt-3">
              <button class="btn btn-sm btn-outline-success" data-user-action="toggle-edit" data-target-key="${escapeHtml(targetKey)}">${openUserEditors.has(targetKey) ? "收起编辑" : "编辑"}</button>
              ${
                linkedUser
                  ? `<button class="btn btn-sm btn-outline-danger" data-user-action="delete" data-target-key="${escapeHtml(targetKey)}">删除</button>`
                  : ""
              }
            </div>
            <div class="user-editor-panel mt-3" ${openUserEditors.has(targetKey) ? "" : "hidden"} data-user-editor="${escapeHtml(targetKey)}">
              <div class="small text-uppercase text-secondary mb-2">编辑 ${escapeHtml(targetItem.botId || "")}</div>
              <form class="row g-3" data-user-edit-form="${escapeHtml(targetKey)}" data-existing-target-keys="${escapeHtml(preservedTargetKeys.join(","))}">
                ${
                  linkedUser
                    ? ""
                    : `
                      <div class="col-12">
                        <label class="form-label">用户 ID</label>
                        <input class="form-control mono" type="text" value="${escapeHtml(editorUserId)}" data-user-field="userId" />
                      </div>
                    `
                }
                <div class="col-12 col-md-6">
                  <label class="form-label">卡片名称</label>
                  <input class="form-control" type="text" value="${escapeHtml(editorName || editorUserId)}" data-user-field="name" />
                </div>
                <div class="col-12 col-md-6">
                  <div class="form-check mt-4">
                    <input class="form-check-input" type="checkbox" ${editorDefault ? "checked" : ""} data-user-field="default" />
                    <label class="form-check-label">设为默认接收人</label>
                  </div>
                </div>
	                <div class="col-12">
	                  <label class="form-label">当前绑定目标</label>
	                  <div class="binding-list">
	                    <div class="binding-chip">
                      <div class="binding-chip-top">
                        <span class="bot-pill mono">${escapeHtml(botNameById.get(targetItem.botId) || targetItem.botId || "-")}</span>
                        <span class="small-muted mono">${escapeHtml(targetItem.botId || "-")}</span>
                      </div>
	                      <div class="mono">${escapeHtml(targetItem.targetId || "")}</div>
	                    </div>
	                  </div>
	                  <details class="mt-3">
	                    <summary class="small-muted">更换这张卡绑定的目标</summary>
	                    <div class="mt-2">
	                      <select class="form-select mono" size="6" data-user-field="next-target">
	                        ${buildUserTargetOptionsMarkup(state, [targetKey])}
	                      </select>
	                      <div class="field-note">默认保持当前目标；只有你想把这张卡改绑到别处时才改这里。</div>
	                    </div>
	                  </details>
	                </div>
                <div class="col-12">
                  <label class="form-label">勾选要接收的来源</label>
                  <div class="choice-grid" data-user-field="capabilities">${buildUserCapabilityOptionsMarkup(state, editorCapabilities)}</div>
                  <div class="field-note">这里才是可编辑入口。勾选后，这张卡就会接收对应来源的通知。</div>
                </div>
                <div class="col-12">
                  <details>
                    <summary class="small-muted">查看这张卡为什么会收到这些通知</summary>
                    <div class="delivery-list mt-3">
                    ${
                      routingSummary.length
                        ? routingSummary
                            .map(
                              (entry) => `
                                <div class="delivery-item">
                                  <div class="delivery-item-header">
                                    <strong>${escapeHtml(entry.name)}</strong>
                                    <span class="delivery-pill">${escapeHtml(entry.reason)}</span>
                                  </div>
                                  <div class="small-muted mt-2">${escapeHtml(entry.detail)}</div>
                                </div>
                              `,
                            )
                            .join("")
                        : '<div class="small-muted">先勾上接收来源，系统就会自动说明为什么这张卡会收到这些通知。</div>'
                    }
                    </div>
                  </details>
                </div>
                <div class="col-12 d-flex gap-2">
                  <button class="btn btn-sm btn-success" type="submit">保存这张卡</button>
                  <button class="btn btn-sm btn-outline-secondary" type="button" data-user-action="toggle-edit" data-target-key="${escapeHtml(targetKey)}">收起</button>
                </div>
              </form>
            </div>
          </article>
        `;
        })
        .join("")
    : '<div class="small-muted">暂无家庭用户。</div>';
}

function renderNotificationRules(state) {
  const list = byId("notificationRuleList");
  if (!list) return;

  const items = state.notificationRules?.items || [];
  list.innerHTML = items.length
    ? items
        .map((item) => `
          <div class="box">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <strong>${escapeHtml(item.name || item.id)}</strong>
                <div class="small-muted mono mt-1">${escapeHtml(item.id || "")}</div>
              </div>
              <div class="small-muted">${item.enabled === false ? "已停用" : "已启用"}</div>
            </div>
            <div class="small mt-2"><strong>来源：</strong>${escapeHtml(item.source || "-")}</div>
            <div class="small mt-2"><strong>分类：</strong>${escapeHtml(item.category || "-")}</div>
            <div class="small mt-2"><strong>机器人：</strong>${escapeHtml((item.botIds || []).join(", ") || "全部")}</div>
            <div class="small mt-2"><strong>关键词：</strong>${escapeHtml((item.keywords || []).join(", ") || "-")}</div>
            <div class="small mt-2"><strong>能力：</strong>${escapeHtml((item.capabilities || []).join(", ") || "-")}</div>
            <div class="small mt-2"><strong>直发用户：</strong>${escapeHtml((item.userIds || []).join(", ") || "-")}</div>
            <div class="small mt-2"><strong>默认回落：</strong>${item.allowDefaultRecipient !== false ? "允许" : "关闭"}</div>
            <div class="d-flex gap-2 flex-wrap mt-3">
              <button class="btn btn-sm btn-outline-success" data-rule-action="edit" data-rule-id="${escapeHtml(item.id)}">编辑</button>
              <button class="btn btn-sm btn-outline-danger" data-rule-action="delete" data-rule-id="${escapeHtml(item.id)}">删除</button>
            </div>
          </div>
        `)
        .join("")
    : '<div class="small-muted">暂无通知规则。</div>';
}

function renderLogs(state) {
  const logList = byId("logList");
  const items = state.logs || [];
  logList.innerHTML = items.length
    ? items
        .map((item) => `<div class="box"><div class="d-flex justify-content-between"><strong>${escapeHtml(item.kind || "log")}</strong><span class="small-muted">${escapeHtml(formatDate(item.createdAt))}</span></div><div class="mt-2">${escapeHtml(item.summary || "")}</div></div>`)
        .join("")
    : '<div class="small-muted">暂无日志。</div>';
}

function renderDispatches(state) {
  const list = byId("dispatchList");
  const items = state.integrations?.recentDispatches || [];
  list.innerHTML = items.length
    ? items
        .map((item) => `<div class="box"><div class="d-flex justify-content-between"><strong>${escapeHtml(item.integrationName || item.integrationAlias || "integration")}</strong><span class="small-muted">${escapeHtml(item.status || "queued")}</span></div><div class="small mono mt-2">${escapeHtml(item.correlationId || "")}</div><div class="mt-2">${escapeHtml(item.commandText || item.rawText || "")}</div>${item.error ? `<div class="text-danger small mt-2">${escapeHtml(item.error)}</div>` : ""}${item.responseSummary ? `<div class="small-muted mt-2">${escapeHtml(item.responseSummary)}</div>` : ""}</div>`)
        .join("")
    : '<div class="small-muted">暂无任务。</div>';
}

function renderDeliveryWindows(state) {
  const list = byId("deliveryWindowList");
  if (!list) return;
  const items = state.queue?.deliveryWindows || [];
  list.innerHTML = items.length
    ? items
        .map((item) => `
          <div class="box">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <strong>${escapeHtml(item.botId || "-")} | ${escapeHtml(item.targetId || "-")}</strong>
              <span class="small-muted">已发 ${escapeHtml(String(item.proactiveCount ?? 0))} 次</span>
            </div>
            <div class="small mt-2">最近用户消息：${escapeHtml(formatDate(item.lastUserMessageAt))}</div>
            <div class="small mt-1">最近主动发送：${escapeHtml(formatDate(item.lastProactiveMessageAt))}</div>
          </div>
        `)
        .join("")
    : '<div class="small-muted">暂无窗口状态。</div>';
}

function renderPendingQueue(state) {
  const list = byId("pendingQueueList");
  if (!list) return;
  const items = state.queue?.pendingNotifications || [];
  list.innerHTML = items.length
    ? items
        .map((item) => `
          <div class="box">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <strong>${escapeHtml(item.title || item.source || item.category || "通知")}</strong>
              <span class="small-muted">${escapeHtml(item.priority || "-")}</span>
            </div>
            <div class="small mt-2">${escapeHtml(item.botId || "-")} | ${escapeHtml(item.targetId || "-")}</div>
            <div class="small mt-1">来源：${escapeHtml(item.source || "-")} / 分类：${escapeHtml(item.category || "-")}</div>
            <div class="small mt-1">${escapeHtml(formatDate(item.createdAt))}</div>
            ${item.content ? `<div class="small mt-2">${escapeHtml(item.content)}</div>` : ""}
          </div>
        `)
        .join("")
    : '<div class="small-muted">暂无积存消息。</div>';
}

function renderChatTargets(state) {
  const select = byId("chatTargetSelect");
  const ids = new Map();

  for (const item of state.targets || []) {
    if (item?.targetId && item?.botId) {
      ids.set(`${item.botId}::${item.targetId}`, `${item.botId} | ${item.targetId}`);
    }
  }
  for (const key of Object.keys(state.chat?.conversations || {})) {
    ids.set(key, key.replace("::", " | "));
  }

  const targetEntries = Array.from(ids.entries());
  if (!selectedTargetId || !targetEntries.some(([value]) => value === selectedTargetId)) {
    selectedTargetId = targetEntries[0]?.[0] || "";
  }

  select.innerHTML = targetEntries.length
    ? targetEntries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")
    : '<option value="">暂无目标</option>';
  select.value = selectedTargetId;
}

function renderChatConversation(state) {
  const list = byId("chatMessageList");
  if (!selectedTargetId) {
    list.innerHTML = '<div class="small-muted">请选择目标地址。</div>';
    return;
  }

  const items = state.chat?.conversations?.[selectedTargetId] || [];
  list.innerHTML = items.length
    ? items
        .map((item) => `<div class="chat-msg ${escapeHtml(item.direction || "outbound")}"><div class="small text-secondary mb-1">${escapeHtml(item.source || "chat")} · ${escapeHtml(formatDate(item.createdAt))}</div><div>${escapeHtml(item.text || "")}</div></div>`)
        .join("")
    : '<div class="small-muted">暂无会话记录。</div>';
  list.scrollTop = list.scrollHeight;
}

function renderIntegrations(state) {
  const list = byId("integrationList");
  const items = state.integrations?.items || [];

  list.innerHTML = items.length
    ? items
        .map((item) => {
          const base = getExternalBaseUrl(state);
          const inboundUrl = `${base}${item.inboundPath}?token=${encodeURIComponent(item.incomingToken || "")}`;
          const replyUrl = `${base}${item.replyPath}?token=${encodeURIComponent(item.replyToken || "")}`;
          const outgoingUrl = item.outgoingUrl || "未配置";
          return `
            <div class="box">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <strong>${escapeHtml(item.name || item.alias)}</strong>
                  <div class="small-muted">${escapeHtml(item.adapterLabel || item.adapterType)} · ${item.enabled ? "已启用" : "已停用"}</div>
                </div>
                <div class="mono small">${escapeHtml(item.alias)}</div>
              </div>

              <div class="small mt-2"><strong>命令：</strong>${escapeHtml((item.effectiveCommandAliases || []).join(", ") || "-")}</div>

              <div class="value-row mt-2">
                <div class="box small"><strong>入站：</strong><span class="mono">${escapeHtml(inboundUrl)}</span></div>
                <button class="icon-btn" type="button" data-action="copy-in" data-id="${escapeHtml(item.id)}" title="复制入站地址" aria-label="复制入站地址"><span class="copy-icon">⧉</span></button>
              </div>

              <div class="value-row mt-2">
                <div class="box small"><strong>回包：</strong><span class="mono">${escapeHtml(replyUrl)}</span></div>
                <button class="icon-btn" type="button" data-action="copy-reply" data-id="${escapeHtml(item.id)}" title="复制回包地址" aria-label="复制回包地址"><span class="copy-icon">⧉</span></button>
              </div>

              <div class="value-row mt-2">
                <div class="box small"><strong>外发：</strong><span class="mono">${escapeHtml(outgoingUrl)}</span></div>
                <button class="icon-btn" type="button" data-action="copy-out" data-id="${escapeHtml(item.id)}" title="复制外发地址" aria-label="复制外发地址"><span class="copy-icon">⧉</span></button>
              </div>

              <div class="d-flex gap-2 flex-wrap mt-3">
                <button class="btn btn-sm btn-outline-success" data-action="edit" data-id="${escapeHtml(item.id)}">编辑</button>
                <button class="btn btn-sm btn-outline-primary" data-action="test" data-id="${escapeHtml(item.id)}">测试外发</button>
                <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button>
              </div>
            </div>
          `;
        })
        .join("")
    : '<div class="small-muted">暂无集成。</div>';
}

function render(state) {
  latestState = state;
  byId("statusText").textContent = STATUS_TEXT[state.wechat.status] || state.wechat.status || "未知";
  byId("accountId").textContent = state.wechat.accountId || "未绑定";
  byId("lanIp").textContent = state.app.lanIp || "-";
  byId("targetCount").textContent = String((state.targets || []).length);

  if (document.activeElement !== byId("tokenInput")) {
    byId("tokenInput").value = state.config.webhookToken || "";
  }
  if (document.activeElement !== byId("publicBaseUrlInput")) {
    byId("publicBaseUrlInput").value = state.config.publicBaseUrl || "";
  }

  const base = getExternalBaseUrl(state);
  byId("pushUrl").textContent = `${base}/api/push`;
  byId("moviePilotUrl").textContent = `${base}/api/push/moviepilot`;

  renderBots(state);
  renderPeopleOverview(state);
  renderTargets(state);
  renderUserTargetOptions(state);
  renderUserCapabilityOptions(state);
  renderNotificationRuleBotOptions(state);
  updateUserTargetHint();
  renderUsers(state);
  renderRulePresets();
  renderNotificationRules(state);
  renderLogs(state);
  renderDispatches(state);
  renderDeliveryWindows(state);
  renderPendingQueue(state);
  renderChatTargets(state);
  renderChatConversation(state);
  renderIntegrationTypes(state);
  renderIntegrations(state);
  ensureUiEnhancements();
  applyAdapterPreset(byId("integrationTypeInput").value || "generic");
  setActiveSection(activeSectionId, false);
}

async function fetchState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`状态获取失败: ${response.status}`);
  }
  render(await response.json());
}

async function saveConfig(event) {
  event.preventDefault();
  const response = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookToken: byId("tokenInput").value.trim(),
      publicBaseUrl: byId("publicBaseUrlInput").value.trim(),
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "保存失败", "error");
    return;
  }
  render(result);
  showToast("全局配置已保存");
}

async function saveIntegration(event) {
  event.preventDefault();
  const response = await fetch("/api/integrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: byId("integrationIdInput").value.trim(),
      name: byId("integrationNameInput").value.trim(),
      alias: byId("integrationAliasInput").value.trim(),
      adapterType: byId("integrationTypeInput").value,
      enabled: byId("integrationEnabledInput").checked,
      incomingToken: byId("incomingTokenInput").value.trim(),
      replyToken: byId("replyTokenInput").value.trim(),
      outgoingUrl: byId("outgoingUrlInput").value.trim(),
      outgoingBearerToken: byId("outgoingBearerTokenInput").value.trim(),
      commandAliases: byId("commandAliasesInput").value.trim(),
      defaultTargetIds: byId("defaultTargetsInput").value.trim(),
      notes: byId("integrationNotesInput")?.value.trim() || "",
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "保存集成失败", "error");
    return;
  }
  resetIntegrationForm();
  render(result);
  showToast("集成配置已保存");
}

async function saveBot(event) {
  event.preventDefault();
  const botId = byId("botIdInput").value.trim();
  if (!botId) {
    showToast("请先填写机器人 ID", "error");
    return;
  }

  const response = await fetch(`/api/bots/${encodeURIComponent(botId)}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: byId("botNameInput").value.trim(),
      isDefaultSender: byId("botDefaultInput").checked,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "创建机器人失败", "error");
    return;
  }
  resetBotForm();
  render(result);
  showToast(`机器人 ${botId} 已保存，请查看右侧二维码状态`);
}

async function saveUser(event) {
  event.preventDefault();
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: byId("userIdInput").value.trim(),
      name: byId("userNameInput").value.trim(),
      targetKeys: getSelectedValues(byId("userTargetSelect")),
      capabilities: getCheckedValues(byId("userCapabilitiesInput")),
      isDefaultRecipient: byId("userDefaultRecipientInput").checked,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "保存家庭用户失败", "error");
    return;
  }
  resetUserForm();
  render(result);
  showToast("家庭用户已保存");
}

async function saveNotificationRule(event) {
  event.preventDefault();
  const response = await fetch("/api/notification-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: byId("notificationRuleIdInput").value.trim(),
      name: byId("notificationRuleNameInput").value.trim(),
      source: byId("notificationRuleSourceInput").value.trim(),
      category: byId("notificationRuleCategoryInput").value.trim(),
      keywords: byId("notificationRuleKeywordsInput").value.trim(),
      botIds: getSelectedValues(byId("notificationRuleBotIdsInput")),
      capabilities: byId("notificationRuleCapabilitiesInput").value.trim(),
      userIds: byId("notificationRuleUserIdsInput").value.trim(),
      enabled: byId("notificationRuleEnabledInput").checked,
      allowDefaultRecipient: byId("notificationRuleAllowDefaultInput").checked,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "保存通知规则失败", "error");
    return;
  }
  resetNotificationRuleForm();
  render(result);
  showToast("通知规则已保存");
}

async function sendChat(event) {
  event.preventDefault();
  const text = byId("chatInput").value.trim();
  const fileUrl = byId("chatFileUrlInput").value.trim();
  const filePath = byId("chatFilePathInput").value.trim();
  const fileName = byId("chatFileNameInput").value.trim();
  if (!selectedTargetId) {
    showToast("请先选择目标地址", "error");
    return;
  }
  if (!text && !fileUrl && !filePath) {
    showToast("请至少填写文本、附件 URL 或本地文件路径", "error");
    return;
  }
  const [botId, targetId] = selectedTargetId.includes("::")
    ? selectedTargetId.split("::")
    : ["", selectedTargetId];
  const response = await fetch("/api/chat/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botId, targetId, text, fileUrl, filePath, fileName }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "发送失败", "error");
    return;
  }
  byId("chatInput").value = "";
  byId("chatFileUrlInput").value = "";
  byId("chatFilePathInput").value = "";
  byId("chatFileNameInput").value = "";
  render(result);
  showToast("测试消息已发出");
}

async function testConnectivity() {
  const response = await fetch("/api/test/connectivity", { cache: "no-store" });
  const data = await response.json();
  byId("connectivityTestResult").innerHTML = (data.results || [])
    .map((item) => `<div class="box mb-2"><strong>${escapeHtml(item.label)}</strong><div class="small-muted mt-1">${escapeHtml(item.ok ? `${item.ms}ms` : item.error || `HTTP ${item.status}`)}</div></div>`)
    .join("");
}

async function handleCopyClick(button) {
  const targetId = button.dataset.copyTarget;
  const kind = button.dataset.copyKind;
  const target = byId(targetId);
  if (!target) return;
  const text = kind === "input" ? target.value : target.textContent;
  await copyText(text, button);
}

document.addEventListener("click", async (event) => {
  const copyButton = event.target.closest(".copy-btn");
  if (copyButton) {
    await handleCopyClick(copyButton);
  }
});

byId("botForm").addEventListener("submit", saveBot);
byId("botResetBtn").addEventListener("click", resetBotForm);
byId("configForm").addEventListener("submit", saveConfig);
byId("integrationForm").addEventListener("submit", saveIntegration);
byId("integrationResetBtn").addEventListener("click", resetIntegrationForm);
byId("userForm").addEventListener("submit", saveUser);
byId("userResetBtn").addEventListener("click", resetUserForm);
byId("notificationRuleForm").addEventListener("submit", saveNotificationRule);
byId("notificationRuleResetBtn").addEventListener("click", resetNotificationRuleForm);
byId("rulePresetList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-rule-preset]");
  if (!button) return;
  applyRulePreset(button.dataset.rulePreset);
});
byId("chatForm").addEventListener("submit", sendChat);
byId("connectivityTestBtn").addEventListener("click", testConnectivity);
byId("chatTargetSelect").addEventListener("change", (event) => {
  selectedTargetId = event.target.value;
  if (latestState) renderChatConversation(latestState);
});
document.querySelectorAll("[data-section-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setActiveSection(link.dataset.sectionLink || SECTION_IDS[0]);
  });
});
byId("integrationTypeInput").addEventListener("change", (event) => {
  if (!byId("integrationIdInput").value.trim()) {
    clearIntegrationInputValues();
  }
  applyAdapterPreset(event.target.value);
});
byId("userTargetSelect").addEventListener("change", (event) => {
  updateUserTargetHint();
});
byId("userCapabilitiesInput").addEventListener("change", () => {
  updateUserCapabilitiesHint();
});
byId("botList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-bot-action]");
  if (!button || !latestState) return;

  const item = (latestState.bots?.items || []).find((entry) => entry.botId === button.dataset.botId);
  if (!item) return;

  if (button.dataset.botAction === "edit") {
    fillBotForm(item);
    return;
  }

  if (button.dataset.botAction === "login") {
    const response = await fetch(`/api/bots/${encodeURIComponent(item.botId)}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name || item.botId,
        isDefaultSender: item.isDefaultSender === true,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "生成二维码失败", "error");
      return;
    }
    render(result);
    showToast(`机器人 ${item.botId} 的二维码已刷新`);
    return;
  }

  if (button.dataset.botAction === "default") {
    const response = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: item.botId,
        name: item.name || item.botId,
        enabled: item.enabled !== false,
        isDefaultSender: true,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "设置默认机器人失败", "error");
      return;
    }
    render(result);
    showToast(`已将 ${item.botId} 设为默认机器人`);
    return;
  }

  if (button.dataset.botAction === "delete") {
    if (!window.confirm(`确认删除机器人 ${item.botId} 吗？`)) return;
    const response = await fetch(`/api/bots/${encodeURIComponent(item.botId)}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "删除机器人失败", "error");
      return;
    }
    resetBotForm();
    render(result);
    showToast(`机器人 ${item.botId} 已删除`, "info");
  }
});
byId("integrationList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !latestState) return;

  const item = (latestState.integrations?.items || []).find((entry) => entry.id === button.dataset.id);
  if (!item) return;

  const base = getExternalBaseUrl(latestState);
  if (button.dataset.action === "edit") {
    fillIntegrationForm(item);
    return;
  }

  if (button.dataset.action === "copy-in") {
    await copyText(`${base}${item.inboundPath}?token=${encodeURIComponent(item.incomingToken || "")}`, button);
    return;
  }

  if (button.dataset.action === "copy-reply") {
    await copyText(`${base}${item.replyPath}?token=${encodeURIComponent(item.replyToken || "")}`, button);
    return;
  }

  if (button.dataset.action === "copy-out") {
    await copyText(item.outgoingUrl || "", button);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!window.confirm(`确认删除 ${item.name || item.alias} 吗？`)) return;
    const response = await fetch(`/api/integrations/${encodeURIComponent(item.id)}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "删除失败", "error");
      return;
    }
    resetIntegrationForm();
    render(result);
    showToast(`集成 ${item.name || item.alias} 已删除`, "info");
    return;
  }

  if (button.dataset.action === "test") {
    const [botId, targetId] = selectedTargetId.includes("::")
      ? selectedTargetId.split("::")
      : ["", selectedTargetId || ""];
    const response = await fetch(`/api/integrations/${encodeURIComponent(item.id)}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId, targetId }),
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "测试失败", "error");
      return;
    }
    showToast(`测试外发已发出，任务号: ${result.correlationId}`);
    if (result.state) render(result.state);
  }
});
byId("userList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-user-action]");
  if (!button || !latestState) return;

  const targetKey = button.dataset.targetKey || "";
  if (!targetKey) return;
  const item = getUserByTargetKey(latestState, targetKey);

  if (button.dataset.userAction === "toggle-edit") {
    if (openUserEditors.has(targetKey)) {
      openUserEditors.delete(targetKey);
    } else {
      openUserEditors.add(targetKey);
    }
    render(latestState);
    return;
  }

  if (!item) return;

  if (button.dataset.userAction === "delete") {
    if (!window.confirm(`确认删除这张卡的绑定吗？`)) return;
    let response;
    if ((item.bindings || []).length > 1) {
      response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: item.userId,
          name: item.name || item.userId,
          targetKeys: (item.bindings || [])
            .map((binding) => `${binding.botId}::${binding.targetId}`)
            .filter((bindingKey) => bindingKey !== targetKey),
          capabilities: item.capabilities || [],
          isDefaultRecipient: item.isDefaultRecipient === true,
        }),
      });
    } else {
      response = await fetch(`/api/users/${encodeURIComponent(item.userId)}`, {
        method: "DELETE",
      });
    }
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "删除失败", "error");
      return;
    }
    resetUserForm();
    openUserEditors.delete(targetKey);
    render(result);
    showToast(`已移除 ${item.userId} 的这张卡`, "info");
  }
});
byId("userList").addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-user-edit-form]");
  if (!form) return;
  event.preventDefault();

  const targetKey = form.dataset.userEditForm;
  const linkedUser = getUserByTargetKey(latestState, targetKey);
  const userId = linkedUser?.userId || form.querySelector('[data-user-field="userId"]')?.value?.trim() || "";
  if (!userId) {
    showToast("请先填写用户 ID", "error");
    return;
  }
  const existingTargetKeys = (form.dataset.existingTargetKeys || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const nextTargetKey =
    form.querySelector('[data-user-field="next-target"]')?.value?.trim() || targetKey;
  const targetKeys = Array.from(
    new Set([
      ...existingTargetKeys.filter((item) => item !== targetKey),
      nextTargetKey,
    ]),
  );
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      name: form.querySelector('[data-user-field="name"]')?.value?.trim() || userId,
      targetKeys,
      capabilities: getCheckedValues(form.querySelector('[data-user-field="capabilities"]')),
      isDefaultRecipient: form.querySelector('[data-user-field="default"]')?.checked === true,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || "保存家庭用户失败", "error");
    return;
  }
  openUserEditors.delete(targetKey);
  render(result);
  showToast(`卡片 ${userId} 已保存`);
});
byId("notificationRuleList").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-rule-action]");
  if (!button || !latestState) return;

  const item = (latestState.notificationRules?.items || []).find(
    (entry) => entry.id === button.dataset.ruleId,
  );
  if (!item) return;

  if (button.dataset.ruleAction === "edit") {
    fillNotificationRuleForm(item);
    return;
  }

  if (button.dataset.ruleAction === "delete") {
    if (!window.confirm(`确认删除通知规则 ${item.id} 吗？`)) return;
    const response = await fetch(
      `/api/notification-rules/${encodeURIComponent(item.id)}`,
      {
        method: "DELETE",
      },
    );
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || "删除通知规则失败", "error");
      return;
    }
    resetNotificationRuleForm();
    render(result);
    showToast(`通知规则 ${item.id} 已删除`, "info");
  }
});

ensureUiEnhancements();
resetBotForm();
resetIntegrationForm();
resetUserForm();
resetNotificationRuleForm();
setActiveSection(window.location.hash.replace(/^#/, "") || SECTION_IDS[0], false);

fetchState().catch((error) => {
  window.console.error(error);
});

setInterval(() => {
  if (openUserEditors.size > 0) {
    return;
  }
  fetchState().catch(() => {});
}, 3000);
