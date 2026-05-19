# WeChat Gateway / 微信消息网关

[![CI](https://github.com/czgreat/wechat-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/czgreat/wechat-gateway/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**语言：** [English](README.md) | 中文

自托管 Node.js 消息网关，用于 webhook 自动化和微信兼容消息流。

## 概览

WeChat Gateway 提供 Express HTTP 接口、本地静态 UI、二维码辅助登录流程、持久化状态存储和可选下游集成。

## 主要功能

- 基于 Express 的 HTTP API 和静态 UI
- 二维码辅助登录/会话流程
- 本地持久化状态目录
- bot、用户、通知规则和集成管理 API
- 受 webhook secret 保护的 push/reply 路由

## 适合谁

- 构建私有 webhook/消息自动化的开发者
- 需要本地网关和显式状态存储的自托管用户
- 原型验证下游集成流程的小团队

## 不适合

- 未强化鉴权的公开部署
- 提交 cookies、会话或私有下游 URL
- 未确认平台条款就使用自动化能力

## 当前公开版状态

已经可以使用：

- 可用 npm 本地运行
- 可用 Docker 在 8080 端口运行
- 可使用健康检查路由和本地 UI
- 可通过环境变量和 UI/API 配置自己的下游集成

需要你在本地补全：

- 自己的 webhook secret
- 不纳入版本控制的私有状态目录
- 如需要，配置允许使用的代理
- 可选的自有 AI provider endpoint/key
- 使用自动化能力前先确认平台条款

## 快速开始

```bash
cp .env.example .env
npm install
npm start
```

如果在 Windows PowerShell 使用 Python 虚拟环境，请用 `.venv\Scripts\Activate.ps1`，不要用 `. .venv/bin/activate`。

## Docker 部署

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
curl http://localhost:8080/health
```

## 手工部署

- 安装 Node.js 22 或兼容的现代 LTS 版本。
- 执行 `npm install`。
- 复制 `.env.example` 为 `.env` 并替换密钥。
- 执行 `npm start` 并打开本地 UI。

## 配置说明

- `PORT`、`PUBLIC_BASE_URL`：服务绑定和公开地址
- `DATA_DIR`、`OPENCLAW_STATE_DIR`：私有状态目录
- `WEBHOOK_SECRET`：接受 webhook 前必须替换
- `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`：可选代理配置
- `AI_PROVIDER_BASE_URL`、`AI_PROVIDER_API_KEY`、`AI_MODEL`：可选 AI 集成

## API 概览

- `GET /health` 健康检查
- `GET /api/state` 当前状态
- `POST /api/wechat/login` 登录流程
- `POST /api/chat/send` 发送消息
- `POST /api/push` 受 webhook secret 保护的推送

## 验证命令

```bash
node --check server.js
npm start
```

## 仓库结构

| 路径 | 说明 |
|---|---|
| `server.js` | Express 服务、网关逻辑和 API 路由 |
| `public/` | 本地浏览器 UI 资源 |
| `docker-entrypoint.sh` | 容器启动辅助脚本 |
| `.env.example` | 可公开的环境变量模板 |
| `docker-compose.example.yml` | 容器部署示例 |

## 更多文档

| 主题 | 中文 | English |
|---|---|---|
| 部署 | [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| 使用/API 示例 | [docs/USAGE_EXAMPLES.zh-CN.md](docs/USAGE_EXAMPLES.zh-CN.md) | [docs/USAGE_EXAMPLES.md](docs/USAGE_EXAMPLES.md) |
| 截图 | [docs/SCREENSHOTS.zh-CN.md](docs/SCREENSHOTS.zh-CN.md) | [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md) |
| AI 接手 | [docs/AI_HANDOFF.zh-CN.md](docs/AI_HANDOFF.zh-CN.md) | [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) |
| 路线图 | [docs/ROADMAP.zh-CN.md](docs/ROADMAP.zh-CN.md) | [docs/ROADMAP.md](docs/ROADMAP.md) |
| 更新日志 | [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) | [CHANGELOG.md](CHANGELOG.md) |

## AI 辅助开发说明

这个公开版由 Codex 使用 GPT-5.4 和 GPT-5.5 辅助整理完成。源码、文档和公开前清理都经过面向公开分享的复核，但本项目是社区项目，不是 OpenAI 官方产品。

适合继续交给 AI coding assistant 的任务：

- 把大型 server 拆分为 route/service 模块
- 补充 API 请求/响应示例
- 增加 mocked 下游服务的集成测试
- 为管理 UI 增加密钥处理保护

## 隐私和密钥

不要提交真实 `.env`、API key、webhook secret、cookies、私人媒体、生产数据库、日志、生成产物或个人数据。请从示例配置开始，把私有值保存在 Git 之外。

## License

MIT
