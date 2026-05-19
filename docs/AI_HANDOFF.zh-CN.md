# AI 接手说明

**语言：** [English](AI_HANDOFF.md) | 中文

把 `wechat-gateway` 交给 AI coding assistant 时，可以先让它阅读本文。这里提供足够上下文，让 AI 不依赖私有部署历史也能继续改。

## 前 15 分钟

1. 先读 `README.zh-CN.md`、本文和 `docs/DEPLOYMENT.zh-CN.md`。
2. 查看 `README.zh-CN.md` 里的仓库结构表。
3. 大改前先跑验证命令。
4. 明确任务属于文档、测试、本地部署还是产品代码。
5. 所有私有凭据、状态、媒体和生产数据都留在仓库外。

## 项目概要

WeChat Gateway 提供 Express HTTP 接口、本地静态 UI、二维码辅助登录流程、持久化状态存储和可选下游集成。

## 重要路径

| 路径 | 说明 |
|---|---|
| `server.js` | Express 服务、网关逻辑和 API 路由 |
| `public/` | 本地浏览器 UI 资源 |
| `docker-entrypoint.sh` | 容器启动辅助脚本 |
| `.env.example` | 可公开的环境变量模板 |
| `docker-compose.example.yml` | 容器部署示例 |

## 适合 AI 先做的任务

- 把大型 server 拆分为 route/service 模块
- 补充 API 请求/响应示例
- 增加 mocked 下游服务的集成测试
- 为管理 UI 增加密钥处理保护

## 开新 AI 会话时建议提供的上下文

- 仓库 URL 和分支。
- 操作系统和运行时版本。
- 失败的完整命令，或希望改进的具体工作流。
- 已去敏的日志。
- 当前使用本地开发、Docker 还是手工部署。
- 隐私、公开分享或支持平台方面的限制。

## 建议提示词

```text
你正在 wechat-gateway 仓库工作。先阅读 README.zh-CN.md、docs/DEPLOYMENT.zh-CN.md 和 docs/AI_HANDOFF.zh-CN.md。保持改动聚焦，保留可公开的示例，不要加入真实密钥，完成后运行文档中的验证命令并总结结果。
```

## 约束

- 不要加入真实 `.env`、API key、cookies、webhook secret、本地 IP、生产 URL、个人记录或生成产物。
- 优先补聚焦测试，避免无必要的大重构。
- 公开示例要保持通用，能在干净机器上启动。
- 修改面向用户的说明时，中英文文档要同步更新。
- 如果部署行为变化，必须同时更新 `docs/DEPLOYMENT.md` 和 `docs/DEPLOYMENT.zh-CN.md`。

## 完成标准

- 请求的行为或文档改动已经完成。
- 验证命令通过；如果跳过检查，要明确说明原因。
- README 链接仍然有效。
- 没有提交私有数据或生成产物。
