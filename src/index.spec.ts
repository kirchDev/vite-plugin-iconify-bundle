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

  async function loadModule(sourceDir: string): Promise<string> {
    const plugin = iconifyBundlePlugin({
      sourceDir,
      collections: ['lucide']
    });

    const context = { addWatchFile() {}, warn() {} } as any;
    (plugin.configResolved as any).call(context, { root: process.cwd() });

    return (await (plugin.load as any).call(context, RESOLVED_ID)) as string;
  }

  let dir: string;

  beforeEach(async () => {
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
});
