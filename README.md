<div align="center">

# 🧩 @kirchdev/vite-plugin-iconify-bundle

**Only the Iconify icons your source actually uses — resolved at build time, inlined into the bundle, no runtime API**

[![npm Version](https://img.shields.io/npm/v/@kirchdev/vite-plugin-iconify-bundle.svg?style=flat-square&color=4f46e5)](https://www.npmjs.com/package/@kirchdev/vite-plugin-iconify-bundle)
[![Downloads](https://img.shields.io/npm/dm/@kirchdev/vite-plugin-iconify-bundle.svg?style=flat-square&color=4f46e5)](https://www.npmjs.com/package/@kirchdev/vite-plugin-iconify-bundle)
[![Tests](https://img.shields.io/github/actions/workflow/status/kirchDev/vite-plugin-iconify-bundle/ci.yml?branch=main&style=flat-square&label=tests)](https://github.com/kirchDev/vite-plugin-iconify-bundle/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/node/v/@kirchdev/vite-plugin-iconify-bundle.svg?style=flat-square&color=8993be)](https://www.npmjs.com/package/@kirchdev/vite-plugin-iconify-bundle)
[![License: MIT](https://img.shields.io/npm/l/@kirchdev/vite-plugin-iconify-bundle.svg?style=flat-square&color=10b981)](LICENSE)

</div>

---

```ts
import 'virtual:iconify-bundle';
```

That's it. One bare side-effect import registers every icon the plugin found in your source, so icons work offline, render inline under SSR, and never cost a runtime request.

## 🤔 Why

`@iconify/vue` fetches icon data from the Iconify API at runtime, which fails offline, renders nothing during SSR, and makes a build non-deterministic. Shipping whole `@iconify-json/*` collections instead trades that for megabytes of unused icons. This plugin scans your source for quoted `prefix:name` literals, resolves each one against the collections you have installed, and emits just those — a bundle that contains exactly the icons you wrote down.

## ⚖️ Alternatives

This is not the only way to bundle Iconify icons, and for some projects it is the wrong one. Check this before wiring it up:

| Instead of this | When it fits better |
| :-------------- | :------------------- |
| [Iconify's own bundle script](https://iconify.design/docs/libraries/tools/export/icon-package.html) — a Node script using `@iconify/utils` or `@iconify/tools` that writes a file of `addCollection` calls | You are not on Vite, you need your own SVG in the bundle, you want the icon data transformed, or your icon names are built at runtime. The list is explicit, so it sees everything. |
| [`@nuxt/icon`](https://github.com/nuxt/icon) with `clientBundle.scan` | You are on Nuxt. It already does this — same scan, same virtual module, same SSR — and falls back to the runtime API for a collection you have not installed, where this plugin fails the build. |
| [`unplugin-icons`](https://github.com/unplugin/unplugin-icons) | You import each icon as its own component (`~icons/lucide/house`). It cannot resolve a name that arrives as a string from your data, which is the case this plugin is built for. |

What this plugin gives up for the scan: names assembled at runtime, custom SVG, bundlers other than Vite, and any transformation of the icon data. What it removes is the hand-maintained list and the build step you have to remember.

## 📦 Install & run

Install one `@iconify-json/<prefix>` package per collection you want scanned; the plugin reads their data from disk at build time.

```bash
pnpm add -D @kirchdev/vite-plugin-iconify-bundle @iconify-json/lucide
```

```ts
// vite.config.ts
import { iconifyBundlePlugin } from '@kirchdev/vite-plugin-iconify-bundle';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [iconifyBundlePlugin({ sourceDir: 'src', collections: ['lucide'] })]
});
```

Then import the virtual module once, wherever your icon component lives — it exports nothing, it registers.

```ts
import 'virtual:iconify-bundle';
```

> [!TIP]
> Two runnable examples, both workspace packages linked to this repo rather than to a published version, so they build against the working tree: [`examples/vue`](examples/vue) uses the default `@iconify/vue` runtime and scans `.vue` files, [`examples/web-component`](examples/web-component) uses `iconify-icon` and no framework at all. `pnpm examples:build` builds both; `pnpm --filter @example/vue dev` starts one.

## ✨ Features

- **📦 Used icons only** — the bundle carries what the scan found, not a whole collection.
- **🔍 A scan, not a parse** — a plain search over all three string delimiters, so a name in a comment counts too. That is deliberate: a wrong name fails loudly instead of rendering nothing.
- **⚠️ Unknown names fail the build** — an icon the installed collection does not have stops the build rather than shipping a gap.
- **🧰 Five options, no more** — everything else is convention.
- **☑️ HMR-aware** — editing a source file invalidates the virtual module, so a newly written icon name appears without a restart.

## ⚙️ Configuration

| Key           | Default                            | What it controls                                                                                       |
| :------------ | :--------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `sourceDir`   | Vite's `root`                      | Directory scanned for icon-name literals. A relative path resolves against `root`, not the working dir. |
| `collections` | `['lucide', 'simple-icons']`       | Allowed Iconify prefixes, each installed as `@iconify-json/<prefix>`.                                   |
| `extensions`  | `['.vue', '.ts']`                  | File extensions the scan reads. `.d.ts` is always skipped.                                              |
| `ignore`      | `['node_modules', 'dist', '.git']` | Directory **names** the scan does not descend into.                                                     |
| `runtime`     | `'@iconify/vue'`                   | Package the emitted module imports `addCollection` from.                                                |

> [!IMPORTANT]
> `collections` has a default, and it is almost certainly not yours. A prefix that isn't in the list never reaches the scan, so its icons render as nothing rather than failing — set it to your own collections. The plugin warns when a scan finds no icons at all, which is what that mistake usually looks like.

The icon data is framework-neutral, so `runtime` covers React, Svelte and the web component too — `@iconify/react`, `@iconify/svelte` and `iconify-icon` all export the same `addCollection`. This package never imports the runtime itself; it only writes the specifier into the virtual module, so whichever one you name is yours to install.

## 📘 TypeScript

The virtual module has no file on disk, so TypeScript rejects a side-effect import of it with `TS2882` unless an **ambient** declaration is in scope. The package ships one — reference it from your `tsconfig.json` `types`, or from a `.d.ts` of your own:

```ts
/// <reference types="@kirchdev/vite-plugin-iconify-bundle/client" />
```

## 🤝 Contributing

PRs welcome. Conventional Commits required (enforced via commitlint). Husky runs the project's linters/formatters on `git commit`.

```bash
pnpm test    # the suite
pnpm check   # lint, format, typecheck, test, policy parity — the CI gate
```

> [!TIP]
> Run `pnpm check:fix` before pushing — CI will catch what husky missed.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## 🛣️ Versioning

[Semantic Versioning](https://semver.org/) via [release-please](https://github.com/googleapis/release-please) — see [CHANGELOG.md](CHANGELOG.md).

## 📄 License

[MIT](LICENSE) © [Titus Kirch](https://github.com/TitusKirch/) / [IT-Dienstleistungen Titus Kirch](https://kirch.dev)
