const PREPAINT_STYLES = Object.freeze([
  '/app/shell.css',
  '/app/shell-polish.css',
  '/app/analyst-deck.css',
  '/app/earth-globe.css',
  '/brand-unification.css',
  '/site-cursor.css',
]);

for (const href of PREPAINT_STYLES) {
  if (document.querySelector(`link[href="${href}"]`)) continue;
  const marker = document.createElement('link');
  marker.rel = 'preload';
  marker.as = 'style';
  marker.href = href;
  marker.dataset.prepaintMarker = 'true';
  document.head.append(marker);
}

await import('./terminal-entry.js');
await import('./terminal-polish.js');
await import('./analyst-deck.js');
await import('./earth-globe.js');
await import('../brand-unification.js');
