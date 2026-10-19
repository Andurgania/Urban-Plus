// Reglas de negocio puras (no modifican la base de datos)
import type { Campana, Categoria, Cliente, DB, Pedido, Producto, Usuario, Venta, Zona } from './types';
import { CATEGORIAS } from './types';
import { addDays, claveMes, diasEntre } from './format';

export const stockTotal = (p: Producto) => Object.values(p.stock).reduce((a, b) => a + b, 0);

export function estadoStock(p: Producto): 'sin_stock' | 'critico' | 'bajo' | 'ok' {
  const s = stockTotal(p);
  if (s <= 0) return 'sin_stock';
  if (s <= p.umbralCritico) return 'critico';
  if (s < p.umbralMin) return 'bajo';
  return 'ok';
}

export const ventasValidas = (db: DB) => db.ventas.filter((v) => v.estado === 'confirmada');

// ---------- Segmentación de clientes (RF25) ----------
export interface ResumenCliente {
  compras: number;
  monto: number;
  ultima?: string;
  categoria: Categoria;
}

export function resumenCliente(db: DB, clienteId: string, ventas = ventasValidas(db)): ResumenCliente {
  const desde = addDays(new Date(), -365).toISOString();
  const propias = ventas.filter((v) => v.clienteId === clienteId);
  const anio = propias.filter((v) => v.fecha >= desde);
  const monto = anio.reduce((a, v) => a + v.total, 0);
  const compras = anio.length;
  const ultima = propias.reduce<string | undefined>((m, v) => (!m || v.fecha > m ? v.fecha : m), undefined);
  return { compras, monto, ultima, categoria: categoriaPara(db, monto, compras) };
}

export function categoriaPara(db: DB, monto: number, compras: number): Categoria {
  const c = db.config.categorias;
  for (const cat of ['Premium', 'Diamante', 'Plata'] as Categoria[]) {
    if (monto >= c[cat].monto && compras >= c[cat].compras) return cat;
  }
  return 'Bronce';
}

export function mapaCategorias(db: DB): Record<string, ResumenCliente> {
  const ventas = ventasValidas(db);
  const out: Record<string, ResumenCliente> = {};
  for (const cl of db.clientes) out[cl.id] = resumenCliente(db, cl.id, ventas);
  return out;
}

/** Categoría que tenía cada cliente al cierre de un mes (para la evolución mensual, RF32) */
export function categoriaAlCierre(db: DB, clienteId: string, finMes: Date): Categoria | null {
  const fin = finMes.toISOString();
  const ini = addDays(finMes, -365).toISOString();
  const cl = db.clientes.find((c) => c.id === clienteId);
  if (!cl || cl.creado > fin) return null;
  const vs = db.ventas.filter((v) => v.estado === 'confirmada' && v.clienteId === clienteId && v.fecha <= fin && v.fecha >= ini);
  return categoriaPara(db, vs.reduce((a, v) => a + v.total, 0), vs.length);
}

// ---------- Campañas (RF26, RF27) ----------
export function estadoCampana(c: Campana, ahora = new Date().toISOString()): 'pendiente' | 'rechazada' | 'programada' | 'activa' | 'finalizada' {
  if (c.estadoAprobacion === 'pendiente') return 'pendiente';
  if (c.estadoAprobacion === 'rechazada') return 'rechazada';
  if (ahora < c.desde) return 'programada';
  if (ahora > c.hasta) return 'finalizada';
  return 'activa';
}

/** Mejor descuento de campaña activa que corresponde al cliente según su categoría */
export function descuentoCampana(db: DB, clienteId: string): { campana?: Campana; porcentaje: number; categoria: Categoria } {
  const cat = resumenCliente(db, clienteId).categoria;
  let mejor: Campana | undefined;
  let pctMejor = 0;
  for (const c of db.campanas) {
    if (estadoCampana(c) !== 'activa') continue;
    if (c.tipo === 'reactivacion' && !c.clientesObjetivo?.includes(clienteId)) continue;
    const p = c.descuentos[cat] ?? 0;
    if (p > pctMejor) {
      pctMejor = p;
      mejor = c;
    }
  }
  return { campana: mejor, porcentaje: pctMejor, categoria: cat };
}

