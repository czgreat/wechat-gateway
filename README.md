# WeChat Gateway

[![CI](https://github.com/czgreat/wechat-gateway/actions/workflows/ci.yml/badge.svg)](https://github.com/czgreat/wechat-gateway/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Language:** English | [中文](README.zh-CN.md)

Self-hosted Node.js message gateway for webhook automation and WeChat-compatible message flows.

## Overview

WeChat Gateway provides an Express HTTP surface, local static UI, QR-assisted session flow, persistent state storage, and optional downstream integrations.

## Key Features

- Express-based HTTP API and static UI
- QR-code assisted login/session flow
- Persistent local state directory
- Bot, user, notification rule, and integration management APIs
- Webhook-protected push/reply routes

## Who This Is For

- Developers building private webhook/message automation
- Self-hosters who need a local gateway with explicit state storage
- Teams prototyping downstream integration flows

## Not For

- Public deployment without stronger auth
- Committing cookies, sessions, or private downstream URLs
- Using automation without checking platform terms

## Current Public Release

Ready to use:

- Run locally with npm
- Run in Docker on port 8080
- Use the health route and local UI
- Configure your own downstream integrations through environment and UI/API settings

You must provide locally:

- Your own webhook secret
- Private state directory outside version control
- Allowed proxy settings if needed
- Your own optional AI provider endpoint/key
- A review of platform terms before using automation features

## Quick Start

```bash
cp .env.example .env
npm install
npm start
```

For Python projects on Windows, activate the virtual environment with `.venv\Scripts\Activate.ps1` instead of `. .venv/bin/activate`.

## Docker Deployment

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
curl http://localhost:8080/health
```

## Manual Deployment

- Install Node.js 22 or a compatible modern LTS runtime.
- Run `npm install`.
- Copy `.env.example` to `.env` and replace secrets.
- Run `npm start` and open the local UI.

## Configuration

- `PORT`, `PUBLIC_BASE_URL`: service binding and public URL
- `DATA_DIR`, `OPENCLAW_STATE_DIR`: private state directories
- `WEBHOOK_SECRET`: replace before accepting webhook calls
- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`: optional proxy settings
- `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_MODEL`: optional AI integration

## API Surface

- `GET /health` for health checks
- `GET /api/state` for current state
- `POST /api/wechat/login` for login flow
- `POST /api/chat/send` to send messages
- `POST /api/push` for webhook-protected pushes

## Validation

```bash
node --check server.js
npm start
```

## Repository Layout

| Path | Purpose |
|---|---|
| `server.js` | Express server, gateway logic, and API routes |
| `public/` | Local browser UI assets |
| `docker-entrypoint.sh` | Container startup helper |
| `.env.example` | Public-safe environment template |
| `docker-compose.example.yml` | Container deployment example |

## Documentation

| Topic | English | Chinese |
|---|---|---|
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md) |
| Usage/API examples | [docs/USAGE_EXAMPLES.md](docs/USAGE_EXAMPLES.md) | [docs/USAGE_EXAMPLES.zh-CN.md](docs/USAGE_EXAMPLES.zh-CN.md) |
| Screenshots | [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md) | [docs/SCREENSHOTS.zh-CN.md](docs/SCREENSHOTS.zh-CN.md) |
| AI handoff | [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) | [docs/AI_HANDOFF.zh-CN.md](docs/AI_HANDOFF.zh-CN.md) |
| Roadmap | [docs/ROADMAP.md](docs/ROADMAP.md) | [docs/ROADMAP.zh-CN.md](docs/ROADMAP.zh-CN.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) | [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md) |

## AI-Assisted Development

This public release was prepared with Codex using GPT-5.4 and GPT-5.5 assistance. The source code, docs, and public-release cleanup were reviewed for public sharing, but this is a community project and not an official OpenAI product.

Good next tasks for an AI coding assistant:

- Split the large server into route/service modules
- Add API request/response examples
- Add integration tests with mocked downstream services
- Add admin UI safeguards for secret handling

## Privacy and Secrets

Do not commit real `.env` files, API keys, webhook secrets, cookies, private media, production databases, logs, generated artifacts, or personal data. Start from the example config files and keep private values outside Git.

## License

MIT
