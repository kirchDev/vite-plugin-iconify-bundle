<div align="center">

# 🧩 vite-plugin-iconify-bundle

**Only the Iconify icons your source actually uses — resolved at build time, inlined into the bundle, no runtime API**

[![Tests](https://img.shields.io/github/actions/workflow/status/kirchDev/vite-plugin-iconify-bundle/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/kirchDev/vite-plugin-iconify-bundle/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)

</div>

---

```ts
import 'virtual:iconify-bundle';
```

That's it. One bare side-effect import registers every icon the plugin found in your source, so icons work offline, render inline under SSR, and never cost a runtime request.

## 🤔 Why

`@iconify/vue` fetches icon data from the Iconify API at runtime, which fails offline, renders nothing during SSR, and makes a build non-deterministic. Shipping whole `@iconify-json/*` collections instead trades that for megabytes of unused icons. This plugin scans your source for quoted `prefix:name` literals, resolves each one against the collections you have installed, and emits just those — a bundle that contains exactly the icons you wrote down.

## 📦 Installation

```bash
pnpm add -D vite-plugin-iconify-bundle @iconify-json/lucide
```

Install one `@iconify-json/<prefix>` package per collection you want scanned; the plugin reads their data from disk at build time.

## 🚀 Quick start

```ts
// vite.config.ts
import { iconifyBundlePlugin } from 'vite-plugin-iconify-bundle';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [iconifyBundlePlugin({ sourceDir: 'src', collections: ['lucide'] })]
});
```

Then import the virtual module once, wherever your icon component lives:

```ts
import 'virtual:iconify-bundle';
```

## ✨ Features

- **📦 Used icons only** — the bundle carries what the scan found, not a whole collection.
- **🔍 A scan, not a parse** — a plain search over all three string delimiters, so a name in a comment counts too. That is deliberate: a wrong name fails loudly instead of rendering nothing.
- **⚠️ Unknown names fail the build** — an icon the installed collection does not have stops the build rather than shipping a gap.
- **🚀 Offline and SSR-safe** — icon data is resolved at build time, so nothing is fetched at runtime and SSR renders inline.
- **🧰 Two options, no more** — `sourceDir` and `collections`; everything else is convention.
- **☑️ HMR-aware** — editing a source file invalidates the virtual module, so a newly written icon name appears without a restart.

## ⚙️ Configuration

| Key           | Default                              | What it controls                                                                                       |
| :------------ | :----------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `sourceDir`   | Vite's `root`                        | Directory scanned for icon-name literals. A relative path resolves against `root`, not the working dir. |
| `collections` | `['lucide', 'simple-icons']`         | Allowed Iconify prefixes, each installed as `@iconify-json/<prefix>`.                                   |
| `extensions`  | `['.vue', '.ts']`                    | File extensions the scan reads. `.d.ts` is always skipped.                                              |
| `ignore`      | `['node_modules', 'dist', '.git']`   | Directory **names** the scan does not descend into.                                                     |
| `runtime`     | `'@iconify/vue'`                     | Package the emitted module imports `addCollection` from.                                                |

> [!IMPORTANT]
> `collections` defaults to the two collections this plugin was extracted from. A prefix that isn't in the list never reaches the scan, so its icons render as nothing rather than failing — set it to your own collections. The plugin warns when a scan finds no icons at all, which is what that mistake usually looks like.

The icon data is framework-neutral, so `runtime` covers React, Svelte and the web component too — `@iconify/react`, `@iconify/svelte` and `iconify-icon` all export the same `addCollection`. This package never imports the runtime itself; it only writes the specifier into the virtual module, so whichever one you name is yours to install.

## 🧩 TypeScript

The virtual module has no file on disk, so TypeScript rejects a side-effect import of it with `TS2882` unless an **ambient** declaration is in scope. The package ships one — reference it from your `tsconfig.json` `types`, or from a `.d.ts` of your own:

```ts
/// <reference types="vite-plugin-iconify-bundle/client" />
```

## 🗂️ Example

[`examples/web-component`](examples/web-component) is a plain Vite app — no framework — that renders icons through `<iconify-icon>`. It is a workspace package linked to this repo, so it builds against the working tree rather than a published version:

```bash
pnpm example:build   # or: pnpm example:dev
```

It demonstrates the bare side-effect import, a non-default `runtime`, and the comment-scanning trade — one of its icon names appears only inside a comment and still reaches the bundle.

## 🧪 Testing

```bash
pnpm test        # the suite
pnpm check       # lint, format, typecheck, test, policy parity — the CI gate
```

## 🤝 Contributing

PRs welcome. Conventional Commits required (enforced via commitlint). Husky runs the project's linters/formatters on `git commit`.

> [!TIP]
> Run `pnpm check:fix` before pushing — CI will catch what husky missed.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## 🛣️ Versioning

[Semantic Versioning](https://semver.org/) via [release-please](https://github.com/googleapis/release-please) — see [CHANGELOG.md](CHANGELOG.md).

## 📄 License

[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)
