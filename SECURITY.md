# Security Policy

## Scope

`@kirchdev/vite-plugin-iconify-bundle` is a **build-time Vite plugin**. It runs on a developer's or a CI runner's machine: it reads source files under the configured `sourceDir`, reads icon data from the locally installed `@iconify-json/*` packages, and emits a virtual module into the bundle. It has no runtime component and makes no network requests.

The supported version is always the **latest release**. There are no maintained release branches to back-port fixes to; upgrade to the current version.

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security problems.**

In the context of this plugin, a "vulnerability" typically means:

- Source content reaching the emitted module unescaped, so a scanned file can inject code into the bundle.
- A path handling flaw that lets the scan read outside the configured `sourceDir`.
- A dependency in `package.json` that introduces a known CVE.

Use one of the following private channels:

1. **GitHub Private Vulnerability Reporting** (preferred): open a private advisory at <https://github.com/kirchDev/vite-plugin-iconify-bundle/security/advisories/new>.
2. **Email**: [titus.kirch@kirch.dev](mailto:titus.kirch@kirch.dev). PGP available on request.

Please include:

- A description of the vulnerability and its impact on consuming projects.
- Steps to reproduce.
- Any suggested fix, if you have one.

### What to expect

| Stage                        | Target timeline                                   |
| :--------------------------- | :------------------------------------------------ |
| Acknowledgement of report    | within **3 business days**                        |
| Initial assessment & triage  | within **7 business days**                        |
| Patch released (if accepted) | depends on severity — critical issues prioritised |
| Public disclosure & advisory | coordinated with reporter after the patch ships   |

## Credit

Reporters who follow this process responsibly are credited in the [CHANGELOG](CHANGELOG.md) and the corresponding GitHub Security Advisory, unless they prefer to remain anonymous.

---

Maintained by [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev).
