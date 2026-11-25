import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectIconNames, iconifyBundlePlugin, isScannedFile } from './index';

/**
 * `collectIconNames` is the plugin's definition of *used*, and it decides both
 * halves of the build: a name it collects that the installed collection lacks
 * fails the build outright, and a name it misses is an icon that renders as
 * nothing. Neither failure is visible from the plugin's own interface, so the
 * definition is pinned here rather than at the virtual module.
 */

/** The collected map, flattened to sorted `prefix:name` strings. */
function collected(found: Map<string, Set<string>>): string[] {
  return [...found]
    .flatMap(([prefix, names]) => [...names].map((name) => `${prefix}:${name}`))
    .sort();
}

describe('collectIconNames', () => {
  it('reads a name out of each of the three string delimiters', () => {
    const code = [
      `const single = 'lucide:house';`,
      `const double = "lucide:mail";`,
      'const template = `lucide:phone`;'
    ].join('\n');

    expect(collected(collectIconNames(code))).toEqual([
      'lucide:house',
      'lucide:mail',
      'lucide:phone'
    ]);
  });

  it('reads every name in a file, across collections', () => {
    const code = [
      `const sections = [`,
      `  { icon: 'lucide:building' },`,
      `  { icon: 'lucide:scale' },`,
      `  { icon: 'simple-icons:laravel' }`,
      `];`
    ].join('\n');

    expect(collected(collectIconNames(code))).toEqual([
      'lucide:building',
      'lucide:scale',
      'simple-icons:laravel'
    ]);
  });

  /**
   * Not a leak to be fixed — ADR-0001 records it as the deliberate trade: a
   * quoted icon name written into prose sends the build looking for an icon
   * that may not exist, and that loud failure is preferred to a scan that
   * parses JavaScript to find out which literals are real.
   */
  it('reads a name written inside a comment', () => {
    const code = [
      `// Falls back to 'lucide:circle-help' when the technology has none.`,
      `const icon = 'lucide:house';`
    ].join('\n');

    expect(collected(collectIconNames(code))).toEqual([
      'lucide:circle-help',
      'lucide:house'
    ]);
  });

  it('keeps a hyphenated name whole', () => {
    expect(collected(collectIconNames(`'lucide:circle-check-big'`))).toEqual([
      'lucide:circle-check-big'
    ]);
  });

  it('reports a repeated name once', () => {
    const code = `'lucide:house' + "lucide:house"`;

    expect(collected(collectIconNames(code))).toEqual(['lucide:house']);
  });

  it('ignores an unquoted occurrence', () => {
    expect(collected(collectIconNames('Use lucide:house here.'))).toEqual([]);
  });

  it('ignores a collection that is not bundled', () => {
    expect(collected(collectIconNames(`'mdi:home'`))).toEqual([]);
  });

  it('ignores a name in the wrong case', () => {
    expect(collected(collectIconNames(`'lucide:House'`))).toEqual([]);
  });

  it('groups the names under their collection prefix', () => {
    const found = collectIconNames(`'lucide:house' 'simple-icons:vuedotjs'`);

    expect([...found.keys()].sort()).toEqual(['lucide', 'simple-icons']);
    expect([...(found.get('lucide') ?? [])]).toEqual(['house']);
  });

  it('collects nothing from a file with no icon literal', () => {
    expect(collected(collectIconNames('export const answer = 42;'))).toEqual(
      []
    );
  });

  it('scans only the collections it is given', () => {
    const code = `'lucide:house' 'simple-icons:laravel'`;

    expect(collected(collectIconNames(code, ['lucide']))).toEqual([
      'lucide:house'
    ]);
  });

  /**
   * A prefix reaches the pattern as text, so a regex metacharacter in one has
   * to stay literal — otherwise a collection named `a.b` would also match the
   * icons of a collection named `axb`.
   */
  it('treats a metacharacter in a prefix as a literal', () => {
    const code = `'a.b:house' 'axb:house'`;

    expect(collected(collectIconNames(code, ['a.b']))).toEqual(['a.b:house']);
  });

  /**
   * The plugin calls this once per source file. A pattern shared across those
   * calls would carry its `lastIndex` from one file into the next and drop the
   * icons of every file after the first.
   */
  /**
   * An empty list allows no collection, so nothing can be used. Without a
   * guard the pattern is built with an empty alternation, which matches the
   * empty string: `':house'` is then collected under the prefix `''`.
   */
  it('collects nothing when no collection is allowed', () => {
    expect(collected(collectIconNames(`':house'`, []))).toEqual([]);
    expect(collected(collectIconNames(`'lucide:house'`, []))).toEqual([]);
  });

  it('starts each scan at the beginning of the text', () => {
    const code = `'lucide:house'`;

    const first = collected(collectIconNames(code));
    const second = collected(collectIconNames(code));

    expect(first).toEqual(['lucide:house']);
    expect(second).toEqual(first);
  });
});

