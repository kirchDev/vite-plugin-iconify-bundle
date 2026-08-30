// Ambient, deliberately: this file carries no top-level import or export, so
// `declare module` reads as an ambient declaration rather than an augmentation
// of a module that has to exist already. The Vite virtual module below has no
// file on disk, so an augmentation cannot resolve it — TypeScript 6 rejects a
// side-effect import of one with TS2882.
//
// Adding an `import` or `export` anywhere in this file turns it into a module
// and silently breaks every consumer's type-check. There is no test that can
// catch that here; the comment is the guard.

/** Served by `iconifyBundlePlugin`; registers the bundled icon collections. */
declare module 'virtual:iconify-bundle';
