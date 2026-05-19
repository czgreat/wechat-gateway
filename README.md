# WeChat Gateway

A self-hosted Node.js message gateway that bridges webhook-style automation with WeChat-compatible message flows and optional downstream services.

## Features

- Express-based HTTP API
- QR-code assisted session flow
- Persistent local state directory
- Optional proxy support
- Optional downstream service integrations
- Docker-friendly deployment

## Public Repository Scope

This public version excludes production `.env` files, private webhook URLs, cookies, session state, and internal network settings. Configure your own values through `.env`.

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