describe('isScannedFile', () => {
  it('reads the default extensions', () => {
    expect(isScannedFile('Icon.vue')).toBe(true);
    expect(isScannedFile('icons.ts')).toBe(true);
  });

  /**
   * The scan and the HMR filter read this same function. When they were two
   * hand-written conditions they could disagree about a file, and the symptom
   * was an icon that appeared only after a restart.
   */
  it('skips a declaration file even though it ends in .ts', () => {
    expect(isScannedFile('layouts.d.ts')).toBe(false);
  });

  it('skips an extension it was not given', () => {
    expect(isScannedFile('main.js')).toBe(false);
    expect(isScannedFile('main.js', ['.js'])).toBe(true);
  });
});

/**
 * The unit tests above pin the definition of *used*; these pin what the plugin
 * does with it. Both halves of the contract live here — an icon the collection
 * has reaches the emitted module, and one it does not have stops the build —
 * and so does the resolution seam: `@iconify-json/lucide` is found relative to
 * the configured root, not to this file.
 */
describe('iconifyBundlePlugin', () => {
  const RESOLVED_ID = '\0virtual:iconify-bundle';

  const warnings: string[] = [];
  const watched: string[] = [];

  async function load(
    options: Parameters<typeof iconifyBundlePlugin>[0],
    root: string = process.cwd()
  ): Promise<string> {
    const plugin = iconifyBundlePlugin(options);
    const context = {
      addWatchFile(file: string) {
        watched.push(file);
      },
      warn(message: string) {
        warnings.push(message);
      }
    } as any;
    (plugin.configResolved as any).call(context, { root });
    return (await (plugin.load as any).call(context, RESOLVED_ID)) as string;
  }

  const loadModule = (sourceDir: string): Promise<string> =>
    load({ sourceDir, collections: ['lucide'] });

  /**
   * A minimal `@iconify-json/<prefix>` package inside `root`'s own
   * `node_modules`, holding icon names no real collection has.
   *
   * The plugin resolves collections from the configured root, so proving that
   * needs a collection reachable *only* from there. Leaning on this repo's
   * installed copy instead makes the outcome depend on how the test runner
   * resolves modules rather than on the plugin: it passed locally, where the
   * runner reaches the repo's copy whatever the require is anchored to, and
   * failed in CI, where plain resolution from a temp directory finds nothing.
   */
  async function plantCollection(
    root: string,
    prefix: string,
    names: string[]
  ): Promise<void> {
    const pkg = path.join(root, 'node_modules', '@iconify-json', prefix);
    await fs.mkdir(pkg, { recursive: true });
    await fs.writeFile(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: `@iconify-json/${prefix}`, version: '0.0.0' })
    );
    await fs.writeFile(
      path.join(pkg, 'icons.json'),
      JSON.stringify({
        prefix,
        icons: Object.fromEntries(
          names.map((name) => [
            name,
            { body: '<path d="M0 0"/>', width: 24, height: 24 }
          ])
        )
      })
    );
  }

  /**
   * The emitted subsets, parsed rather than string-matched. `toContain` can
   * only ever prove one icon is absent; the bundle's whole claim is that
   * nothing else is present, and that is a statement about the key set.
   */
  function registered(code: string): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [, json] of code.matchAll(/addCollection\((\{.*?\})\);/g)) {
      const subset = JSON.parse(json) as {
        prefix: string;
        icons: Record<string, unknown>;
      };
      out[subset.prefix] = Object.keys(subset.icons).sort();
    }
    return out;
  }

  let dir: string;

  beforeEach(async () => {
    warnings.length = 0;
    watched.length = 0;
    dir = await fs.mkdtemp(path.join(tmpdir(), 'iconify-bundle-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /**
   * The exact key set, not a sample. The collection on disk holds well over a
   * thousand icons, so asserting that one specific other icon is absent would
   * pass just as happily if the plugin embedded all of them but one.
   */
  it('emits the icons the source names and no others', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:house', 'lucide:mail']`
    );

    const code = await loadModule(dir);

    expect(code).toContain(`import { addCollection } from "@iconify/vue"`);
    expect(registered(code)).toEqual({ lucide: ['house', 'mail'] });
  });

  it('fails the build on a name the collection does not have', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `const i = 'lucide:definitely-not-an-icon';`
    );

    await expect(loadModule(dir)).rejects.toThrow(
      'lucide:definitely-not-an-icon'
    );
  });

  it('does not descend into an ignored directory', async () => {
    const nested = path.join(dir, 'node_modules');
    await fs.mkdir(nested);
    await fs.writeFile(path.join(nested, 'a.ts'), `const i = 'lucide:house';`);

    expect(await loadModule(dir)).not.toContain('"house"');
  });

  it('imports addCollection from the configured runtime', async () => {
    await fs.writeFile(path.join(dir, 'a.ts'), `const i = 'lucide:house';`);

    const code = await load({
      sourceDir: dir,
      collections: ['lucide'],
      runtime: 'iconify-icon'
    });

    expect(code).toContain(`import { addCollection } from "iconify-icon"`);
    expect(code).not.toContain('@iconify/vue');
  });

  /**
   * The scan and the HMR filter share `isScannedFile`, but nothing proved the
   * directory walk actually consults it — a walk that read every file would
   * pass every unit test above and still bundle icons out of a .md file.
   */
  it('reads only the configured extensions off disk', async () => {
    await fs.writeFile(path.join(dir, 'a.md'), `see 'lucide:house' here`);
    await fs.writeFile(path.join(dir, 'b.ts'), `const i = 'lucide:mail';`);

    const code = await loadModule(dir);

    expect(code).not.toContain('"house"');
    expect(code).toContain('"mail"');
  });

  /**
   * Both halves of what the root means, in one hermetic case.
   *
   * `sourceDir` is relative, so nothing is found unless it resolves against
   * the root rather than the working directory — every other test here passes
   * an absolute path and would not notice the two being swapped. And the icon
   * exists only in the collection planted under that same root, so it reaches
   * the bundle only if collections resolve from the root too, rather than
   * from wherever this package happens to be installed.
   */
  it('resolves a relative sourceDir and the collections against the root', async () => {
    const nested = path.join(dir, 'src');
    await fs.mkdir(nested);
    await fs.writeFile(
      path.join(nested, 'a.ts'),
      `const i = 'lucide:hermetic-house';`
    );
    await plantCollection(dir, 'lucide', ['hermetic-house']);

    const code = await load({ sourceDir: 'src', collections: ['lucide'] }, dir);

    expect(registered(code)).toEqual({ lucide: ['hermetic-house'] });
  });

  /**
   * The one signal for the silent half of the failure model: a `collections`
   * list that misses the prefix the source writes collects nothing, and
   * nothing else would report it.
   */
  it('warns when the scan finds no icons at all', async () => {
    await fs.writeFile(path.join(dir, 'a.ts'), `const i = 'mdi:home';`);

    const code = await loadModule(dir);

    expect(code).not.toContain('addCollection(');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('No icon literals found');
  });

  it('scans a nested directory', async () => {
    const nested = path.join(dir, 'components', 'base');
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(nested, 'a.ts'), `const i = 'lucide:house';`);

    expect(await loadModule(dir)).toContain('"house"');
  });

  /**
   * Nothing else would report a `sourceDir` that does not exist: with no files
   * to read the scan finds nothing, which is indistinguishable from a project
   * that uses no icons yet. Failing is the only way the mistake is visible.
   */
  it('fails when the source directory does not exist', async () => {
    await expect(loadModule(path.join(dir, 'nope'))).rejects.toThrow();
  });

  /**
   * A build that emits the same icons in a different order produces a
   * different chunk hash, which is the determinism the plugin is built for.
   */
  it('emits the icon names in a stable order', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:mail', 'lucide:house', 'lucide:bell']`
    );

    const code = await loadModule(dir);
    const order = [...code.matchAll(/"(bell|house|mail)":\{/g)].map(
      ([, name]) => name
    );

    expect(order).toEqual(['bell', 'house', 'mail']);
  });

  /**
   * The same holds one level up. Collections met in the order the files
   * finished reading would vary between two builds of the same source — and
   * in the dev server, a bundle that differs without changing reloads the
   * page on an edit that should have kept its HMR.
   */
  it('emits the collections in the configured order', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:house', 'simple-icons:vuedotjs']`
    );

    const code = await load({
      sourceDir: dir,
      collections: ['simple-icons', 'lucide']
    });
    const order = [...code.matchAll(/"prefix":"([a-z-]+)"/g)].map(
      ([, prefix]) => prefix
    );

    expect(order).toEqual(['simple-icons', 'lucide']);
  });

  it('emits one registration per collection, each holding only its own', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:house', 'simple-icons:vuedotjs', 'lucide:mail']`
    );

    const code = await load({
      sourceDir: dir,
      collections: ['lucide', 'simple-icons']
    });

    expect(registered(code)).toEqual({
      lucide: ['house', 'mail'],
      'simple-icons': ['vuedotjs']
    });
  });

  /**
   * Dozens of names exist in both collections. Grouping by prefix is what
   * keeps them apart, and a bug that merged the groups would still produce a
   * plausible-looking bundle — with one collection's artwork under the other
   * collection's name.
   */
  it('keeps a name that exists in both collections under each prefix', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:anchor', 'simple-icons:anchor']`
    );

    const code = await load({
      sourceDir: dir,
      collections: ['lucide', 'simple-icons']
    });
    const subsets = registered(code);

    expect(subsets).toEqual({ lucide: ['anchor'], 'simple-icons': ['anchor'] });

    const [lucide, simple] = [...code.matchAll(/addCollection\((\{.*?\})\);/g)];
    expect(lucide[1]).not.toEqual(simple[1]);
  });

  it('reports an unknown name against the collection it was written for', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:house', 'simple-icons:not-a-real-brand']`
    );

    await expect(
      load({ sourceDir: dir, collections: ['lucide', 'simple-icons'] })
    ).rejects.toThrow('simple-icons:not-a-real-brand');
  });

  /**
   * Reporting only the first unknown name turns one build into a queue of
   * builds, each revealing the next typo.
   */
  it('names every unknown icon, not just the first', async () => {
    await fs.writeFile(
      path.join(dir, 'a.ts'),
      `['lucide:nope-one', 'lucide:nope-two', 'lucide:house']`
    );

    await expect(loadModule(dir)).rejects.toThrow(
      /lucide:nope-one.*lucide:nope-two/
    );
  });

  /**
   * Without this the module is built once and never again: a newly written
   * icon name would need a restart, which is the promise `handleHotUpdate`
   * below completes.
   */
  it('registers every scanned file as a watch dependency', async () => {
    await fs.writeFile(path.join(dir, 'a.ts'), `const i = 'lucide:house';`);
    await fs.writeFile(path.join(dir, 'b.vue'), `const i = 'lucide:mail';`);

    await loadModule(dir);

    expect(watched.map((file) => path.basename(file)).sort()).toEqual([
      'a.ts',
      'b.vue'
    ]);
  });
});

