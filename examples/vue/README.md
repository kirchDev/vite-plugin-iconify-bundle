# Example — Vue, default runtime

A Vite + Vue app using the plugin exactly as configured out of the box.

```bash
pnpm install              # from the repo root
pnpm examples:build       # or: pnpm --filter @example/vue dev
```

What this one covers that [`../web-component`](../web-component) does not:

- **The default `runtime`** — `@iconify/vue`, so `vite.config.ts` never names it.
- **`.vue` files are scanned** — `App.vue` and `StackRow.vue` hold their icon names
  in `<script setup>`, and the default `extensions` reads both `.vue` and `.ts`.
- **A relative `sourceDir`** — `'src'`, resolved against Vite's root rather than
  against the directory the build was started from.
- **Two collections, one nested directory** — the scan recurses and groups names
  by prefix.

`StackRow.vue` names `lucide:package` only inside an HTML comment, and it still
lands in the bundle. Misspell it and the build fails.
