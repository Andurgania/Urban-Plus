// Utilidades de formato (moneda CLP, fechas en formato chileno, RUT)

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export const clp = (n: number) => clpFmt.format(Math.round(n || 0));
export const num = (n: number) => numFmt.format(Math.round(n || 0));
export const pct = (n: number, d = 0) => `${(n || 0).toFixed(d).replace('.', ',')}%`;

const pad = (n: number) => String(n).padStart(2, '0');

export function fecha(iso?: string) {
  if (!iso) return '—';
  if (iso.length === 10) {
    const [y, m, dd] = iso.split('-');
    return `${dd}-${m}-${y}`;
  }
  const d = new Date(iso);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}
export function hora(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fechaHora = (iso?: string) => (iso ? `${fecha(iso)} ${hora(iso)}` : '—');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const mesNombre = (m: number) => MESES[m];
export const mesCorto = (m: number) => MESES_C[m];
export function fechaLarga(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}
/** yyyy-mm */
export const claveMes = (iso: string) => (iso.length <= 10 ? iso.slice(0, 7) : dia(iso).slice(0, 7));
export function nombreMes(clave: string) {
  const [y, m] = clave.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}
export function nombreMesCorto(clave: string) {
  const [y, m] = clave.split('-').map(Number);
  return `${MESES_C[m - 1]} ${String(y).slice(2)}`;
}
/** yyyy-mm-dd en hora local */
export function dia(d: Date | string = new Date()) {
  if (typeof d === 'string' && d.length === 10) return d;
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export function addDays(d: Date | string, n: number) {
  const x = new Date(typeof d === 'string' ? d : d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}
export function diasEntre(a: string | Date, b: string | Date) {
  const A = new Date(a).getTime();
  const B = new Date(b).getTime();
  return Math.floor((B - A) / 86400000);
}
export function haceTiempo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

// ---------- RUT ----------
export function limpiarRut(rut: string) {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}
export function dvRut(cuerpo: string) {
  let suma = 0;
  let mul = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? 'K' : String(r);
}
export function validarRut(rut: string) {
  const c = limpiarRut(rut);
  if (c.length < 8) return false;
  return dvRut(c.slice(0, -1)) === c.slice(-1);
}
export function formatoRut(rut: string) {
  const c = limpiarRut(rut);
  if (c.length < 2) return rut;
  const cuerpo = c.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${c.slice(-1)}`;
}
export function rutDesdeNumero(n: number) {
  const s = String(n);
  return formatoRut(s + dvRut(s));
}

// ---------- ids y hash ----------
let seq = 0;
export function uid(prefijo = 'id') {
  seq = (seq + 1) % 1e6;
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${seq.toString(36)}`;
}

/**
 * Hash de contraseñas para el prototipo. En el sistema real se usa bcrypt en el servidor (RNF01);
 * aquí se simula con un hash salado para no guardar contraseñas en texto plano.
 */
export function hashClave(clave: string) {
  const s = `urbanplus$${clave}$salt`;
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return '$2b$' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function enmascarar(texto: string) {
  if (!texto) return '';
  return texto.slice(0, 2) + '•'.repeat(Math.max(3, texto.length - 4)) + texto.slice(-2);
}
