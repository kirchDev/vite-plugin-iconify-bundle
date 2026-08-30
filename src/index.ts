import { promises as fs, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { IconifyIcon, IconifyJSON } from '@iconify/types';
import { getIconData } from '@iconify/utils';
import type { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:iconify-bundle';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export interface IconifyBundleOptions {
  /**
   * Directory scanned for icon-name string literals.
   *
   * Relative paths resolve against Vite's `root`, not the working directory.
   * Defaults to `root` itself, which is why `ignore` below has a default at
   * all: a scan starting at the project root walks into `node_modules`.
   */
  sourceDir?: string;
  /** Allowed Iconify collection prefixes (installed as `@iconify-json/<prefix>`). */
  collections?: string[];
  /** File extensions the scan reads. `.d.ts` is always skipped. */
  extensions?: string[];
  /** Directory *names* the scan does not descend into. */
  ignore?: string[];
  /**
   * Package the emitted module imports `addCollection` from.
   *
   * The default is the Vue binding because that is what the originating app
   * uses, but the icon data is framework-neutral: `@iconify/react`,
   * `@iconify/svelte` and `iconify-icon` export the same function with the
   * same signature. Whichever one is named here has to be installed by the
   * consumer — this package only writes the specifier into the module, it never
   * imports it itself.
   */
  runtime?: string;
}

/** The collections scanned for unless a caller narrows the list. */
const DEFAULT_COLLECTIONS = ['lucide', 'simple-icons'];
const DEFAULT_EXTENSIONS = ['.vue', '.ts'];
const DEFAULT_IGNORE = ['node_modules', 'dist', '.git'];
const DEFAULT_RUNTIME = '@iconify/vue';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every icon literal in one source text, grouped by collection prefix.
 *
 * This is the plugin's definition of *used*, and the build turns on it: a name
 * collected here that the installed collection does not have fails the build,
 * and a name missed here is an icon that never reaches the bundle. So it is
 * exported and tested rather than left as a closure inside the factory.
 *
 * The scan is a plain search over the whole text — all three JavaScript string
 * delimiters, no parse — which means it reads names out of comments too. That
 * is deliberate and documented in the originating app's ADR-0001: an icon name
 * written into prose under the scanned directory sends the build looking for an
 * icon that does not exist, and the loud failure is preferred to a silently
 * missing icon.
 */
export function collectIconNames(
  code: string,
  collections: readonly string[] = DEFAULT_COLLECTIONS
): Map<string, Set<string>> {
  const pattern = new RegExp(
    `['"\`](${collections.map(escapeRegExp).join('|')}):([a-z0-9]+(?:-[a-z0-9]+)*)['"\`]`,
    'g'
  );

  const namesByPrefix = new Map<string, Set<string>>();
  let match: RegExpExecArray | null;
  while (true) {
    match = pattern.exec(code);
    if (match === null) {
      break;
    }
    const [, prefix, name] = match;
    let names = namesByPrefix.get(prefix);
    if (!names) {
      names = new Set();
      namesByPrefix.set(prefix, names);
    }
    names.add(name);
  }

  return namesByPrefix;
}

/** Whether the scan reads this file, given the configured extensions. */
export function isScannedFile(
  file: string,
  extensions: readonly string[] = DEFAULT_EXTENSIONS
): boolean {
  if (file.endsWith('.d.ts')) {
    return false;
  }
  return extensions.some((extension) => file.endsWith(extension));
}

/**
 * Vite plugin that bundles only the Iconify icons actually used in the source.
 *
 * It scans the configured source directory for quoted `prefix:name` string
 * literals of the allowed collections, resolves each icon from the locally
 * installed `@iconify-json/*` data at build time, and exposes them through the
 * virtual module `virtual:iconify-bundle`, which registers them via
 * `addCollection`. This keeps the bundle limited to used icons, works offline,
 * and renders inline during SSR (no runtime Iconify API calls).
 */
export function iconifyBundlePlugin(
  options: IconifyBundleOptions = {}
): Plugin {
  const collections = options.collections ?? DEFAULT_COLLECTIONS;
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const ignore = new Set(options.ignore ?? DEFAULT_IGNORE);
  const runtime = options.runtime ?? DEFAULT_RUNTIME;

  // Both are settled in `configResolved`, because both depend on where the
  // consumer's project is rather than on where this file ended up. Anchoring
  // either to `import.meta.url` resolves inside this package's own directory
  // under `node_modules` — which holds neither the source to scan nor the
  // consumer's `@iconify-json/*`, and under pnpm's isolated linker cannot even
  // see them.
  let sourceDir = path.resolve(options.sourceDir ?? '.');
  let resolveFromRoot = createRequire(import.meta.url);

  const collectionCache = new Map<string, IconifyJSON>();
  const loadCollection = (prefix: string): IconifyJSON => {
    let collection = collectionCache.get(prefix);
    if (!collection) {
      const jsonPath = resolveFromRoot.resolve(
        `@iconify-json/${prefix}/icons.json`
      );
      collection = JSON.parse(readFileSync(jsonPath, 'utf8')) as IconifyJSON;
      collectionCache.set(prefix, collection);
    }
    return collection;
  };

  const collectSourceFiles = async (dir: string): Promise<string[]> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          return ignore.has(entry.name) ? [] : collectSourceFiles(fullPath);
        }
        return isScannedFile(entry.name, extensions) ? [fullPath] : [];
      })
    );
    return files.flat();
  };

  const buildModule = async (): Promise<{
    code: string;
    files: string[];
    warning?: string;
  }> => {
    const files = await collectSourceFiles(sourceDir);
    const usedByPrefix = new Map<string, Set<string>>();

    await Promise.all(
      files.map(async (file) => {
        const content = await fs.readFile(file, 'utf8');
        for (const [prefix, names] of collectIconNames(content, collections)) {
          let used = usedByPrefix.get(prefix);
          if (!used) {
            used = new Set();
            usedByPrefix.set(prefix, used);
          }
          for (const name of names) {
            used.add(name);
          }
        }
      })
    );

    const subsets: IconifyJSON[] = [];
    const missing: string[] = [];
    for (const [prefix, names] of usedByPrefix) {
      const collection = loadCollection(prefix);
      const icons: Record<string, IconifyIcon> = {};
      for (const name of [...names].sort()) {
        const data = getIconData(collection, name);
        if (data === null) {
          missing.push(`${prefix}:${name}`);
          continue;
        }
        icons[name] = data;
      }
      subsets.push({ prefix, icons });
    }

    if (missing.length > 0) {
      throw new Error(
        `[iconify-bundle] Unknown icons (not found in installed collections): ${missing.join(', ')}`
      );
    }

    // An empty bundle is legal — a project may genuinely use no icons yet — but
    // it is also exactly what a `collections` list that misses the prefix the
    // source actually writes produces, and that failure is otherwise silent:
    // the module loads, registers nothing, and every icon renders as a gap. The
    // unknown-name error above cannot catch it, because a prefix outside the
    // list never reaches the scan in the first place.
    const warning =
      subsets.length === 0
        ? `[iconify-bundle] No icon literals found under ${sourceDir} for collections: ${collections.join(', ')}. Every icon will render as nothing.`
        : undefined;

    const code = [
      `import { addCollection } from ${JSON.stringify(runtime)};`,
      ...subsets.map((subset) => `addCollection(${JSON.stringify(subset)});`),
      ''
    ].join('\n');

    return { code, files, warning };
  };

  return {
    name: 'iconify-bundle',
    configResolved(config) {
      sourceDir = path.resolve(config.root, options.sourceDir ?? '.');
      resolveFromRoot = createRequire(path.join(config.root, 'package.json'));
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_ID) {
        return undefined;
      }
      const { code, files, warning } = await buildModule();
      for (const file of files) {
        this.addWatchFile(file);
      }
      if (warning) {
        this.warn(warning);
      }
      return code;
    },
    handleHotUpdate({ file, server }) {
      if (!isScannedFile(file, extensions)) {
        return undefined;
      }
      const module = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (module) {
        server.moduleGraph.invalidateModule(module);
        return [module];
      }
      return undefined;
    }
  };
}
