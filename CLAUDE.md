# CLAUDE.md

This file provides guidance to AI coding agents — Claude Code (claude.ai/code) and vendor-neutral tools such as Codex, OpenCode, Cursor, and Copilot — when working with code in this repository.

## Agent instruction files

`CLAUDE.md` and `AGENTS.md` are kept **byte-identical**. `CLAUDE.md` is what Claude Code reads; `AGENTS.md` is what vendor-neutral agent tools read — Codex, OpenCode, Cursor, Copilot, and whatever follows them. Two real files, deliberately not a symlink: not every tool resolves one.

**After editing either file, copy it over the other — don't repeat the edit by hand:**

```bash
cp CLAUDE.md AGENTS.md   # or the reverse, whichever you just edited
```

Retyping a change is exactly how the two drift; one reflowed line or reworded clause is enough. `diff CLAUDE.md AGENTS.md` must print nothing. If it ever does, treat it as a defect and fix it by letting one file win wholesale — never by merging them.

## What this repo is

`@kirchdev/vite-plugin-iconify-bundle` is a **published Vite plugin**: it scans a source directory for quoted `prefix:name` icon literals, resolves each one against the locally installed `@iconify-json/*` data at build time, and serves them through the virtual module `virtual:iconify-bundle`, which registers them via `addCollection`. The bundle then carries exactly the icons the source names — offline, deterministic, inline under SSR, no runtime Iconify API call.

The plugin was **extracted from a working application, not designed here**. Its behaviour was the specification for this repo, which means a change to it is a change to something that already had users — not a greenfield decision.

Two behaviours are deliberate and must survive the move:

- **The scan is a plain text search over all three string delimiters, not a parse** — so it reads icon names out of comments too. `docs/99.adr/0001-*` records the trade: a name written into prose sends the build looking for an icon that does not exist, and that loud failure is preferred to a silently missing icon.
- **An unknown icon name fails the build.** The scan is the definition of *used*, and the build turns on it. `collectIconNames` is therefore exported and tested rather than left as a closure inside the factory — keep that seam.

Read `docs/99.adr/` before changing either. Both look like defects until the reasoning is in front of you, and both have been proposed as bugs before.

## Commands

| Command             | What it does                                               |
| :------------------ | :--------------------------------------------------------- |
| `pnpm install`      | Install deps and wire husky hooks via the `prepare` script |
| `pnpm lint`         | `oxlint . --deny-warnings`                                 |
| `pnpm format`       | `oxfmt --check .` (note: `format` is the check, not fix)   |
| `pnpm build`        | `tsdown` — bundles `src/` into `dist/`                      |
| `pnpm test`         | `vitest run`                                               |
| `pnpm examples:build`| Build the plugin, then every example against it           |
| `pnpm typecheck`    | `tsc --noEmit`                                             |
| `pnpm check`        | `lint` + `format` + `typecheck` + `test` + `check:policy`   |
| `pnpm check:policy` | Proves the two agent policy files ban the same commands    |
| `pnpm lint:fix`     | Auto-fix lint                                              |
| `pnpm format:fix`   | Auto-fix format                                            |
| `pnpm check:fix`    | Auto-fix lint + format                                     |
| `pnpm skills:update`| Update project-scoped agent skills via the skills.sh CLI   |
| `pnpm taze`         | Interactive dependency upgrade check                       |
| `pnpm taze:w`       | Write upgrade results                                      |

CI runs the same five steps as `pnpm check`, plus `pnpm examples:build`, on PR.

## Architecture / conventions

