# Roadmap

This public release is a cleaned, source-focused baseline. It is intended to be usable by developers, but each deployment still needs local configuration.

## Complete enough to use

- Express server and static operation page are included
- Docker example is included
- Session state directory is configurable
- Optional AI provider variables are represented as examples

## Needs local completion

- Your own login/session flow setup
- Webhook secret
- Persistent data directory
- Any downstream services you want to integrate
- Careful handling of cookies and session state outside Git

## Suggested improvements

- Adapt webhook routes for a specific bot workflow
- Add auth middleware for a public deployment
- Write a deployment guide for a chosen VPS/NAS
- Add integration tests around webhook payloads

## Documentation still worth adding

- Real screenshots or short demo videos.
- A known-good production deployment example for a generic Linux host.
- Troubleshooting notes collected from real user deployments.

