import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { iconifyBundlePlugin } from './index';

/**
 * Everything in `index.spec.ts` inspects the module the plugin *emits*. That
 * is not the same claim as the bundle containing only the wanted icons: in
 * between sit Vite's transform, Rollup's tree shaking and the SSR pipeline,
 * any of which could drop an icon or carry the whole collection through.
 *
 * These build for real. They are the only tests that would notice the plugin
 * working perfectly and the output still being wrong.
 */
describe('the built bundle', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), 'iconify-bundle-e2e-'));
    await fs.mkdir(path.join(dir, 'src'));
    await fs.writeFile(
      path.join(dir, 'src', 'entry.ts'),
      [
        `import 'virtual:iconify-bundle';`,
        `export const NAV = ['lucide:house', 'lucide:mail'];`,
        `export const render = () => NAV.join(',');`
      ].join('\n')
    );
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /**
   * The icon names the built output carries, and its size.
   *
   * The built code cannot be parsed as JSON: the bundler reformats the emitted
   * object and rewrites the body strings to single quotes. Inside the icon map
   * every value is a number or a string, so any `"key": {` there is an icon —
   * `icons` itself is the one structural key that shape also matches.
   */
  async function built(ssr: boolean): Promise<{
    icons: string[];
    bytes: number;
  }> {
    const result = await build({
      // The root stays this repo, because that is where the `@iconify-json/*`
      // packages are installed and the plugin resolves them from the root.
      root: process.cwd(),
      logLevel: 'silent',
      plugins: [
        iconifyBundlePlugin({
          sourceDir: path.join(dir, 'src'),
          collections: ['lucide']
        })
      ],
      build: {
        write: false,
        minify: false,
        ssr,
        lib: {
          entry: path.join(dir, 'src', 'entry.ts'),
          formats: ['es'],
          fileName: 'entry'
        },
        rollupOptions: { external: ['@iconify/vue'] }
      }
    });

    const output = (result as { output: { code?: string }[] }[])[0].output;
    const code = output.map((chunk) => chunk.code ?? '').join('\n');

    const icons = [...code.matchAll(/"([a-z][a-z0-9-]*)"\s*:\s*\{/g)]
      .map(([, name]) => name)
      .filter((name) => name !== 'icons')
      .sort();

    return { icons, bytes: code.length };
  }

  it('carries exactly the named icons in a client build', async () => {
    const { icons, bytes } = await built(false);

    expect(icons).toEqual(['house', 'mail']);
    // The collection on disk is over half a megabyte. This ceiling is loose
    // enough never to fail on a wider icon, and far below anything that
    // embedded the collection whole.
    expect(bytes).toBeLessThan(10_000);
  });

  /**
   * The plugin's reason for existing: resolved at build time means the server
   * renders real artwork instead of waiting on a request that never happens
   * there. A virtual module served only to the client environment would pass
   * every other test in this repo.
   */
  it('carries exactly the named icons in an SSR build', async () => {
    const { icons, bytes } = await built(true);

    expect(icons).toEqual(['house', 'mail']);
    expect(bytes).toBeLessThan(10_000);
  });
});