/**
 * The hooks Vite calls. Nothing above reaches them: `load` is exercised
 * through the resolved id directly, so a `resolveId` that stopped claiming
 * the virtual id would leave every test here green and every consumer broken.
 */
describe('iconifyBundlePlugin hooks', () => {
  const RESOLVED_ID = '\0virtual:iconify-bundle';
  const plugin = iconifyBundlePlugin();

  it('claims the virtual module id', () => {
    expect((plugin.resolveId as any).call(null, 'virtual:iconify-bundle')).toBe(
      RESOLVED_ID
    );
  });

  it('claims nothing else', () => {
    expect((plugin.resolveId as any).call(null, 'vue')).toBeUndefined();
    expect(
      (plugin.resolveId as any).call(null, 'virtual:iconify-bundle-other')
    ).toBeUndefined();
  });

  it('loads nothing for a module it does not own', async () => {
    expect(await (plugin.load as any).call(null, 'vue')).toBeUndefined();
  });
});

/**
 * The dev server. Two Vite facts decide the shape of this: a list returned
 * from `handleHotUpdate` REPLACES the modules Vite was about to update, so a
 * plugin that returns one for an ordinary edit swallows that file's own HMR —
 * a Vue component stops updating at all. And `handleHotUpdate` fires for an
 * edit only, never for a created or deleted file, so those arrive through the
 * watcher or not at all. The tests below pin both, against a real scan.
 */
