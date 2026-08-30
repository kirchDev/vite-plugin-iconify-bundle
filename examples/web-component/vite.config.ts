import { iconifyBundlePlugin } from '@kirchdev/vite-plugin-iconify-bundle';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    iconifyBundlePlugin({
      sourceDir: 'src',
      collections: ['lucide'],
      // No Vue here — the icon data is framework-neutral, so the web component
      // registers the same collections through the same `addCollection`.
      runtime: 'iconify-icon'
    })
  ]
});
