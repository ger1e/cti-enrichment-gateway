function cell(value) {
  const text = String(value ?? '');
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function renderObservablesCsv(model) {
  const rows = ['type,value'];
  for (const item of model.observables) rows.push(`${cell(item.type)},${cell(item.value)}`);
  return `${rows.join('\n')}\n`;
}
