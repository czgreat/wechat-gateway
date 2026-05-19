# WeChat Gateway

[English](README.md) | [中文](README.zh-CN.md)

WeChat Gateway is a self-hosted Node.js message gateway for webhook-style automation and WeChat-compatible message flows. It provides an HTTP surface for receiving commands, managing local session state, and forwarding messages to optional downstream services.


## AI-assisted development

This public release was prepared with Codex using GPT-5.4 and GPT-5.5 assistance. The code, documentation, and release cleanup were reviewed for public sharing, but the project is community-maintained and is not an official OpenAI product.


## Features

- Express-based HTTP API
- QR-code assisted session flow
- Persistent local state directory
- Optional proxy support
- Optional downstream service integrations
- Static web assets for local operation
- Docker-friendly deployment

## Public Repository Scope

This public release excludes production `.env` files, cookies, session state, webhook secrets, internal network addresses, and private downstream API references. Configure your own values through `.env`.

## Quick Start

```bash
cp .env.example .env
npm install
npm start
```

Docker:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## Configuration

Important variables:

- `PORT`
- `PUBLIC_BASE_URL`
- `DATA_DIR`
- `OPENCLAW_STATE_DIR`
- `WEBHOOK_SECRET`
- optional proxy variables
- optional AI provider variables

## Security

Do not commit cookies, QR login state, webhook secrets, production `.env`, or private downstream service URLs.

## License

MIT

## More documentation

- [Deployment guide](docs/DEPLOYMENT.md)
- [AI handoff guide](docs/AI_HANDOFF.md)
- [Roadmap](docs/ROADMAP.md)

