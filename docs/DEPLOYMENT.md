# Deployment Guide

Node.js message gateway for webhook-style automation and WeChat-compatible message flows.

## What is already usable

- Express server and static operation page are included
- Docker example is included
- Session state directory is configurable
- Optional AI provider variables are represented as examples

## What you must provide

- Your own login/session flow setup
- Webhook secret
- Persistent data directory
- Any downstream services you want to integrate
- Careful handling of cookies and session state outside Git

## Local development

```bash
cp .env.example .env
npm install
npm start
```

## Validation checks

```bash
node --check server.js
```

## Docker deployment

```bash
cp .env.example .env
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## Manual deployment

Install Node.js, keep `.env` private, point `DATA_DIR` to persistent storage, and run `npm start` behind a reverse proxy if exposing it outside localhost.

## Production checklist

- Keep `.env` private and never commit it.
- Replace all placeholder secrets before exposing the service.
- Mount runtime data outside the repository.
- Put the service behind HTTPS if it is reachable from other machines.
- Back up persistent data before upgrades.
- Review logs after the first startup.

