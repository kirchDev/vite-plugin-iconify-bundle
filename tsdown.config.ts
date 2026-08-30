import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Everything the emitted module names is the consumer's to install: `vite`
  // is a peer, and the runtime package (`@iconify/vue` by default) is only ever
  // written into the virtual module as text, never imported here.
  deps: { neverBundle: ['vite'] }
});
