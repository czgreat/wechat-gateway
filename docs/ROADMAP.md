# Roadmap

**Language:** English | [中文](ROADMAP.zh-CN.md)

This roadmap describes the public repository state for `wechat-gateway`. It separates what is ready to use from what each user should complete in their own environment.

## Complete Enough To Use

- Local gateway server
- Session/state storage pattern
- Configuration and integration APIs
- Docker deployment example

## Needs Local Completion

- Harden auth before shared or public deployment
- Add encrypted state storage if required
- Add integration-specific adapters outside the public repo
- Add operational backup/restore notes for state files

## Suggested Improvements

- Split the large server into route/service modules
- Add API request/response examples
- Add integration tests with mocked downstream services
- Add admin UI safeguards for secret handling

## Documentation Still Worth Adding

- Screenshots or short screen recordings using non-private demo data.
- A fuller API example page for common requests and responses.
- Backup and restore notes for any persistent data path.
- A troubleshooting page based on real public issues once users start deploying it.

## Maintenance Notes

- Keep public examples generic.
- Keep English and Chinese instructions aligned.
- Prefer small issues and pull requests so AI-assisted contributors can work safely.
- Re-run sensitive-data scans before publishing new releases.
