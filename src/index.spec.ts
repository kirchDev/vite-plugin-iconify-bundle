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

  async function load(
    options: Parameters<typeof iconifyBundlePlugin>[0],
    root: string = process.cwd()
  ): Promise<string> {
    const plugin = iconifyBundlePlugin(options);
    const context = {
      addWatchFile() {},
      warn(message: string) {
        warnings.push(message);
      }
    } as any;
    (plugin.configResolved as any).call(context, { root });
    return (await (plugin.load as any).call(context, RESOLVED_ID)) as string;
  }

  const loadModule = (sourceDir: string): Promise<string> =>
    load({ sourceDir, collections: ['lucide'] });

  let dir: string;

  beforeEach(async () => {
    warnings.length = 0;
    dir = await fs.mkdtemp(path.join(tmpdir(), 'iconify-bundle-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('emits only the icons the source names', async () => {
    await fs.writeFile(path.join(dir, 'a.ts'), `const i = 'lucide:house';`);

    const code = await loadModule(dir);

    expect(code).toContain(`import { addCollection } from "@iconify/vue"`);
    expect(code).toContain('"house"');
    expect(code).not.toContain('"mail"');
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
   * The option is documented as resolving against Vite's root rather than the
   * working directory, and every other test here passes an absolute path — so
   * this is the only one that would notice the two being swapped.
   */
  it('resolves a relative sourceDir against the root', async () => {
    const nested = path.join(dir, 'src');
    await fs.mkdir(nested);
    await fs.writeFile(path.join(nested, 'a.ts'), `const i = 'lucide:house';`);

    const code = await load({ sourceDir: 'src', collections: ['lucide'] }, dir);

    expect(code).toContain('"house"');
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
});