// ---------- Despacho (RF01, RF01-B, RF07, RF08) ----------
export function zonaDeComuna(db: DB, comuna: string): Zona | undefined {
  const c = comuna.trim().toLowerCase();
  return db.zonas.find((z) => z.activa && z.comunas.some((x) => x.toLowerCase() === c));
}

export function costoEnvio(db: DB, zona: Zona | undefined, subtotal: number) {
  if (!zona) return { costo: 0, gratis: false, valido: false };
  if (subtotal >= db.config.envioGratisDesde) return { costo: 0, gratis: true, valido: true };
  return { costo: zona.tarifa, gratis: false, valido: true };
}

/** Rango estimado de entrega según zona y carga operacional (pedidos aún no despachados) */
export function fechaEstimada(db: DB, zona: Zona, desde = new Date()) {
  const pendientes = db.pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'preparacion').length;
  const extra = pendientes > 25 ? 2 : pendientes > 12 ? 1 : 0;
  const saltarDomingo = (d: Date) => (d.getDay() === 0 ? addDays(d, 1) : d);
  return {
    desde: saltarDomingo(addDays(desde, zona.diasMin + extra)).toISOString(),
    hasta: saltarDomingo(addDays(desde, zona.diasMax + extra)).toISOString(),
    extra,
  };
}

export function cargaRepartidor(db: DB, repartidorId: string) {
  return db.pedidos.filter((p) => p.repartidorId === repartidorId && (p.estado === 'preparacion' || p.estado === 'en_ruta' || p.estado === 'incidencia')).length;
}

/** HU09-B: sugiere el repartidor disponible con menos carga que cubre la zona */
export function sugerirRepartidor(db: DB, pedido: Pedido): Usuario | undefined {
  const candidatos = db.usuarios.filter((u) => u.rol === 'repartidor' && u.activo && !u.bloqueado && u.disponible !== false);
  const enZona = candidatos.filter((u) => u.zonas?.includes(pedido.zonaId));
  const lista = enZona.length ? enZona : candidatos;
  return [...lista].sort((a, b) => cargaRepartidor(db, a.id) - cargaRepartidor(db, b.id))[0];
}

