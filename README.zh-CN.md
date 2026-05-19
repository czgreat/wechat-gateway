# WeChat Gateway / 微信消息网关

[English](README.md) | [中文](README.zh-CN.md)

WeChat Gateway 是一个自托管 Node.js 消息网关，用于 webhook 风格自动化和微信兼容消息流程。它提供 HTTP 接口，用于接收命令、管理本地会话状态，并可选转发到下游服务。


## AI 辅助开发说明

这个公开版由 Codex 在 GPT-5.4 / GPT-5.5 辅助下整理完成。代码、文档和公开前清理已按公开仓库标准处理，但本项目不是 OpenAI 官方产品。


## 功能

- 基于 Express 的 HTTP API
- 二维码辅助会话流程
- 本地持久化状态目录
- 可选代理支持
- 可选下游服务集成
- 本地操作用静态页面
- Docker 部署支持

## 公开版范围

这个公开版不包含生产 `.env`、cookies、会话状态、webhook secret、内网地址或私有下游 API 参考。请通过 `.env` 配置你自己的值。

## 快速开始

```bash
cp .env.example .env
npm install
npm start
```

Docker：

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## 配置

核心变量：

- `PORT`
- `PUBLIC_BASE_URL`
- `DATA_DIR`
- `OPENCLAW_STATE_DIR`
- `WEBHOOK_SECRET`
- 可选代理变量
- 可选 AI provider 变量

## 安全说明

不要提交 cookies、二维码登录状态、webhook secret、生产 `.env` 或私有下游服务地址。

## License

MIT

