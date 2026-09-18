const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function download(name, mime, text) {
  const blob = new Blob(["\ufeff" + text], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

export function exportCSV(filename, columns, rows) {
  const head = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(",")).join("\n");
  download(`${filename}.csv`, "text/csv;charset=utf-8", `${head}\n${body}`);
}

export function exportExcel(filename, columns, rows) {
  const th = columns.map((c) => `<th>${c.label}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${r[c.key] ?? ""}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></body></html>`;
  download(`${filename}.xls`, "application/vnd.ms-excel", html);
}

export function exportPDF(title, columns, rows, meta = "") {
  const th = columns.map((c) => `<th>${c.label}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${columns.map((c) => `<td>${r[c.key] ?? ""}</td>`).join("")}</tr>`)
    .join("");
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${title}</title><style>
    body{font-family:'IBM Plex Sans',Arial,sans-serif;padding:18px;color:#111820}
    h1{font-size:18px;margin:0 0 4px} .m{color:#69747F;font-size:12px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#0B5C4E;color:#fff;text-align:left;padding:6px}
    td{border-bottom:1px solid #E3E7EB;padding:6px}
  </style></head><body><h1>${title}</h1><div class="m">${meta}</div>
  <table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
