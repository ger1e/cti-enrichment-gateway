const SOURCE_COUNT = '38';

function scrubLegacyBootArt() {
  const ascii = document.getElementById('pepe-ascii');
  if (!ascii) return;
  ascii.replaceChildren();
  ascii.hidden = true;
  ascii.setAttribute('aria-hidden', 'true');
  ascii.removeAttribute('aria-label');
}

function normalizeSourceCount(root = document) {
  for (const node of root.querySelectorAll?.('.shell-footer-center,.shell-footer-mobile') || []) {
    if (node.textContent.includes('37 SOURCES')) node.textContent = node.textContent.replace('37 SOURCES', `${SOURCE_COUNT} SOURCES`);
    if (node.textContent.includes('37 SRC')) node.textContent = node.textContent.replace('37 SRC', `${SOURCE_COUNT} SRC`);
  }
}

function normalizeBrand(root = document) {
  scrubLegacyBootArt();
  normalizeSourceCount(root);
}

normalizeBrand();

const workspace = document.getElementById('workspace');
if (workspace && typeof MutationObserver === 'function') {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node?.nodeType === 1) normalizeSourceCount(node);
      }
    }
    normalizeSourceCount(workspace);
  });
  observer.observe(workspace, { childList: true, subtree: true });
}
