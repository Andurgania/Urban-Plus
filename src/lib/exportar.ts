// Exportación de reportes: Excel (.xlsx real, generado en el navegador) y PDF (vía impresión del navegador)

type Celda = string | number | null | undefined;

// ---------- ZIP mínimo (sin compresión) ----------
const tablaCRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = tablaCRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(archivos: { nombre: string; datos: string }[]): Blob {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre);
    const datos = enc.encode(a.datos);
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true);
    local.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(local.buffer), nombre, datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, datos.length, true);
    cen.setUint32(24, datos.length, true);
    cen.setUint16(28, nombre.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nombre);
    offset += 30 + nombre.length + datos.length;
  }
  const tamCentral = central.reduce((a, b) => a + b.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function colLetra(i: number) {
  let s = '';
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export interface Hoja {
  nombre: string;
  titulo?: string;
  encabezados: string[];
  filas: Celda[][];
}

export function descargarExcel(nombreArchivo: string, hojas: Hoja[]) {
  const hojasXml = hojas.map((h) => {
    const filas: string[] = [];
    let r = 1;
    if (h.titulo) {
      filas.push(`<row r="${r}"><c r="A${r}" t="inlineStr" s="1"><is><t>${escXml(h.titulo)}</t></is></c></row>`);
      r += 2;
    }
    const celda = (v: Celda, c: number, estilo = 0) => {
      const ref = `${colLetra(c)}${r}`;
      if (v === null || v === undefined || v === '') return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}/>`;
      if (typeof v === 'number') return `<c r="${ref}"${estilo ? ` s="${estilo}"` : ''}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ''}><is><t xml:space="preserve">${escXml(String(v))}</t></is></c>`;
    };
    filas.push(`<row r="${r}">${h.encabezados.map((e, c) => celda(e, c, 2)).join('')}</row>`);
    r++;
    for (const f of h.filas) {
      filas.push(`<row r="${r}">${f.map((v, c) => celda(v, c)).join('')}</row>`);
      r++;
    }
    const anchos = h.encabezados.map((e, c) => {
      const max = Math.max(e.length, ...h.filas.slice(0, 200).map((f) => String(f[c] ?? '').length));
      return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, Math.max(10, max + 2))}" customWidth="1"/>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${anchos.join('')}</cols><sheetData>${filas.join('')}</sheetData></worksheet>`;
  });
  const nombresHoja = hojas.map((h, i) => escXml(h.nombre.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Hoja${i + 1}`));
  const archivos = [
    { nombre: '[Content_Types].xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { nombre: '_rels/.rels', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: 'xl/workbook.xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombresHoja.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { nombre: 'xl/styles.xml', datos: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF8A2D5F"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...hojasXml.map((x, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, datos: x })),
  ];
  descargarBlob(zip(archivos), nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`);
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Abre el diálogo de impresión del navegador, donde se elige "Guardar como PDF". Solo se imprime el área marcada. */
export function exportarPDF(titulo: string) {
  const prev = document.title;
  document.title = titulo;
  document.body.classList.add('imprimiendo');
  setTimeout(() => {
    window.print();
    document.body.classList.remove('imprimiendo');
    document.title = prev;
  }, 50);
}
