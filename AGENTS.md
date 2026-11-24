# vite-plugin-iconify-bundle

## What this repo is

`@kirchdev/vite-plugin-iconify-bundle` is a **published Vite plugin**: it scans a source directory for quoted `prefix:name` icon literals, resolves them against the installed `@iconify-json/*` data at build time and serves them through the virtual module `virtual:iconify-bundle`, which registers them via `addCollection`. It was extracted from a working application, so a change to its behaviour is a change for existing users.

Two behaviours are deliberate. Both look like defects and have been proposed as bugs before — read `docs/99.adr/` before changing either:

- **The scan is a plain text search over all three string delimiters, not a parse**, so it reads icon names out of comments too (ADR-0001).
- **An unknown icon name fails the build.** `collectIconNames` stays exported and tested — keep that seam.

## Commands

`package.json` holds the scripts. The ones to know:

| Command               | What it does                                                 |
| :-------------------- | :----------------------------------------------------------- |
| `pnpm check`          | The gate: `lint` + `format` + `typecheck` + `test` + `check:policy` |
| `pnpm check:fix`      | Auto-fix lint + format                                       |
| `pnpm format`         | `oxfmt --check .` — the check, not the fix (`format:fix`)    |
| `pnpm examples:build` | Build the plugin, then every example against it              |
| `pnpm check:policy`   | Proves the two agent policy files ban the same commands      |

CI (`.github/workflows/ci.yml`) runs the steps of `pnpm check` on every PR into `main` or `dev`. **It does not run `examples:build`** — run it yourself when a change can affect the examples.

## Conventions

- **Node 24, pnpm 12** — pinned in `.nvmrc`, `engines` and `packageManager`. Don't loosen `minimumReleaseAge` or the isolated linker in `pnpm-workspace.yaml` without reason.
- **`src/index.ts` is the whole plugin, `src/index.spec.ts` the whole suite.** Built with `tsdown` to ESM only; `dist/` is gitignored.
- **`examples/*`** are private workspace packages consuming the root via `workspace:*` — keep that link, never pin a published version. They stay out of the root `tsconfig.json` (they import the built `dist/`). `vue` covers the default runtime and `.vue` scanning, `web-component` a non-default runtime without a framework; a third example needs a path neither covers.
- **oxc, not eslint/prettier**: `oxlint` and `oxfmt`, configured in `.oxlintrc.json` / `.oxfmtrc.json`. Hooks run `lint-staged` and `commitlint`; `README.md` and `AGENTS.md` are excluded from formatting.
- **Conventional Commits**, enforced by commitlint. Never `--no-verify` unless explicitly asked.
- **release-please owns the version** — never edit `version` or `CHANGELOG.md` by hand. `release-please.yml` publishes `latest` on a cut release and a prerelease on the `dev` dist-tag on every other push to `main` or `dev`, via npm Trusted Publishing (no `NPM_TOKEN`).
- **Workflows are thin callers** of `kirchDev/workflows`, pinned by SHA with a version comment; Dependabot bumps them. Change behaviour there, not here.

## AI & skills

- `.tituskirch-skills.json` configures the [TitusKirch skills](https://github.com/TitusKirch/skills); reconcile it with the `tituskirch-skills-config` skill. The skills are installed via the skills.sh CLI, not vendored; `pnpm skills:update` refreshes project-scoped ones.
- `.claude/settings.local.json` is per-machine and gitignored.

## Permission policy

`.claude/settings.json` and `.codex/rules/default.rules` carry the same policy — **change both together**; `pnpm check:policy` fails when they drift.

- **`deny` may be generous; `allow` must stay short.** Deny what a mistaken "yes" could not undo — the machine, remote state, work with no recovery path. Ordinary local development (`rm -rf node_modules`, `docker compose down -v`, deleting a remote branch) stays unlisted and prompts. `allow` holds only what recurs many times per session.
- **Never allow a rule that runs arbitrary code** (`tinker --execute`, a raw `pnpm dlx`, `find . *`, a SQL-executing MCP tool) — it hands back everything `deny` took away.
- **A structural difference between the two files must be declared** in `DELIBERATE` in `scripts/check-policy-parity.js` and in the `.codex/rules/default.rules` header; the check fails on an undeclared or stale one.
- **Neither language normalises flag order or case**: each spelling is its own rule. The check proves both files list the same spellings, not that the set is complete.
- Permissions cannot see a push's target branch — protect release branches with branch protection.

Check a Codex rule with `codex execpolicy check --pretty --rules .codex/rules/default.rules -- <command>`.

## Branching

Branch off `dev`, PR into `dev`; `promotion-pr.yml` keeps a draft `dev` → `main` PR open, and release-please releases from `main`. **Merge the promotion PR with a merge commit, never a squash** — a squash collapses the `feat:`/`fix:` commits into one `chore:` and release-please cuts nothing.

Going main-only: remove `promotion-pr.yml`, drop both `target-branch: 'dev'` lines in `.github/dependabot.yml`, and point `pr.base`, `release.stages` and `work.branch` in `.tituskirch-skills.json` at `main`. Leave the `dev` entries in `ci.yml` and `codeql.yml`.

## Public repo

CodeQL runs, the MIT `LICENSE` and README footer stay, and `.github/ISSUE_TEMPLATE/config.yml` sends questions, ideas and possible bugs to Discord; confirmed bugs and features use the issue forms.

## README house style

Follow the `write-readme` skill: hero in `<div align="center">`, its section emojis, GitHub callouts instead of plain blockquotes, and the footer `[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)`.

## Names

- **`virtual:iconify-bundle` is published — changing it is a breaking change. Don't change it unilaterally; raise it.** It derives from the repo name and gains no scope.
- **The package is scoped, the repo is not**: the bare `vite-plugin-iconify-bundle` on npm belongs to an unrelated maintainer. Use `@kirchdev/vite-plugin-iconify-bundle` wherever a consumer types it (install, import, `dependencies`, `/// <reference types>`); the bare name where the project is meant.

## `client.d.ts`

It carries the **ambient** `declare module 'virtual:iconify-bundle';` without which a consumer's side-effect import fails with TS2882. **Keep it free of any top-level `import` or `export`** — either turns the declaration into an augmentation, which cannot resolve a module that has no file.

## Scope

- **Keep the surface small.** A new option needs a reason beyond "an app might want it".
- A Nuxt wrapper would be a second package from this repo (`nuxt-iconify-bundle`) serving the same virtual module, not a rename.
- For meta-layer questions, check `TitusKirch/forgemap`; pull fixes from `TitusKirch/scaffold` rather than reinventing them.
