document.documentElement.dataset.terminalFirst = 'v7';

const favicon = document.querySelector('link[rel~="icon"]') ?? document.head.appendChild(document.createElement('link'));
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = '/favicon.svg';

await import('./terminal-entry.js');
await import('./case-shell-bridge.js');
await import('./earth-globe.js');
await import('./terminal-polish.js');
await import('./analyst-deck.js');
await import('../brand-unification.js');
await import('./brand-final.js');