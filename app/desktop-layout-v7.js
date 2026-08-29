const DESKTOP_LAYOUT_HREF = '/app/desktop-layout-v7.css';

function ensureDesktopLayout() {
  if (document.querySelector(`link[href="${DESKTOP_LAYOUT_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = DESKTOP_LAYOUT_HREF;
  link.dataset.para11axDesktopLayout = 'v7';
  document.head.append(link);
}

ensureDesktopLayout();

export { DESKTOP_LAYOUT_HREF, ensureDesktopLayout };
