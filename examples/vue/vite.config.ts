import vue from '@vitejs/plugin-vue';
import { iconifyBundlePlugin } from 'vite-plugin-iconify-bundle';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    vue(),
    // No `runtime` here: the default is `@iconify/vue`, which is what this
    // example uses. `sourceDir` is relative, so it resolves against Vite's
    // root rather than against the working directory the build ran from.
    iconifyBundlePlugin({
      sourceDir: 'src',
      collections: ['lucide', 'simple-icons']
    })
  ]
});