- **Node 24, pnpm 11.** Pinned via `.nvmrc`, `engines`, and `packageManager`. `pnpm-workspace.yaml` enforces `minimumReleaseAge=4320` (3-day cooldown), isolated node-linker. Don't loosen these without reason.
- **`examples/*` are private workspace packages** consuming the root via `workspace:*`. That link is the point: an example pinned to a published version keeps building after a change here breaks it. They are not in the root `tsconfig.json` — an example imports the built `dist/`, so adding it would make `typecheck` depend on `build`. `examples:build` is the check that covers them, and it builds the plugin first for the same reason. The two are deliberately different: `vue` exercises the default runtime and `.vue` scanning, `web-component` a non-default runtime and no framework. A third earns its place only by covering a path neither does.
- **`src/index.ts` is the whole plugin**, `src/index.spec.ts` the whole suite. `client.d.ts` sits at the package root because a consumer reaches it as `@kirchdev/vite-plugin-iconify-bundle/client`, mirroring `vite/client`. Built with `tsdown` to ESM only (`dist/index.mjs`); `dist/` is gitignored and rebuilt by `prepublishOnly`.
- **oxc, not eslint/prettier.** Linting via `oxlint`, formatting via `oxfmt`. Configs live in `.oxlintrc.json` / `.oxfmtrc.json`. `oxlint` uses `unicorn` + `oxc` plugins; rules deliberately minimal.
- **Husky hooks** (`.husky/pre-commit`, `.husky/commit-msg`) run `lint-staged` and `commitlint`. `lint-staged.config.js` excludes `README.md`, `CLAUDE.md`, and `AGENTS.md` (free-form prose) and `pnpm-lock.yaml`. `oxlint --fix --deny-warnings` then `oxfmt` on JS; `oxfmt` only on JSON/YAML/MD.
- **Conventional Commits enforced** via `@commitlint/config-conventional`. Don't `--no-verify` unless explicitly asked.
- **release-please owns the version.** Files: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release-please.yml`. Config uses `release-type: node`, so the release PR bumps `package.json` itself — never edit `version` by hand. `include-v-in-tag: true`. `initial-version` pins the first release to `0.1.0` — the `0.0.0` manifest entry means "never released", and release-please would otherwise fall back to its own default of `1.0.0`. The repo starts at `0.0.0` with an empty `CHANGELOG.md`; the first conventional commit on `main` opens the initial release PR.
- **`publish.yml` publishes, release-please does not.** It fires on `release: published`, re-runs `pnpm check` against the tag, and publishes with npm Trusted Publishing (OIDC) — no `NPM_TOKEN` exists in this repo. The trusted publisher is configured on the npm package, so the very first publish has to happen by hand before this workflow can work.
- **Workflows** use `actions/checkout@v6`, `actions/setup-node@v6`, `pnpm/action-setup@v6`, `github/codeql-action/{init,analyze}@v4`. Keep these pinned to major versions; Dependabot bumps them monthly.
- **CodeQL** scans `actions` + `javascript-typescript` with `security-extended,security-and-quality` queries, gated by path filters so non-code changes don't trigger it.
- **Dependabot** groups all minor/patch updates per ecosystem into a single PR (`npm-minor-patch`, `actions-minor-patch`). Majors come as separate PRs.

## AI & skills

- **`.claude/settings.json`** ships a baseline permission policy — see _Permission policy_ below for the rules it follows. `.claude/settings.local.json` (per-machine overrides, typically `enabledMcpjsonServers`) is gitignored.
- **`.tituskirch-skills.json`** configures the [TitusKirch skills](https://github.com/TitusKirch/skills) (commit, PR, issue, release, docs …) per repo. It is the runtime **config**, not an installer. Regenerate/reconcile it with the `tituskirch-skills-config` skill.
- **Installing the skills.** The bundle is installed via the skills.sh CLI (`pnpm dlx skills add TitusKirch/skills`), not vendored into the repo. `pnpm skills:update` refreshes project-scoped skills tracked in `skills-lock.json` (only present once a repo actually installs project skills).

## Permission policy

`.claude/settings.json` is deliberately lopsided: a **long `deny` list and a short `allow` list**. The two sides answer different questions, so they follow opposite rules.

**`deny` may be generous.** A rule for a command the repo doesn't have is a no-op, it never needs maintenance, and it is never reviewed — a too-broad block only surfaces when you actually hit it. So the list covers every stack kirchDev repos might grow into (Laravel, Prisma, Terraform/OpenTofu, AWS), not just this one. `git reflog expire` and `git gc --prune=now` are in there because they destroy the rescue path that survives a `reset --hard`.

The line to draw is **the machine or something remote, not the working copy**. Blocked: anything that wrecks the OS (`dd`, `mkfs`, `chmod -R`, `rm -rf /…`), tears down remote state or resources (`terraform destroy`, `state rm`, `aws ec2 terminate-instances`, `gh repo delete`), or throws away work with no recovery path (force-push, `reset --hard`, `stash drop`). Deliberately *not* blocked, because they are ordinary local development: `rm -rf node_modules`, `docker volume rm`, `docker compose down -v`, `docker system prune`, `php artisan tinker`, deleting a remote branch. Those prompt instead — a command that is sometimes wanted belongs in the middle state, never in `deny`.

**`allow` must stay short.** Its only return is fewer prompts — no safety is gained. Every line has to be read and understood by whoever copies this file, and an unreviewed allow list is more dangerous than none. Keep what occurs many times per session (read-only git, `ls`/`grep`/`rg`, the project's own check scripts) and let everything else ask.

**Three states, not two.** A command in `allow` runs unasked; one in `deny` is impossible and has to be typed by hand; one in **neither list prompts you** — and that middle state is the right default for almost everything. Reserve `deny` for what a mistaken "yes" could not undo. A normal `git push` is not that: it is reversible, visible and the ordinary way work ships, so it sits in `allow`.

> [!IMPORTANT]
> **Never allow a rule that runs arbitrary code.** `php artisan tinker --execute`, `pnpm exec turbo run`, `find . *` (which covers `-delete` and `-exec rm`), a raw `pnpm dlx`, or an MCP tool that executes SQL (`database-query`, `run-query`) each hand back everything the `deny` list took away — a blocked `db:wipe` means nothing next to an allowed `tinker --execute 'DB::statement(...)'`. A deny list is only as strong as the weakest allow rule beside it.

Two things this file cannot do, by design: it cannot tell which branch a `git push` targets (protect release branches with **branch protection**, not permissions), and prefix rules miss flags placed before the subcommand (`docker compose -f x.yml down -v`). Treat it as lowering the odds, not as a guarantee.

Downstream repos keep the `deny` list as-is and swap the `pnpm` lines in `allow` for whatever their stack runs.

**Codex gets the same policy** in `.codex/rules/default.rules` — permission config is not portable, so the block list exists twice and **both must be changed together**. Codex uses Starlark `prefix_rule()` calls matching on argument *tokens*, which handles flags and shell chains that the `Bash(…)` prefix patterns miss, and every rule carries its own `match`/`not_match` cases. Check a rule with:

```bash
codex execpolicy check --pretty --rules .codex/rules/default.rules -- git push --force
```

**Parity between the two is machine-checked, not eyeballed.** `pnpm check:policy` (`scripts/check-policy-parity.js`, part of `pnpm check` and of CI) expands every `prefix_rule` into its concrete argv prefixes — the cartesian product over its alternation lists — and matches the two sets in both directions, so "we changed both files" becomes a number rather than a claim. Two things it encodes are worth knowing before editing either file:

- **The languages differ, so a few gaps cannot be closed.** Claude Code matches a prefix of the command _string_; a `prefix_rule` matches whole argv _tokens_. `Bash(aws iam delete-:*)` therefore bans every delete verb AWS will ever ship, and the Codex side can only enumerate the ones it ships today. Such a difference is legal but must be **declared** — in the `DELIBERATE` list in the script and in the `.codex/rules/default.rules` header — and the check fails both on an undeclared one and on a declaration that has gone stale.
- **Neither language normalises flag order or case.** `rm -rf /` and `rm -fr /` are separate bans; `rm -r -f /` and `redis-cli FlushAll` are neither, and enumerating permutations never ends. The check proves the two files list the **same spellings** — it does not claim the set of spellings is complete. Same caveat as the two below, and for the same reason.

## Branching model

The default here is a **`dev` integration branch**: branch off `dev`, PR into `dev`, roll `dev` up into `main`, and release-please releases from `main`. That is what most kirchDev repos run, so the template runs it too — a variant that ships switched off is a variant nobody notices is broken.

> [!IMPORTANT]
> A repo created from this template has the `dev` config but **no `dev` branch**. Create it before the first Dependabot run: with `target-branch: 'dev'` pointing at a branch that doesn't exist, Dependabot opens nothing at all. Going main-only (below) is a deliberate step too — leaving the config untouched is the one option that silently does nothing.

`.github/workflows/dev-pr.yml` opens and updates the rolling draft `dev` → `main` PR. Mark that PR ready and **merge it with a merge commit, never a squash**: squashing collapses the individual `feat:`/`fix:` commits into the PR's own `chore:` title, and release-please then cuts nothing.

Going **main-only** is three edits, all of them removals:

```bash
rm .github/workflows/dev-pr.yml
# .github/dependabot.yml    — drop both `target-branch: 'dev'` lines
# .tituskirch-skills.json   — set `pr.base` to "main"
```

Nothing is vendored for this. A variant worth shipping as files is one that *adds* something — content that would otherwise be lost, the way `dev-pr.yml` itself would be. A variant that only deletes has nothing to preserve, so it stays documented.

`ci.yml` and `codeql.yml` list both `main` and `dev` in their `on: branches:` filters and neither edit touches them. A filter naming a branch that doesn't exist is a no-op, so it costs a main-only repo nothing — and without `dev` in `ci.yml`, PRs into `dev` (Dependabot's included) would run no CI at all.

## Visibility

This repo is **public**, which settles the three defaults that depend on visibility: CodeQL runs (GitHub Advanced Security is free on public repos), the MIT `LICENSE` and its README footer stay, and `.github/ISSUE_TEMPLATE/config.yml` points questions, ideas and possible bugs at the repo's Discord forum while confirmed bugs and features stay as GitHub issue forms.

## House style for READMEs and meta files

`/write-readme` skill encodes the canonical structure. Key rules: hero block wrapped in `<div align="center">`, prescribed section emojis (✨ Features, 🚀 Setup, 🤝 Contributing, 🛣️ Versioning, 📄 License), license footer always reads `[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)`. Use GitHub callouts (`> [!TIP]`, `> [!IMPORTANT]`), never plain blockquotes.

## The virtual module id

`virtual:iconify-bundle` is the string a consumer types, and it is **still changeable until the first publish**; after that it is a breaking change for strangers. The recommendation is to keep it: `unplugin-icons` already occupies `~icons/*` and `virtual:icons/*`, so anything generic sits confusingly close to it; the id mirrors the repo name (id minus `virtual:` equals repo minus `vite-plugin-`); and it survives a later Nuxt wrapper, which would serve the same module rather than invent a second name. That is also why the package is `-bundle` and not `-bundler`. **Do not change it unilaterally — raise it.**

## The package name is scoped, the repo name is not

The package publishes as `@kirchdev/vite-plugin-iconify-bundle`; the repo, the docs headings that name the project, and `CONTRIBUTING.md` keep the bare `vite-plugin-iconify-bundle`. That split is not a style choice — **an unrelated maintainer published `vite-plugin-iconify-bundle` to npm on 2026-05-30** and is at `1.0.2`, so the bare name was never available to publish under. The scope also ends that class of collision for good.

Use the scoped name wherever a consumer types it — an install command, an import specifier, a `dependencies` key, a `/// <reference types>` path. Use the bare name where the *project* is meant. Note that the module id `virtual:iconify-bundle` no longer derives from the package name because of this; it derives from the repo name, and it does not gain a scope.

## The ambient type declaration ships with the package

The virtual module has no file on disk, so a consumer's side-effect import fails TypeScript 6 with TS2882 unless `declare module 'virtual:iconify-bundle';` is in scope — and it must be **ambient**, not an augmentation, since an augmentation cannot resolve a module that does not exist. `client.d.ts` carries it; without that file the package compiles for nobody.

The file that carries it must stay free of any top-level `import` or `export` — one of either turns the whole file into a module and the `declare module` into an augmentation, which is the failure this note exists to prevent.

## Scope

**Keep the surface small.** The plugin ships the config it has today — `sourceDir` and `collections` — and this repo is moving and packaging, not redesigning. A new option needs a reason beyond "an app might want it".

A Nuxt wrapper, if it happens, is a **second published package out of this repo** (`nuxt-iconify-bundle`) serving the same virtual module — not a rename of this one.

## When editing this repo

- `forgemap` (sibling repo at `../forgemap`) is the de-facto reference implementation of the meta-layer conventions here. When unsure about a config choice, check what forgemap does.
- The repo inherits `TitusKirch/scaffold`'s meta layer. When a scaffold default gets fixed upstream, the fix is worth pulling across rather than reinventing.
