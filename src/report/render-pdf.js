import { renderText } from './render-text.js';

const PAGE_LINES = 50;
const LINE_CHARS = 88;

function ascii(value) {
  return String(value ?? '').replace(/[^\x20-\x7e]/g, '-');
}

function pdfString(value) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(line) {
  const value = ascii(line).replace(/\t/g, '    ');
  if (value.length <= LINE_CHARS) return [value];
  const output = [];
  let rest = value;
  while (rest.length > LINE_CHARS) {
    let cut = rest.lastIndexOf(' ', LINE_CHARS);
    if (cut < Math.floor(LINE_CHARS * 0.55)) cut = LINE_CHARS;
    output.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  output.push(rest);
  return output;
}

function pageStream(lines) {
  const commands = ['BT', '/F1 9 Tf', '54 748 Td', '11 TL'];
  for (const line of lines) commands.push(`(${pdfString(line)}) Tj`, 'T*');
  commands.push('ET');
  return `${commands.join('\n')}\n`;
}

function serializePdf(objects) {
  const header = '%PDF-1.4\n%CTI\n';
  let body = header;
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(body, 'latin1');
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length}\n`;
  body += '0000000000 65535 f \n';
  for (let id = 1; id < objects.length; id += 1) body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

export function renderPdf(model) {
  const sourceLines = ['CTI Enrichment Gateway', ...renderText(model).split(/\r?\n/)];
  const wrapped = sourceLines.flatMap(wrapLine);
  const pages = [];
  for (let index = 0; index < wrapped.length; index += PAGE_LINES) pages.push(wrapped.slice(index, index + PAGE_LINES));
  if (!pages.length) pages.push(['CTI Enrichment Gateway']);

  const objectCount = 3 + pages.length * 2;
  const objects = new Array(objectCount + 1);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = pages.map((_page, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    const stream = pageStream(page);
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`;
  });

  return serializePdf(objects);
}