describe('iconifyBundlePlugin dev server', () => {
  const RESOLVED_ID = '\0virtual:iconify-bundle';
  const RELOAD = { type: 'full-reload', path: '*' };

  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), 'iconify-bundle-hmr-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  /**
   * A plugin wired to a stand-in dev server, the bundle loaded once unless
   * `loaded` is false. The scan reads the real files under `sourceDir`; the
   * root stays this repo, so `lucide` resolves from its own install.
   */
  async function devServer(sourceDir: string = dir, loaded = true) {
    const plugin = iconifyBundlePlugin({ sourceDir, collections: ['lucide'] });
    const listeners: Record<string, (file: string) => unknown> = {};
    const watchedDirs: string[] = [];
    const sent: unknown[] = [];
    const invalidated: unknown[] = [];
    const module = { id: RESOLVED_ID };
    const server = {
      watcher: {
        add: (target: string) => watchedDirs.push(target),
        on: (event: string, listener: (file: string) => unknown) => {
          listeners[event] = listener;
        }
      },
      moduleGraph: {
        getModuleById: (id: string) =>
          id === RESOLVED_ID && loaded ? module : undefined,
        invalidateModule: (m: unknown) => invalidated.push(m)
      },
      ws: { send: (payload: unknown) => sent.push(payload) }
    };
    const context = { addWatchFile() {}, warn() {} };
    (plugin.configResolved as any).call(context, { root: process.cwd() });
    (plugin.configureServer as any).call(context, server);
    if (loaded) {
      await (plugin.load as any).call(context, RESOLVED_ID);
    }
    const ownUpdate = [{ id: 'the edited file' }];
    return {
      sent,
      invalidated,
      watchedDirs,
      edit: (file: string) =>
        (plugin.handleHotUpdate as any).call(context, {
          file,
          modules: ownUpdate,
          server
        }),
      fileEvent: async (event: 'add' | 'unlink', file: string) => {
        await listeners[event]?.(file);
      }
    };
  }

  const write = (name: string, code: string) =>
    fs.writeFile(path.join(dir, name), code);

  it('leaves an edit alone when the icon set does not change', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    await write('a.ts', `const i = 'lucide:house'; // reworded`);

    expect(await server.edit(path.join(dir, 'a.ts'))).toBeUndefined();
    expect(server.sent).toEqual([]);
    expect(server.invalidated).toEqual([]);
  });

  it('reloads the page when an edit changes the icon set', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    await write('a.ts', `const i = ['lucide:house', 'lucide:mail'];`);

    expect(await server.edit(path.join(dir, 'a.ts'))).toEqual([]);
    expect(server.sent).toEqual([RELOAD]);
    expect(server.invalidated).toHaveLength(1);
  });

  it('reloads when an edit introduces an unknown icon, so the error shows', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    await write('a.ts', `const i = 'lucide:not-an-icon';`);

    expect(await server.edit(path.join(dir, 'a.ts'))).toEqual([]);
    expect(server.sent).toEqual([RELOAD]);
  });

  it('reloads when a new file brings a new icon', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    await fs.mkdir(path.join(dir, 'nested'));
    await write('nested/b.vue', `const i = 'lucide:mail';`);
    await server.fileEvent('add', path.join(dir, 'nested', 'b.vue'));

    expect(server.sent).toEqual([RELOAD]);
    expect(server.invalidated).toHaveLength(1);
  });

  it('reloads when deleting a file drops its icon', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    await write('b.ts', `const i = 'lucide:mail';`);
    const server = await devServer();

    await fs.rm(path.join(dir, 'b.ts'));
    await server.fileEvent('unlink', path.join(dir, 'b.ts'));

    expect(server.sent).toEqual([RELOAD]);
  });

  // Vite 5 reports a created file through both paths. One change, one reload.
  it('reloads once when the same change arrives twice', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    await write('b.ts', `const i = 'lucide:mail';`);
    await server.fileEvent('add', path.join(dir, 'b.ts'));
    await server.edit(path.join(dir, 'b.ts'));

    expect(server.sent).toEqual([RELOAD]);
  });

  it('does not reload for a new file that adds no icon', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    await write('b.ts', `const i = 'lucide:house';`);
    await server.fileEvent('add', path.join(dir, 'b.ts'));

    expect(server.sent).toEqual([]);
  });

  it('ignores a file the scan does not read', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer();

    for (const file of [
      path.join(dir, 'styles.css'),
      path.join(dir, 'types.d.ts'),
      path.join(dir, 'node_modules', 'pkg', 'index.ts'),
      path.join(tmpdir(), 'outside-the-source-dir.ts')
    ]) {
      expect(await server.edit(file)).toBeUndefined();
      await server.fileEvent('add', file);
    }
    expect(server.sent).toEqual([]);
    expect(server.invalidated).toEqual([]);
  });

  it('does nothing while the bundle was never loaded', async () => {
    await write('a.ts', `const i = 'lucide:house';`);
    const server = await devServer(dir, false);

    await write('b.ts', `const i = 'lucide:mail';`);

    expect(await server.edit(path.join(dir, 'a.ts'))).toBeUndefined();
    await server.fileEvent('add', path.join(dir, 'b.ts'));
    expect(server.sent).toEqual([]);
  });

  // Vite watches its root. A file created in a source directory outside it
  // raises no event at all unless the directory is watched explicitly.
  it('watches a source directory outside the root', async () => {
    const outside = await devServer(dir);
    const inside = await devServer(path.join(process.cwd(), 'src'), false);

    expect(outside.watchedDirs).toEqual([dir]);
    expect(inside.watchedDirs).toEqual([]);
  });
});
