function cell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function renderObservablesCsv(model) {
  const rows = ['type,value'];
  for (const item of model.observables) rows.push(`${cell(item.type)},${cell(item.value)}`);
  return `${rows.join('\n')}\n`;
}
