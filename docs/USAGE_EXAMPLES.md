# Usage and API Examples

**Language:** English | [中文](USAGE_EXAMPLES.zh-CN.md)

These examples use public-safe placeholder data. Replace URLs, tokens, paths, and settings before running them in your own environment, and make sure you are allowed to process the target data.

## Example 1: Local gateway startup

Start the service, open the local UI, and verify health/state before adding integrations.

## Example 2: Webhook push

Use a configured secret and a non-private demo payload when testing webhook-protected routes.

## curl Examples

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/state
curl -X POST http://localhost:8080/api/push \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <your-webhook-secret>" \
  -d '{"targetId":"demo-target","text":"public demo message"}'
```

Request bodies can change between versions; use local `/docs` or the source model definitions as the final reference.


## Local Validation Tips

- Start from `README.md` and bring the service up first.
- Call the health endpoint before running operations that write state or send notifications.
- Use synthetic or public demo data; do not paste private data into issues, screenshots, or commits.
- When using an AI assistant, provide this file, the deployment guide, and sanitized logs.
