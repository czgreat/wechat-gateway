# 部署说明

**语言：** [English](DEPLOYMENT.md) | 中文

本文说明如何在本地、Docker 或手工服务模式下运行 `wechat-gateway`。默认你已经 clone 了 GitHub 仓库，并在仓库根目录操作。

## 已经可以使用

- 可用 npm 本地运行
- 可用 Docker 在 8080 端口运行
- 可使用健康检查路由和本地 UI
- 可通过环境变量和 UI/API 配置自己的下游集成

## 你需要自己提供

- 自己的 webhook secret
- 不纳入版本控制的私有状态目录
- 如需要，配置允许使用的代理
- 可选的自有 AI provider endpoint/key
- 使用自动化能力前先确认平台条款

## 本地开发

```bash
cp .env.example .env
npm install
npm start
```

如果命令里出现 `. .venv/bin/activate`，Windows PowerShell 下请改用 `.venv\Scripts\Activate.ps1`。

## Docker 部署

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
curl http://localhost:8080/health
```

运行 Docker 前，请先检查所有 volume 映射和 `.env`。示例 compose 文件只提供通用起点，需要按你的主机路径和端口修改。

## 手工部署

- 安装 Node.js 22 或兼容的现代 LTS 版本。
- 执行 `npm install`。
- 复制 `.env.example` 为 `.env` 并替换密钥。
- 执行 `npm start` 并打开本地 UI。

## 配置检查清单

- `PORT`、`PUBLIC_BASE_URL`：服务绑定和公开地址
- `DATA_DIR`、`OPENCLAW_STATE_DIR`：私有状态目录
- `WEBHOOK_SECRET`：接受 webhook 前必须替换
- `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`：可选代理配置
- `AI_PROVIDER_BASE_URL`、`AI_PROVIDER_API_KEY`、`AI_MODEL`：可选 AI 集成

## 验证命令

```bash
node --check server.js
npm start
```

## 生产检查清单

- 真实使用前替换所有占位密钥。
- 私有配置、生成数据、日志、上传文件和产物不要放进 Git。
- 如果服务会被其他设备访问，请放到启用 HTTPS 的反向代理后面。
- 私有 API 暴露到 localhost 以外前，请先增加鉴权。
- 为数据库、状态目录、上传文件和生成产物配置备份。
- 处理安全问题前先阅读 `SECURITY.md`。

## 排障建议

- 先复查 `.env` 和 volume 路径；多数部署问题来自路径或权限。
- 用 `README.md` 里列出的健康检查接口区分进程启动问题和业务问题。
- 修改部署基础设施前，先跑验证命令。
- 让 AI assistant 帮忙时，提供操作系统、运行时版本、完整命令、去敏日志和部署模式。
