// The bare side-effect import. It has no exports — it registers the icon
// collections the plugin found into the Iconify runtime named by `runtime` in
// vite.config.ts, so `<iconify-icon>` resolves them without a network request.
import 'iconify-icon';
import 'virtual:iconify-bundle';

// Every name below is a quoted `prefix:name` literal, which is exactly what the
// plugin scans this file for. Nothing else registers them, and nothing else
// needs to: add a name here and it is in the next build.
const ICONS = ['lucide:house', 'lucide:mail', 'lucide:circle-check-big'];

// Note the icon name in this comment — `lucide:phone` — reaches the bundle too.
// The scan is a text search, not a parse, and that is deliberate: see the
// README. A name misspelled anywhere under `sourceDir`, prose included, fails
// the build instead of rendering as an empty box.

document.querySelector('#app')!.innerHTML = ICONS.map(
  (icon) => `<iconify-icon icon="${icon}" width="32"></iconify-icon>`
).join('');
