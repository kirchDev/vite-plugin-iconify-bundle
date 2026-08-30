# Example — web component runtime

The smallest thing that proves the plugin: a plain Vite app, no framework, icons
rendered by `<iconify-icon>`.

```bash
pnpm install          # from the repo root
pnpm examples:build   # or: pnpm --filter @example/web-component dev
```

What it demonstrates:

- **The bare side-effect import** — `src/main.ts` imports `virtual:iconify-bundle`
  for effect only; the module exports nothing.
- **`runtime`** — set to `iconify-icon`, not the `@iconify/vue` default. The
  icon data is framework-neutral, so the option is all it takes.
- **The scan reading comments** — `src/main.ts` names `lucide:phone` only inside a
  comment, and it lands in the bundle. Misspell it and the build fails, which is
  the trade the plugin is built around.

Try it: change `lucide:house` to `lucide:hause` and run the build again.