// ---------- Sugerencias de productos (caso de negocio) ----------
export function sugerenciasPara(db: DB, clienteId: string | undefined, n = 4): Producto[] {
  const activos = db.productos.filter((p) => p.activo && stockTotal(p) > 0);
  const vendidos: Record<string, number> = {};
  for (const v of ventasValidas(db)) for (const it of v.items) vendidos[it.productoId] = (vendidos[it.productoId] ?? 0) + it.cantidad;
  const porPopularidad = (a: Producto, b: Producto) => (vendidos[b.id] ?? 0) - (vendidos[a.id] ?? 0);
  if (!clienteId) return [...activos].sort(porPopularidad).slice(0, n);

  const propias = ventasValidas(db).filter((v) => v.clienteId === clienteId);
  const comprados = new Set(propias.flatMap((v) => v.items.map((i) => i.productoId)));
  const pesoLinea: Record<string, number> = {};
  const pesoColor: Record<string, number> = {};
  for (const v of propias)
    for (const it of v.items) {
      const p = db.productos.find((x) => x.id === it.productoId);
      if (!p) continue;
      pesoLinea[p.linea] = (pesoLinea[p.linea] ?? 0) + it.cantidad;
      pesoColor[p.color] = (pesoColor[p.color] ?? 0) + 1;
    }
  const score = (p: Producto) => (pesoLinea[p.linea] ?? 0) * 3 + (pesoColor[p.color] ?? 0) + (vendidos[p.id] ?? 0) / 50;
  return activos
    .filter((p) => !comprados.has(p.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

export function motivoSugerencia(db: DB, clienteId: string | undefined, p: Producto) {
  if (!clienteId) return 'De lo más vendido';
  const lineas = ventasValidas(db)
    .filter((v) => v.clienteId === clienteId)
    .flatMap((v) => v.items.map((i) => db.productos.find((x) => x.id === i.productoId)?.linea));
  return lineas.includes(p.linea) ? `Porque compras ${p.linea.toLowerCase()}` : 'Combina con tus compras';
}

// ---------- Clientes inactivos (RF30) ----------
export function clientesInactivos(db: DB) {
  const hoy = new Date();
  const mapa = mapaCategorias(db);
  return db.clientes
    .filter((c) => !c.anonimizado)
    .map((c) => ({ cliente: c, resumen: mapa[c.id], dias: mapa[c.id].ultima ? diasEntre(mapa[c.id].ultima!, hoy) : diasEntre(c.creado, hoy) }))
    .filter((x) => x.dias >= db.config.diasClienteInactivo);
}

// ---------- Ventas y productos (RF29, RF31) ----------
export function ventasPorProducto(ventas: Venta[]) {
  const out: Record<string, { unidades: number; monto: number; costo: number }> = {};
  for (const v of ventas)
    for (const it of v.items) {
      const r = (out[it.productoId] ??= { unidades: 0, monto: 0, costo: 0 });
      r.unidades += it.cantidad;
      r.monto += it.cantidad * it.precioUnit;
      r.costo += it.cantidad * it.costoUnit;
    }
  return out;
}

export function ventasEnRango(db: DB, desde: string, hasta: string) {
  return ventasValidas(db).filter((v) => v.fecha >= desde && v.fecha <= hasta);
}

// ---------- Finanzas (RF55, RF60, RF61, RF65, RF66) ----------
export function totalesPartidas(db: DB, desde: string, hasta: string) {
  let ingresos = 0;
  let egresos = 0;
  const porCat: Record<string, number> = {};
  for (const p of db.partidas) {
    if (p.fecha < desde || p.fecha > hasta) continue;
    if (p.tipo === 'ingreso') ingresos += p.monto;
    else egresos += p.monto;
    porCat[p.categoria] = (porCat[p.categoria] ?? 0) + p.monto;
  }
  return { ingresos, egresos, margen: ingresos - egresos, margenPct: ingresos ? ((ingresos - egresos) / ingresos) * 100 : 0, porCat };
}

export function mesesDisponibles(db: DB) {
  const set = new Set(db.partidas.map((p) => claveMes(p.fecha)));
  return [...set].sort();
}

export function rangoDeMes(clave: string) {
  const [y, m] = clave.split('-').map(Number);
  const ini = new Date(y, m - 1, 1, 0, 0, 0);
  const fin = new Date(y, m, 0, 23, 59, 59, 999);
  return { desde: ini.toISOString(), hasta: fin.toISOString() };
}

export function alertaEgresos(db: DB, clave: string) {
  const { desde, hasta } = rangoDeMes(clave);
  const t = totalesPartidas(db, desde, hasta);
  const pctEgresos = t.ingresos ? (t.egresos / t.ingresos) * 100 : 0;
  return { ...t, pctEgresos, supera: pctEgresos > db.config.umbralEgresosPct };
}

export function categoriasOrdenadas() {
  return CATEGORIAS;
}

export function clientePorId(db: DB, id?: string): Cliente | undefined {
  return db.clientes.find((c) => c.id === id);
}
export function usuarioPorId(db: DB, id?: string): Usuario | undefined {
  return db.usuarios.find((u) => u.id === id);
}
export function nombreUsuario(db: DB, id?: string) {
  if (!id) return '—';
  if (id === 'sistema') return 'Sistema';
  return usuarioPorId(db, id)?.nombre ?? '—';
}
export function nombreCliente(db: DB, id?: string) {
  const c = clientePorId(db, id);
  if (!c) return '—';
  return c.anonimizado ? 'Cliente anonimizado' : c.nombre;
}
