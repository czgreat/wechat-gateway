# Deployment Guide

**Language:** English | [中文](DEPLOYMENT.zh-CN.md)

This guide explains how to run `wechat-gateway` locally, in Docker, or with a manual service setup. It assumes you cloned the GitHub repository and are working from the repository root.

## What Is Already Usable

- Run locally with npm
- Run in Docker on port 8080
- Use the health route and local UI
- Configure your own downstream integrations through environment and UI/API settings

## What You Must Provide

- Your own webhook secret
- Private state directory outside version control
- Allowed proxy settings if needed
- Your own optional AI provider endpoint/key
- A review of platform terms before using automation features

## Local Development

```bash
cp .env.example .env
npm install
npm start
```

If the command uses `. .venv/bin/activate`, use `.venv\Scripts\Activate.ps1` on Windows PowerShell.

## Docker Deployment

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
curl http://localhost:8080/health
```

Before running Docker, review every bind mount and every value in `.env`. Example compose files are intentionally generic and should be adjusted to your host paths and ports.

## Manual Deployment

- Install Node.js 22 or a compatible modern LTS runtime.
- Run `npm install`.
- Copy `.env.example` to `.env` and replace secrets.
- Run `npm start` and open the local UI.

## Configuration Checklist

- `PORT`, `PUBLIC_BASE_URL`: service binding and public URL
- `DATA_DIR`, `OPENCLAW_STATE_DIR`: private state directories
- `WEBHOOK_SECRET`: replace before accepting webhook calls
- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`: optional proxy settings
- `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, `AI_MODEL`: optional AI integration

## Validation Checks

```bash
node --check server.js
npm start
```

## Production Checklist

- Replace all placeholder secrets before real use.
- Keep private config, generated data, logs, uploaded media, and generated artifacts outside Git.
- Put the service behind a reverse proxy with HTTPS if it is reachable from other devices.
- Add authentication before exposing private APIs beyond localhost.
- Configure backups for any database, state directory, uploaded files, and generated artifacts.
- Read `SECURITY.md` before reporting or triaging security issues.

## Troubleshooting

- Re-check `.env` and volume paths first; most deployment failures are path or permission issues.
- Use the health endpoint listed in `README.md` to separate process startup issues from application behavior.
- Run the validation commands before changing deployment infrastructure.
- When asking an AI assistant for help, include OS, runtime versions, exact command, sanitized logs, and deployment mode.
