// Estado global de la demo: base de datos en memoria + persistencia en el navegador (localStorage).
// Todas las acciones que modifican datos pasan por `commit`, que además deja registro en el log de auditoría.
import { useSyncExternalStore } from 'react';
import type {
  AlertaStock, Campana, Categoria, Cliente, DB, EstadoPedido, ItemVenta, LogEntry, MedioPago, Movimiento, Notificacion,
  Partida, Pedido, Producto, Proveedor, Rol, TipoIncidencia, TipoLog, Turno, Ubicacion, Usuario, Venta, Zona, Canal, Promocion,
} from './types';
import { crearSeed, DB_VERSION } from './seed';
import { addDays, claveMes, dia, diasEntre, hashClave, limpiarRut, uid, validarRut, clp } from './format';
import { costoEnvio, descuentoCampana, estadoCampana, fechaEstimada, rangoDeMes, stockTotal, totalesPartidas } from './logica';
import { moduloDeRuta } from './permisos';

const KEY_DB = 'urbanplus-db';
const KEY_SESION = 'urbanplus-sesion';
const KEY_CARRITO = 'urbanplus-carrito';

function leerLS<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}
function guardarLS(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* sin almacenamiento disponible: la demo sigue funcionando en memoria */
  }
}

// La sesión vive en sessionStorage (una por pestaña): así se puede tener al cliente en una pestaña y al
// repartidor en otra, compartiendo la misma base de datos y viendo los cambios en tiempo real.
function leerSesion(): Sesion | null {
  try {
    const s = sessionStorage.getItem(KEY_SESION);
    return s ? (JSON.parse(s) as Sesion) : null;
  } catch {
    return null;
  }
}
function guardarSesion(v: Sesion | null) {
  try {
    if (v) sessionStorage.setItem(KEY_SESION, JSON.stringify(v));
    else sessionStorage.removeItem(KEY_SESION);
  } catch {
    /* sin almacenamiento */
  }
}

function cargarDB(): DB {
  const guardada = leerLS<DB>(KEY_DB);
  if (guardada && guardada.version === DB_VERSION) return guardada;
  const nueva = crearSeed();
  guardarLS(KEY_DB, nueva);
  return nueva;
}

let db: DB = cargarDB();
mantenimiento(db);
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());

// Sincroniza entre pestañas: lo que hace el repartidor en una pestaña se ve en la otra sin recargar (RF02, RNF31)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_DB && e.newValue) {
      try {
        db = JSON.parse(e.newValue);
        emitir();
      } catch {
        /* ignorar */
      }
    }
    if (e.key === KEY_CARRITO) {
      carrito = leerLS<ItemCarrito[]>(KEY_CARRITO) ?? [];
      emitir();
    }
  });
}

export function getDB() {
  return db;
}

function suscribir(cb: () => void) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

export function useDB(): DB {
  return useSyncExternalStore(suscribir, () => db, () => db);
}

/** Aplica cambios sobre una copia, persiste y notifica. Si el mutador lanza un error, no se guarda nada (RNF25). */
export function commit<T>(mutador: (d: DB) => T): T {
  const copia: DB = structuredClone(db);
  const res = mutador(copia);
  db = copia;
  guardarLS(KEY_DB, db);
  emitir();
  return res;
}

export class ErrorNegocio extends Error {}
const fallar = (msg: string): never => {
  throw new ErrorNegocio(msg);
};

/** Ejecuta una acción y devuelve { ok, error } en vez de lanzar */
export function intentar<T>(fn: () => T): { ok: true; valor: T } | { ok: false; error: string } {
  try {
    return { ok: true, valor: fn() };
  } catch (e) {
    if (e instanceof ErrorNegocio) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: 'No se pudo completar la operación. Intenta de nuevo.' };
  }
}

export function reiniciarDemo() {
  db = crearSeed();
  guardarLS(KEY_DB, db);
  sesion = null;
  guardarSesion(null);
  carrito = [];
  guardarLS(KEY_CARRITO, []);
  emitir();
}

// ===================== Sesión =====================
export interface Sesion {
  usuarioId: string;
  inicio: string;
  actividad: string;
}
let sesion: Sesion | null = leerSesion();

export function useSesion() {
  const s = useSyncExternalStore(suscribir, () => sesion, () => sesion);
  const d = useDB();
  const usuario = s ? d.usuarios.find((u) => u.id === s.usuarioId) : undefined;
  return { sesion: s, usuario };
}
export const sesionActual = () => sesion;
export const usuarioActual = (): Usuario | undefined => (sesion ? db.usuarios.find((u) => u.id === sesion!.usuarioId) : undefined);
const actorId = () => sesion?.usuarioId ?? 'sistema';

function log(d: DB, tipo: TipoLog, modulo: string, accion: string, detalle: string, usuarioId = actorId()) {
  const e: LogEntry = { id: uid('lg'), fecha: new Date().toISOString(), usuarioId, tipo, modulo, accion, detalle };
  d.logs.push(e);
}

function notificar(d: DB, destino: Notificacion['destino'], titulo: string, texto: string) {
  d.notificaciones.push({ id: uid('nt'), fecha: new Date().toISOString(), destino, titulo, texto, leida: false });
}

export function login(identificador: string, clave: string): { ok: true; usuario: Usuario } | { ok: false; error: string } {
  const idn = identificador.trim().toLowerCase();
  const u = db.usuarios.find((x) => x.usuario.toLowerCase() === idn || x.email.toLowerCase() === idn);
  if (!u) return { ok: false, error: 'No encontramos un usuario con ese nombre o correo.' };
  if (!u.activo) return { ok: false, error: 'Esta cuenta está desactivada. Contacta al administrador TI.' };
  if (u.bloqueado) return { ok: false, error: `Cuenta bloqueada (${u.motivoBloqueo ?? 'seguridad'}). El administrador TI debe reactivarla.` };
  // RF43: bloqueo por inactividad
  if (u.rol !== 'cliente' && diasEntre(u.ultimoAcceso, new Date()) > db.config.diasBloqueoCuenta) {
    commit((d) => {
      const x = d.usuarios.find((y) => y.id === u.id)!;
      x.bloqueado = true;
      x.motivoBloqueo = `Inactividad mayor a ${d.config.diasBloqueoCuenta} días`;
      log(d, 'accion', 'Personal y accesos', 'Bloqueo por inactividad', `Cuenta ${u.usuario} bloqueada al intentar ingresar`, 'sistema');
    });
    return { ok: false, error: 'Cuenta bloqueada por inactividad. El administrador TI debe reactivarla.' };
  }
  if (hashClave(clave) !== u.passHash) {
    const intentos = u.intentosFallidos + 1;
    const max = db.config.intentosMaximos;
    commit((d) => {
      const x = d.usuarios.find((y) => y.id === u.id)!;
      x.intentosFallidos = intentos;
      if (intentos >= max) {
        x.bloqueado = true;
        x.motivoBloqueo = `${max} intentos fallidos`;
        log(d, 'sesion', 'Sesión', 'Cuenta bloqueada', `${max} intentos fallidos de inicio de sesión`, u.id);
        notificar(d, { rol: 'ti' }, 'Cuenta bloqueada por intentos fallidos', `${u.nombre} (${u.usuario}) superó los ${max} intentos.`);
      } else log(d, 'sesion', 'Sesión', 'Intento fallido', `Contraseña incorrecta (${intentos}/${max})`, u.id);
    });
    return intentos >= max
      ? { ok: false, error: `Cuenta bloqueada tras ${max} intentos fallidos. El administrador TI debe reactivarla.` }
      : { ok: false, error: `Contraseña incorrecta. Te quedan ${max - intentos} intentos.` };
  }
  const ahora = new Date().toISOString();
  commit((d) => {
    const x = d.usuarios.find((y) => y.id === u.id)!;
    x.intentosFallidos = 0;
    x.ultimoAcceso = ahora;
    log(d, 'sesion', 'Sesión', 'Inicio de sesión', 'Ingreso desde navegador web', u.id);
  });
  sesion = { usuarioId: u.id, inicio: ahora, actividad: ahora };
  guardarSesion(sesion);
  emitir();
  return { ok: true, usuario: u };
}

export function logout(motivo = 'Cierre de sesión') {
  if (sesion) {
    const uidA = sesion.usuarioId;
    commit((d) => log(d, 'sesion', 'Sesión', motivo, motivo === 'Cierre de sesión' ? 'El usuario cerró sesión' : 'Sesión cerrada por inactividad', uidA));
  }
  sesion = null;
  guardarSesion(null);
  emitir();
}

export function tocarActividad() {
  if (!sesion) return;
  sesion = { ...sesion, actividad: new Date().toISOString() };
  guardarSesion(sesion);
}

let ultimaRuta = '';
export function registrarNavegacion(path: string, titulo: string) {
  if (!sesion || path === ultimaRuta) return;
  ultimaRuta = path;
  commit((d) => log(d, 'navegacion', moduloDeRuta(path), `Visitó ${titulo}`, path));
}
export function registrarAccesoDenegado(path: string) {
  if (!sesion) return;
  commit((d) => log(d, 'acceso_denegado', moduloDeRuta(path), 'Acceso denegado', `Intentó abrir ${path} sin permiso para su rol`));
}

export function solicitarCambioClave(identificador: string) {
  const idn = identificador.trim().toLowerCase();
  const u = db.usuarios.find((x) => x.usuario.toLowerCase() === idn || x.email.toLowerCase() === idn);
  if (!u) return { ok: false as const, error: 'No encontramos ese usuario o correo.' };
  if (db.solicitudes.some((s) => s.usuarioId === u.id && s.estado === 'pendiente')) return { ok: false as const, error: 'Ya hay una solicitud pendiente para esta cuenta.' };
  commit((d) => {
    d.solicitudes.push({ id: uid('sc'), usuarioId: u.id, fecha: new Date().toISOString(), estado: 'pendiente' });
    log(d, 'accion', 'Personal y accesos', 'Solicitud de cambio de clave', `Usuario ${u.usuario}`, u.id);
    notificar(d, { rol: 'ti' }, 'Nueva solicitud de cambio de clave', `${u.nombre} pidió restablecer su contraseña.`);
  });
  return { ok: true as const };
}

// ===================== Carrito (tienda web) =====================
export interface ItemCarrito {
  productoId: string;
  talla: string;
  cantidad: number;
}
let carrito: ItemCarrito[] = leerLS<ItemCarrito[]>(KEY_CARRITO) ?? [];
export function useCarrito() {
  return useSyncExternalStore(suscribir, () => carrito, () => carrito);
}
function setCarrito(c: ItemCarrito[]) {
  carrito = c;
  guardarLS(KEY_CARRITO, c);
  emitir();
}
export function agregarAlCarrito(productoId: string, talla: string, cantidad = 1) {
  const p = db.productos.find((x) => x.id === productoId);
  if (!p) return { ok: false, error: 'Producto no encontrado' };
  const enCarro = carrito.filter((i) => i.productoId === productoId).reduce((a, i) => a + i.cantidad, 0);
  if (enCarro + cantidad > stockTotal(p)) return { ok: false, error: `Solo quedan ${stockTotal(p)} unidades de este producto.` };
  const ex = carrito.find((i) => i.productoId === productoId && i.talla === talla);
  setCarrito(ex ? carrito.map((i) => (i === ex ? { ...i, cantidad: i.cantidad + cantidad } : i)) : [...carrito, { productoId, talla, cantidad }]);
  return { ok: true };
}
export function cambiarCantidadCarrito(idx: number, cantidad: number) {
  if (cantidad <= 0) setCarrito(carrito.filter((_, i) => i !== idx));
  else setCarrito(carrito.map((it, i) => (i === idx ? { ...it, cantidad } : it)));
}
export function vaciarCarrito() {
  setCarrito([]);
}

// ===================== Stock =====================
function evaluarStock(d: DB, productoId: string) {
  const p = d.productos.find((x) => x.id === productoId);
  if (!p) return;
  const total = stockTotal(p);
  const activa = d.alertas.find((a) => a.productoId === p.id && a.estado === 'activa');
  if (total < p.umbralMin && !activa) {
    const al: AlertaStock = { id: uid('al'), productoId: p.id, fecha: new Date().toISOString(), stock: total, estado: 'activa' };
    d.alertas.push(al);
    notificar(d, { rol: 'bodega' }, 'Stock bajo el umbral', `${p.nombre} (${p.color}) quedó en ${total} unidades.`);
  }
  if (total >= p.umbralMin && activa) activa.estado = 'resuelta';
  if (activa && total < p.umbralMin) activa.stock = total;
  // RF53: orden de reposición automática al llegar al umbral crítico
  const abierta = d.reposiciones.find((o) => o.productoId === p.id && o.estado !== 'recibida');
  if (total <= p.umbralCritico && !abierta) {
    const cantidad = Math.max(p.umbralMin * 3 - total, 12);
    d.reposiciones.push({ id: uid('or'), folio: d.contadores.reposicion++, fecha: new Date().toISOString(), productoId: p.id, proveedorId: p.proveedorId, cantidad, estado: 'generada', automatica: true });
    log(d, 'accion', 'Inventario', 'Orden de reposición automática', `${p.nombre}: ${cantidad} unidades (stock ${total})`, 'sistema');
  }
}

/** Descuenta stock desde las ubicaciones, empezando por Pasillo A */
function descontarStock(d: DB, productoId: string, cantidad: number, motivo: string) {
  const p = d.productos.find((x) => x.id === productoId)!;
  let resto = cantidad;
  for (const ub of d.ubicaciones) {
    if (resto <= 0) break;
    const disp = p.stock[ub.id] ?? 0;
    const usa = Math.min(disp, resto);
    if (usa > 0) {
      p.stock[ub.id] = disp - usa;
      resto -= usa;
      d.movimientos.push({ id: uid('mv'), fecha: new Date().toISOString(), productoId, ubicacionId: ub.id, tipo: 'venta', cantidad: -usa, motivo, usuarioId: actorId() });
    }
  }
  if (resto > 0) fallar(`Stock insuficiente para ${p.nombre}.`);
}

// ===================== Ventas (RF13–RF24) =====================
export interface DatosVenta {
  clienteId: string;
  items: ItemVenta[];
  canal: Canal;
  origen: Venta['origen'];
  medio: MedioPago;
  montoRecibido?: number;
  nroOperacion?: string;
  tarjeta?: string;
  promoId?: string;
  cotizacionId?: string;
  direccion?: { direccion: string; comuna: string };
}

export function calcularTotales(d: DB, clienteId: string, items: ItemVenta[], promoId?: string, comuna?: string) {
  const subtotal = items.reduce((a, i) => a + i.precioUnit * i.cantidad, 0);
  const cl = d.clientes.find((c) => c.id === clienteId);
  const camp = clienteId ? descuentoCampana(d, clienteId) : { porcentaje: 0, campana: undefined, categoria: 'Bronce' as Categoria };
  const descCampana = Math.round((subtotal * camp.porcentaje) / 100);
  const promo = promoId ? d.promociones.find((p) => p.id === promoId && p.activa) : undefined;
  const descPromo = promo ? Math.round(((subtotal - descCampana) * promo.porcentaje) / 100) : 0;
  const zona = d.zonas.find((z) => z.activa && z.comunas.some((x) => x.toLowerCase() === (comuna ?? cl?.comuna ?? '').toLowerCase()));
  const env = costoEnvio(d, zona, subtotal - descCampana - descPromo);
  const total = subtotal - descCampana - descPromo + env.costo;
  return { subtotal, descCampana, campana: camp.campana, pctCampana: camp.porcentaje, categoria: camp.categoria, promo, descPromo, zona, envio: env.costo, envioGratis: env.gratis, envioValido: env.valido, total };
}

export function crearVenta(datos: DatosVenta): Venta {
  return commit((d) => {
    if (!datos.items.length) fallar('La venta no tiene productos.');
    const cl = d.clientes.find((c) => c.id === datos.clienteId) ?? fallar('Selecciona un cliente.');
    for (const it of datos.items) {
      const p = d.productos.find((x) => x.id === it.productoId) ?? fallar('Producto no encontrado.');
      const s = stockTotal(p);
      if (s <= 0) fallar(`${p.nombre} no tiene stock. No se puede vender (RF51).`);
      if (it.cantidad > s) fallar(`Stock insuficiente: ${p.nombre} tiene ${s} unidades disponibles.`);
    }
    const comuna = datos.direccion?.comuna ?? cl.comuna;
    const t = calcularTotales(d, cl.id, datos.items, datos.promoId, comuna);
    if (!t.zona) fallar(`La comuna ${comuna} no pertenece a ninguna zona de despacho.`);
    if (datos.medio === 'efectivo') {
      if ((datos.montoRecibido ?? 0) < t.total) fallar('El monto recibido es menor al total de la venta.');
    }
    if (datos.medio === 'transferencia' && !datos.nroOperacion?.trim()) fallar('Ingresa el número de operación de la transferencia.');
    const ahora = new Date();
    const vId = uid('v');
    const pId = uid('pd');
    const venta: Venta = {
      id: vId, folio: d.contadores.folio++, boleta: d.contadores.boleta++, fecha: ahora.toISOString(), canal: datos.canal, origen: datos.origen,
      vendedorId: datos.origen === 'vendedor' ? actorId() : undefined, clienteId: cl.id,
      items: datos.items.map((i) => ({ ...i })), subtotal: t.subtotal, descCampana: t.descCampana, campanaId: t.descCampana ? t.campana?.id : undefined,
      descPromo: t.descPromo, promoId: t.promo?.id, envio: t.envio, total: t.total,
      pago: {
        medio: datos.medio, estado: 'aprobado', montoRecibido: datos.montoRecibido, vuelto: datos.medio === 'efectivo' ? (datos.montoRecibido ?? 0) - t.total : undefined,
        nroOperacion: datos.nroOperacion, tarjeta: datos.tarjeta,
      },
      estado: 'confirmada', pedidoId: pId, cotizacionId: datos.cotizacionId,
    };
    d.ventas.push(venta);
    for (const it of datos.items) {
      descontarStock(d, it.productoId, it.cantidad, `Venta folio ${venta.folio}`);
      evaluarStock(d, it.productoId);
    }
    const est = fechaEstimada(d, t.zona!, ahora);
    const pedido: Pedido = {
      id: pId, nro: `UP-${d.contadores.pedido++}`, ventaId: vId, clienteId: cl.id, direccion: datos.direccion?.direccion ?? cl.direccion, comuna, zonaId: t.zona!.id,
      estado: 'pendiente', historial: [{ estado: 'pendiente', fecha: ahora.toISOString(), usuarioId: actorId() }], estimadoDesde: est.desde, estimadoHasta: est.hasta, incidencias: [],
    };
    d.pedidos.push(pedido);
    // RF63: ingreso automático en finanzas
    d.partidas.push({ id: uid('pt'), fecha: ahora.toISOString(), tipo: 'ingreso', categoria: 'Ventas', descripcion: `Venta folio ${venta.folio} (${datos.medio})`, monto: venta.total, ventaId: vId, usuarioId: 'sistema', conciliada: false, notas: [] });
    if (datos.cotizacionId) {
      const c = d.cotizaciones.find((x) => x.id === datos.cotizacionId);
      if (c) {
        c.estado = 'convertida';
        c.ventaId = vId;
      }
    }
    notificar(d, { clienteId: cl.id }, `Compra confirmada · boleta N° ${venta.boleta}`, `Recibimos tu pedido ${pedido.nro}. Total ${clp(venta.total)}.`);
    log(d, 'accion', 'Ventas y pagos', 'Registró venta', `Folio ${venta.folio} · ${clp(venta.total)} · ${datos.medio} · canal ${datos.canal}`);
    return venta;
  });
}

export function registrarPagoRechazado(clienteId: string, total: number) {
  commit((d) => log(d, 'accion', 'Ventas y pagos', 'Pago con tarjeta rechazado', `Cliente ${d.clientes.find((c) => c.id === clienteId)?.nombre ?? ''} · ${clp(total)} · la venta no se confirmó`));
}

/** RF17: solo un administrador autoriza la anulación y debe registrar la razón */
export function anularVenta(ventaId: string, motivo: string) {
  return commit((d) => {
    const yo = d.usuarios.find((u) => u.id === actorId());
    if (yo?.rol !== 'area') fallar('Solo un Administrador de Área puede autorizar anulaciones.');
    if (!motivo.trim()) fallar('Escribe el motivo de la anulación.');
    const v = d.ventas.find((x) => x.id === ventaId) ?? fallar('Venta no encontrada.');
    if (v.estado === 'anulada') fallar('Esta venta ya está anulada.');
    const ped = d.pedidos.find((p) => p.id === v.pedidoId);
    if (ped && (ped.estado === 'en_ruta' || ped.estado === 'entregado')) fallar('El pedido ya salió a reparto. Para estos casos usa una devolución.');
    v.estado = 'anulada';
    v.anulacion = { motivo: motivo.trim(), autorizadaPor: actorId(), fecha: new Date().toISOString() };
    for (const it of v.items) {
      const p = d.productos.find((x) => x.id === it.productoId)!;
      p.stock.u1 = (p.stock.u1 ?? 0) + it.cantidad;
      d.movimientos.push({ id: uid('mv'), fecha: new Date().toISOString(), productoId: p.id, ubicacionId: 'u1', tipo: 'devolucion', cantidad: it.cantidad, motivo: `Anulación venta folio ${v.folio}`, usuarioId: actorId() });
      evaluarStock(d, p.id);
    }
    if (ped) d.pedidos = d.pedidos.filter((p) => p.id !== ped.id);
    v.pedidoId = undefined;
    d.partidas.push({ id: uid('pt'), fecha: new Date().toISOString(), tipo: 'ingreso', categoria: 'Ventas', descripcion: `Reverso por anulación de venta folio ${v.folio}`, monto: -v.total, ventaId: v.id, usuarioId: 'sistema', conciliada: false, notas: [] });
    log(d, 'accion', 'Ventas y pagos', 'Autorizó anulación', `Venta folio ${v.folio}: ${motivo.trim()}`);
  });
}

export function crearCotizacion(clienteId: string, items: ItemVenta[], vigenciaDias: number) {
  return commit((d) => {
    if (!items.length) fallar('Agrega al menos un producto.');
    if (vigenciaDias < 1) fallar('La vigencia debe ser de al menos 1 día.');
    const t = calcularTotales(d, clienteId, items);
    const c = { id: uid('ct'), folio: d.contadores.cotizacion++, fecha: new Date().toISOString(), vendedorId: actorId(), clienteId, items, envio: t.envio, total: t.subtotal + t.envio, vigenciaDias, estado: 'vigente' as const };
    d.cotizaciones.push(c);
    log(d, 'accion', 'Ventas y pagos', 'Emitió cotización', `Cotización N° ${c.folio} · ${clp(c.total)} · vigencia ${vigenciaDias} días`);
    return c;
  });
}
export function anularCotizacion(id: string) {
  commit((d) => {
    const c = d.cotizaciones.find((x) => x.id === id)!;
    c.estado = 'anulada';
    log(d, 'accion', 'Ventas y pagos', 'Anuló cotización', `Cotización N° ${c.folio}`);
  });
}

export function registrarDevolucion(ventaId: string, items: { productoId: string; cantidad: number }[], tipo: 'nota_credito' | 'reembolso', motivo: string) {
  return commit((d) => {
    const v = d.ventas.find((x) => x.id === ventaId) ?? fallar('Venta no encontrada.');
    if (v.estado !== 'confirmada') fallar('Solo se pueden devolver ventas confirmadas.');
    if (!motivo.trim()) fallar('Indica el motivo de la devolución.');
    const sel = items.filter((i) => i.cantidad > 0);
    if (!sel.length) fallar('Selecciona al menos una prenda a devolver.');
    const previas = d.devoluciones.filter((x) => x.ventaId === v.id);
    const det = sel.map((i) => {
      const it = v.items.find((x) => x.productoId === i.productoId)!;
      const yaDevuelto = previas.flatMap((x) => x.items).filter((x) => x.productoId === i.productoId).reduce((a, x) => a + x.cantidad, 0);
      if (i.cantidad + yaDevuelto > it.cantidad) fallar(`No puedes devolver más unidades de ${it.nombre} de las que se vendieron.`);
      const factor = v.subtotal ? (v.subtotal - v.descCampana - v.descPromo) / v.subtotal : 1;
      return { productoId: i.productoId, nombre: it.nombre, cantidad: i.cantidad, monto: Math.round(it.precioUnit * i.cantidad * factor) };
    });
    const monto = det.reduce((a, x) => a + x.monto, 0);
    const dev = { id: uid('dv'), ventaId, fecha: new Date().toISOString(), items: det, tipo, monto, motivo: motivo.trim(), usuarioId: actorId(), folioNC: tipo === 'nota_credito' ? d.contadores.nc++ : undefined };
    d.devoluciones.push(dev);
    for (const x of det) {
      const p = d.productos.find((y) => y.id === x.productoId)!;
      p.stock.u2 = (p.stock.u2 ?? 0) + x.cantidad;
      d.movimientos.push({ id: uid('mv'), fecha: dev.fecha, productoId: p.id, ubicacionId: 'u2', tipo: 'devolucion', cantidad: x.cantidad, motivo: `Devolución venta folio ${v.folio}`, usuarioId: actorId() });
      evaluarStock(d, p.id);
    }
    d.partidas.push({ id: uid('pt'), fecha: dev.fecha, tipo: 'egreso', categoria: 'Otros', descripcion: `Devolución (${tipo === 'reembolso' ? 'reembolso' : `nota de crédito N° ${dev.folioNC}`}) venta folio ${v.folio}`, monto, usuarioId: actorId(), conciliada: false, notas: [] });
    notificar(d, { clienteId: v.clienteId }, tipo === 'reembolso' ? 'Reembolso en proceso' : `Nota de crédito N° ${dev.folioNC}`, `Procesamos tu devolución por ${clp(monto)}.`);
    log(d, 'accion', 'Ventas y pagos', 'Registró devolución', `Venta folio ${v.folio} · ${tipo === 'reembolso' ? 'reembolso' : 'nota de crédito'} · ${clp(monto)} · ${motivo}`);
    return dev;
  });
}

export function ventasDeTurno(d: DB, turnoId: string, fechaDia = dia()) {
  const t = d.turnos.find((x) => x.id === turnoId)!;
  return d.ventas.filter((v) => {
    if (dia(v.fecha) !== fechaDia) return false;
    const hh = new Date(v.fecha);
    const hm = `${String(hh.getHours()).padStart(2, '0')}:${String(hh.getMinutes()).padStart(2, '0')}`;
    return hm >= t.inicio && hm < t.fin;
  });
}

export function cerrarCaja(turnoId: string) {
  return commit((d) => {
    const hoy = dia();
    if (d.cierres.some((c) => c.turnoId === turnoId && dia(c.fecha) === hoy)) fallar('Este turno ya tiene cierre de caja hoy.');
    const vs = ventasDeTurno(d, turnoId, hoy);
    const ok = vs.filter((v) => v.estado === 'confirmada');
    const porMedio = { tarjeta: 0, transferencia: 0, efectivo: 0 } as Record<MedioPago, number>;
    ok.forEach((v) => (porMedio[v.pago.medio] += v.total));
    const c = { id: uid('cj'), fecha: new Date().toISOString(), turnoId, usuarioId: actorId(), ventas: ok.length, porMedio, total: ok.reduce((a, v) => a + v.total, 0), anuladas: vs.length - ok.length };
    d.cierres.push(c);
    log(d, 'accion', 'Ventas y pagos', 'Cierre de caja', `Turno ${d.turnos.find((t) => t.id === turnoId)?.nombre} · ${ok.length} ventas · ${clp(c.total)}`);
    return c;
  });
}

export function guardarPromocion(p: Omit<Promocion, 'id' | 'autorizadaPor'> & { id?: string }) {
  commit((d) => {
    if (!p.nombre.trim()) fallar('Ponle un nombre a la promoción.');
    if (p.porcentaje <= 0 || p.porcentaje > 60) fallar('El descuento debe estar entre 1% y 60%.');
    const ex = p.id ? d.promociones.find((x) => x.id === p.id) : undefined;
    if (ex) Object.assign(ex, { nombre: p.nombre, porcentaje: p.porcentaje, activa: p.activa });
    else d.promociones.push({ id: uid('pr'), nombre: p.nombre, porcentaje: p.porcentaje, activa: p.activa, autorizadaPor: actorId() });
    log(d, 'accion', 'Ventas y pagos', ex ? 'Editó promoción' : 'Autorizó promoción', `${p.nombre} (${p.porcentaje}%) ${p.activa ? 'activa' : 'inactiva'}`);
  });
}

// ===================== Despacho (RF01–RF12) =====================
export function asignarPedido(pedidoId: string, repartidorId: string) {
  commit((d) => {
    const p = d.pedidos.find((x) => x.id === pedidoId) ?? fallar('Pedido no encontrado.');
    const r = d.usuarios.find((u) => u.id === repartidorId) ?? fallar('Repartidor no encontrado.');
    if (r.disponible === false) fallar(`${r.nombre} está marcado como no disponible.`);
    if (p.estado !== 'pendiente') fallar('Solo se asignan pedidos pendientes. Para cambiar el repartidor usa "Reasignar".');
    p.repartidorId = r.id;
    p.estado = 'preparacion';
    p.historial.push({ estado: 'preparacion', fecha: new Date().toISOString(), usuarioId: actorId(), nota: `Asignado a ${r.nombre}` });
    notificar(d, { usuarioId: r.id }, 'Nuevo pedido asignado', `${p.nro} · ${p.comuna}`);
    log(d, 'accion', 'Despacho', 'Asignó pedido', `Pedido ${p.nro} asignado a ${r.nombre}`);
  });
}

export function reasignarPedido(pedidoId: string, repartidorId: string, motivo: string) {
  commit((d) => {
    const yo = d.usuarios.find((u) => u.id === actorId());
    if (yo?.rol !== 'area') fallar('Solo el Administrador de Área puede reasignar pedidos.');
    if (!motivo.trim()) fallar('Indica por qué se reasigna el pedido.');
    const p = d.pedidos.find((x) => x.id === pedidoId) ?? fallar('Pedido no encontrado.');
    if (p.estado === 'entregado') fallar('El pedido ya fue entregado.');
    const r = d.usuarios.find((u) => u.id === repartidorId) ?? fallar('Repartidor no encontrado.');
    if (r.id === p.repartidorId) fallar('El pedido ya está asignado a ese repartidor.');
    const anterior = d.usuarios.find((u) => u.id === p.repartidorId)?.nombre ?? 'sin repartidor';
    p.repartidorId = r.id;
    if (p.estado === 'incidencia' || p.estado === 'pendiente') p.estado = 'preparacion';
    p.historial.push({ estado: p.estado, fecha: new Date().toISOString(), usuarioId: actorId(), nota: `Reasignado de ${anterior} a ${r.nombre}: ${motivo}` });
    notificar(d, { usuarioId: r.id }, 'Pedido reasignado a ti', `${p.nro} · ${p.comuna}`);
    log(d, 'accion', 'Despacho', 'Reasignó pedido', `Pedido ${p.nro}: ${anterior} → ${r.nombre} (${motivo})`);
  });
}

const NOMBRE_ESTADO: Record<EstadoPedido, string> = { pendiente: 'Pendiente', preparacion: 'En preparación', en_ruta: 'En ruta', entregado: 'Entregado', incidencia: 'Con incidencia' };
export const nombreEstado = (e: EstadoPedido) => NOMBRE_ESTADO[e];

export function salirARuta(pedidoId: string) {
  commit((d) => {
    const p = d.pedidos.find((x) => x.id === pedidoId) ?? fallar('Pedido no encontrado.');
    if (p.repartidorId !== actorId()) fallar('Solo puedes actualizar tus pedidos.');
    if (p.estado !== 'preparacion' && p.estado !== 'incidencia') fallar('El pedido no está listo para salir a ruta.');
    p.estado = 'en_ruta';
    p.historial.push({ estado: 'en_ruta', fecha: new Date().toISOString(), usuarioId: actorId() });
    // RF05: aviso al cliente
    notificar(d, { clienteId: p.clienteId }, `Tu pedido ${p.nro} va en camino`, 'El repartidor ya salió con tu pedido. Puedes seguirlo en tiempo real.');
    log(d, 'accion', 'Despacho', 'Pedido en ruta', `Pedido ${p.nro}`);
  });
}

export function confirmarEntrega(pedidoId: string, receptor: string, evidencia?: 'foto' | 'firma', evidenciaData?: string) {
  commit((d) => {
    const p = d.pedidos.find((x) => x.id === pedidoId) ?? fallar('Pedido no encontrado.');
    if (p.repartidorId !== actorId()) fallar('Solo puedes actualizar tus pedidos.');
    if (p.estado !== 'en_ruta') fallar('El pedido debe estar en ruta para confirmar la entrega.');
    if (!receptor.trim()) fallar('Escribe el nombre de quien recibe.');
    const ahora = new Date().toISOString();
    p.estado = 'entregado';
    p.entrega = { fecha: ahora, receptor: receptor.trim(), evidencia, evidenciaData };
    p.historial.push({ estado: 'entregado', fecha: ahora, usuarioId: actorId(), nota: `Recibió ${receptor.trim()}` });
    notificar(d, { clienteId: p.clienteId }, `Pedido ${p.nro} entregado`, `Lo recibió ${receptor.trim()}.`);
    log(d, 'accion', 'Despacho', 'Confirmó entrega', `Pedido ${p.nro} · recibió ${receptor.trim()}${evidencia ? ` · evidencia: ${evidencia}` : ''}`);
  });
}

export const NOMBRE_INCIDENCIA: Record<TipoIncidencia, string> = { direccion: 'Dirección incorrecta', ausente: 'Cliente ausente', danado: 'Producto dañado' };

export function registrarIncidencia(pedidoId: string, tipo: TipoIncidencia, comentario: string) {
  commit((d) => {
    const p = d.pedidos.find((x) => x.id === pedidoId) ?? fallar('Pedido no encontrado.');
    const yo = d.usuarios.find((u) => u.id === actorId());
    if (yo?.rol === 'repartidor' && p.repartidorId !== yo.id) fallar('Solo puedes actualizar tus pedidos.');
    if (p.estado === 'entregado') fallar('El pedido ya fue entregado.');
    const ahora = new Date().toISOString();
    p.incidencias.push({ id: uid('inc'), tipo, comentario: comentario.trim(), fecha: ahora, usuarioId: actorId(), resuelta: false });
    p.estado = 'incidencia';
    p.historial.push({ estado: 'incidencia', fecha: ahora, usuarioId: actorId(), nota: NOMBRE_INCIDENCIA[tipo] });
    notificar(d, { clienteId: p.clienteId }, `Tuvimos un problema con tu pedido ${p.nro}`, `${NOMBRE_INCIDENCIA[tipo]}. Te contactaremos para resolverlo.`);
    notificar(d, { rol: 'ejecutivo' }, `Incidencia en pedido ${p.nro}`, `${NOMBRE_INCIDENCIA[tipo]}: ${comentario}`);
    log(d, 'accion', 'Despacho', 'Registró incidencia', `Pedido ${p.nro} · ${NOMBRE_INCIDENCIA[tipo]} · ${comentario}`);
  });
}

export function resolverIncidencia(pedidoId: string, nota: string) {
  commit((d) => {
    const p = d.pedidos.find((x) => x.id === pedidoId) ?? fallar('Pedido no encontrado.');
    if (!nota.trim()) fallar('Describe cómo se resolvió.');
    p.incidencias.forEach((i) => (i.resuelta = true));
    p.estado = p.repartidorId ? 'preparacion' : 'pendiente';
    p.historial.push({ estado: p.estado, fecha: new Date().toISOString(), usuarioId: actorId(), nota: `Incidencia resuelta: ${nota}` });
    log(d, 'accion', 'Despacho', 'Resolvió incidencia', `Pedido ${p.nro}: ${nota}`);
  });
}

export function guardarZona(z: Zona) {
  commit((d) => {
    if (!z.nombre.trim()) fallar('La zona necesita un nombre.');
    if (z.tarifa < 0) fallar('La tarifa no puede ser negativa.');
    if (z.diasMin > z.diasMax) fallar('Los días mínimos no pueden ser mayores que los máximos.');
    const comunas = z.comunas.map((c) => c.trim()).filter(Boolean);
    for (const c of comunas) {
      const otra = d.zonas.find((x) => x.id !== z.id && x.comunas.some((y) => y.toLowerCase() === c.toLowerCase()));
      if (otra) fallar(`La comuna ${c} ya pertenece a la zona ${otra.nombre}.`);
    }
    const ex = d.zonas.find((x) => x.id === z.id);
    if (ex) Object.assign(ex, { ...z, comunas });
    else d.zonas.push({ ...z, id: uid('z'), comunas });
    log(d, 'accion', 'Despacho', ex ? 'Editó zona' : 'Creó zona', `${z.nombre} · tarifa ${clp(z.tarifa)} (aplica a ventas nuevas)`);
  });
}

export function guardarConfig(parcial: Partial<DB['config']>, detalle: string) {
  commit((d) => {
    d.config = { ...d.config, ...parcial };
    log(d, 'accion', 'Configuración', 'Cambió configuración', detalle);
  });
}

export function cambiarDisponibilidad(repartidorId: string, disponible: boolean) {
  commit((d) => {
    const r = d.usuarios.find((u) => u.id === repartidorId)!;
    r.disponible = disponible;
    log(d, 'accion', 'Despacho', 'Cambió disponibilidad', `${r.nombre}: ${disponible ? 'disponible' : 'no disponible'}`);
  });
}

// ===================== Clientes y campañas (RF25–RF33) =====================
export function guardarCliente(c: Cliente) {
  return commit((d) => {
    if (!c.nombre.trim()) fallar('Ingresa el nombre.');
    if (!validarRut(c.rut)) fallar('El RUT no es válido.');
    if (d.clientes.some((x) => x.id !== c.id && limpiarRut(x.rut) === limpiarRut(c.rut))) fallar('Ya existe un cliente con ese RUT.');
    if (!/^\S+@\S+\.\S+$/.test(c.email)) fallar('El correo no es válido.');
    if (c.tipo === 'empresa' && !c.razonSocial?.trim()) fallar('Ingresa la razón social de la empresa.');
    const zona = d.zonas.find((z) => z.comunas.some((x) => x.toLowerCase() === c.comuna.trim().toLowerCase()));
    if (!zona) fallar(`No despachamos a ${c.comuna}. Revisa la comuna o agrégala a una zona.`);
    const ex = d.clientes.find((x) => x.id === c.id);
    const nuevo = { ...c, zonaId: zona!.id, comuna: zona!.comunas.find((x) => x.toLowerCase() === c.comuna.trim().toLowerCase())! };
    if (ex) Object.assign(ex, nuevo);
    else d.clientes.push({ ...nuevo, id: uid('c'), creado: new Date().toISOString() });
    log(d, 'accion', 'Clientes y campañas', ex ? 'Editó cliente' : 'Registró cliente', `${c.nombre} (${c.tipo === 'empresa' ? 'empresa' : 'persona natural'})`);
    return ex ?? d.clientes[d.clientes.length - 1];
  });
}

/** RNF23: eliminar o anonimizar datos personales a solicitud */
export function anonimizarCliente(id: string) {
  commit((d) => {
    const c = d.clientes.find((x) => x.id === id)!;
    const ref = c.id.slice(-4).toUpperCase();
    Object.assign(c, { nombre: `Cliente ${ref}`, razonSocial: c.razonSocial ? `Empresa ${ref}` : undefined, rut: '0-0', email: `anonimo.${ref.toLowerCase()}@anonimo.cl`, telefono: '—', direccion: 'Dato eliminado', anonimizado: true });
    log(d, 'accion', 'Clientes y campañas', 'Anonimizó cliente', `Cliente ${ref} (solicitud formal, Ley 19.628)`);
  });
}

export function guardarCampana(c: Omit<Campana, 'id' | 'creadaPor' | 'estadoAprobacion' | 'aprobadaPor'> & { id?: string }) {
  return commit((d) => {
    if (!c.nombre.trim()) fallar('Ponle nombre a la campaña.');
    if (c.hasta <= c.desde) fallar('La fecha de término debe ser posterior a la de inicio.');
    if (Object.values(c.descuentos).some((x) => x < 0 || x > 50)) fallar('Los descuentos deben estar entre 0% y 50%.');
    const ex = c.id ? d.campanas.find((x) => x.id === c.id) : undefined;
    if (ex) {
      if (estadoCampana(ex) === 'activa' || estadoCampana(ex) === 'finalizada') fallar('No se puede editar una campaña activa o finalizada.');
      Object.assign(ex, c, { estadoAprobacion: 'pendiente', aprobadaPor: undefined });
    } else d.campanas.push({ ...c, id: uid('cp'), creadaPor: actorId(), estadoAprobacion: 'pendiente' });
    notificar(d, { rol: 'gerente' }, 'Campaña pendiente de aprobación', `"${c.nombre}" necesita tu aprobación.`);
    log(d, 'accion', 'Clientes y campañas', ex ? 'Editó campaña' : 'Creó campaña', `${c.nombre} · ${c.tipo === 'reactivacion' ? 'reactivación' : 'por categoría'}`);
  });
}

export function aprobarCampana(id: string, aprobar: boolean) {
  commit((d) => {
    const yo = d.usuarios.find((u) => u.id === actorId());
    if (yo?.rol !== 'gerente') fallar('Solo el Gerente General aprueba campañas.');
    const c = d.campanas.find((x) => x.id === id)!;
    c.estadoAprobacion = aprobar ? 'aprobada' : 'rechazada';
    c.aprobadaPor = actorId();
    notificar(d, { usuarioId: c.creadaPor }, `Campaña ${aprobar ? 'aprobada' : 'rechazada'}`, `"${c.nombre}" fue ${aprobar ? 'aprobada' : 'rechazada'} por gerencia.`);
    log(d, 'accion', 'Clientes y campañas', aprobar ? 'Aprobó campaña' : 'Rechazó campaña', c.nombre);
  });
}

// ===================== Personal y accesos (RF34–RF43) =====================
export function guardarUsuario(u: Usuario, claveNueva?: string) {
  return commit((d) => {
    if (!u.nombre.trim()) fallar('Ingresa el nombre.');
    if (!validarRut(u.rut)) fallar('El RUT no es válido.');
    if (d.usuarios.some((x) => x.id !== u.id && limpiarRut(x.rut) === limpiarRut(u.rut))) fallar('Ya existe un empleado con ese RUT.');
    if (!u.usuario.trim()) fallar('Ingresa el nombre de usuario.');
    if (d.usuarios.some((x) => x.id !== u.id && x.usuario.toLowerCase() === u.usuario.toLowerCase())) fallar('Ese nombre de usuario ya está en uso.');
    const ex = d.usuarios.find((x) => x.id === u.id);
    if (ex) {
      Object.assign(ex, { ...u, passHash: claveNueva ? hashClave(claveNueva) : ex.passHash });
    } else {
      if (!claveNueva || claveNueva.length < 8) fallar('La clave inicial debe tener al menos 8 caracteres.');
      d.usuarios.push({ ...u, id: uid('u'), passHash: hashClave(claveNueva!), intentosFallidos: 0, ultimoAcceso: new Date().toISOString(), bloqueado: false });
    }
    log(d, 'accion', 'Personal y accesos', ex ? 'Editó empleado' : 'Registró empleado', `${u.nombre} · ${u.rol} · ${u.area} · acceso ${u.nivelAcceso}`);
  });
}

export function cambiarEstadoUsuario(id: string, cambios: { activo?: boolean; bloqueado?: boolean }) {
  commit((d) => {
    const u = d.usuarios.find((x) => x.id === id)!;
    if (u.id === actorId() && (cambios.activo === false || cambios.bloqueado)) fallar('No puedes desactivar tu propia cuenta.');
    if (cambios.activo !== undefined) u.activo = cambios.activo;
    if (cambios.bloqueado !== undefined) {
      u.bloqueado = cambios.bloqueado;
      if (!cambios.bloqueado) {
        u.motivoBloqueo = undefined;
        u.intentosFallidos = 0;
        u.ultimoAcceso = new Date().toISOString();
      }
    }
    const acc = cambios.activo === false ? 'Desactivó cuenta' : cambios.activo ? 'Activó cuenta' : cambios.bloqueado === false ? 'Reactivó cuenta bloqueada' : 'Bloqueó cuenta';
    log(d, 'accion', 'Personal y accesos', acc, `${u.nombre} (${u.usuario})`);
  });
}

export function resolverSolicitud(id: string, aprobar: boolean) {
  return commit((d) => {
    const s = d.solicitudes.find((x) => x.id === id)!;
    const u = d.usuarios.find((x) => x.id === s.usuarioId)!;
    s.estado = aprobar ? 'aprobada' : 'rechazada';
    s.resueltaPor = actorId();
    s.fechaResolucion = new Date().toISOString();
    let temp: string | undefined;
    if (aprobar) {
      temp = 'Urb-' + Math.random().toString(36).slice(2, 7);
      u.passHash = hashClave(temp);
      u.intentosFallidos = 0;
      if (u.motivoBloqueo?.includes('intentos')) {
        u.bloqueado = false;
        u.motivoBloqueo = undefined;
      }
      s.claveTemporal = temp;
    }
    log(d, 'accion', 'Personal y accesos', aprobar ? 'Aprobó solicitud de clave' : 'Rechazó solicitud de clave', `Usuario ${u.usuario}`);
    return temp;
  });
}

export function cambiarMiClave(actual: string, nueva: string) {
  commit((d) => {
    const u = d.usuarios.find((x) => x.id === actorId())!;
    if (hashClave(actual) !== u.passHash) fallar('La clave actual no es correcta.');
    if (nueva.length < 8) fallar('La nueva clave debe tener al menos 8 caracteres.');
    u.passHash = hashClave(nueva);
    log(d, 'accion', 'Personal y accesos', 'Cambió su clave', u.usuario);
  });
}

export function guardarTurno(t: Turno) {
  commit((d) => {
    if (!t.nombre.trim()) fallar('El turno necesita un nombre.');
    if (t.fin <= t.inicio) fallar('La hora de término debe ser posterior a la de inicio.');
    const ex = d.turnos.find((x) => x.id === t.id);
    if (ex) Object.assign(ex, t);
    else d.turnos.push({ ...t, id: uid('t') });
    log(d, 'accion', 'Personal y accesos', ex ? 'Editó turno' : 'Creó turno', `${t.nombre} ${t.inicio}–${t.fin}`);
  });
}

export function asignarTurno(usuarioId: string, diaSemana: number, turnoId: string | null) {
  commit((d) => {
    const a = d.asignaciones.find((x) => x.usuarioId === usuarioId && x.dia === diaSemana);
    if (a) a.turnoId = turnoId;
    else d.asignaciones.push({ usuarioId, dia: diaSemana, turnoId });
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    log(d, 'accion', 'Personal y accesos', 'Asignó turno', `${d.usuarios.find((u) => u.id === usuarioId)?.nombre} · ${dias[diaSemana]}: ${d.turnos.find((t) => t.id === turnoId)?.nombre ?? 'libre'}`);
  });
}

export function marcarAsistencia() {
  return commit((d) => {
    const hoy = dia();
    const ahora = new Date().toISOString();
    const a = d.asistencias.find((x) => x.usuarioId === actorId() && x.fecha === hoy);
    if (!a) {
      d.asistencias.push({ id: uid('as'), usuarioId: actorId(), fecha: hoy, entrada: ahora });
      log(d, 'accion', 'Personal y accesos', 'Marcó entrada', hoy);
      return 'entrada';
    }
    if (a.salida) fallar('Ya marcaste entrada y salida hoy.');
    a.salida = ahora;
    log(d, 'accion', 'Personal y accesos', 'Marcó salida', hoy);
    return 'salida';
  });
}

// ===================== Inventario (RF44–RF53) =====================
export function registrarMovimiento(m: { productoId: string; ubicacionId: string; tipo: 'ingreso' | 'salida' | 'ajuste'; cantidad: number; motivo: string; destinoId?: string }) {
  commit((d) => {
    const p = d.productos.find((x) => x.id === m.productoId) ?? fallar('Selecciona un producto.');
    if (!Number.isFinite(m.cantidad) || m.cantidad === 0) fallar('La cantidad debe ser distinta de cero.');
    if (!m.motivo.trim()) fallar(m.tipo === 'ajuste' ? 'Los ajustes requieren una justificación.' : 'Indica el motivo o documento del movimiento.');
    const disp = p.stock[m.ubicacionId] ?? 0;
    let delta = m.tipo === 'ingreso' ? Math.abs(m.cantidad) : m.tipo === 'salida' ? -Math.abs(m.cantidad) : m.cantidad;
    if (disp + delta < 0) fallar(`No puedes sacar más de lo que hay: ${disp} unidades en esa ubicación.`);
    p.stock[m.ubicacionId] = disp + delta;
    const mov: Movimiento = { id: uid('mv'), fecha: new Date().toISOString(), productoId: p.id, ubicacionId: m.ubicacionId, tipo: m.tipo, cantidad: delta, motivo: m.motivo.trim(), usuarioId: actorId() };
    d.movimientos.push(mov);
    evaluarStock(d, p.id);
    log(d, 'accion', 'Inventario', m.tipo === 'ingreso' ? 'Registró ingreso' : m.tipo === 'salida' ? 'Registró salida' : 'Ajuste de inventario', `${p.nombre}: ${delta > 0 ? '+' : ''}${delta} · ${m.motivo}`);
    delta = 0;
  });
}

export function trasladarStock(productoId: string, desde: string, hasta: string, cantidad: number) {
  commit((d) => {
    const p = d.productos.find((x) => x.id === productoId) ?? fallar('Selecciona un producto.');
    if (desde === hasta) fallar('Elige ubicaciones distintas.');
    if (cantidad <= 0) fallar('La cantidad debe ser mayor a cero.');
    if ((p.stock[desde] ?? 0) < cantidad) fallar(`Solo hay ${p.stock[desde] ?? 0} unidades en el origen.`);
    p.stock[desde] -= cantidad;
    p.stock[hasta] = (p.stock[hasta] ?? 0) + cantidad;
    const nd = d.ubicaciones.find((u) => u.id === desde)!.nombre;
    const nh = d.ubicaciones.find((u) => u.id === hasta)!.nombre;
    const f = new Date().toISOString();
    d.movimientos.push({ id: uid('mv'), fecha: f, productoId, ubicacionId: desde, tipo: 'traslado', cantidad: -cantidad, motivo: `Traslado a ${nh}`, usuarioId: actorId() });
    d.movimientos.push({ id: uid('mv'), fecha: f, productoId, ubicacionId: hasta, tipo: 'traslado', cantidad, motivo: `Traslado desde ${nd}`, usuarioId: actorId() });
    log(d, 'accion', 'Inventario', 'Trasladó stock', `${p.nombre}: ${cantidad} de ${nd} a ${nh}`);
  });
}

export function guardarProducto(p: Producto) {
  commit((d) => {
    if (!p.nombre.trim()) fallar('El producto necesita un nombre.');
    if (p.precio <= 0) fallar('El precio debe ser mayor a cero.');
    if (p.umbralMin < 0 || p.umbralCritico < 0) fallar('El umbral no puede ser negativo.');
    if (p.umbralCritico > p.umbralMin) fallar('El umbral crítico no puede ser mayor que el mínimo.');
    if (d.productos.some((x) => x.id !== p.id && x.sku.toLowerCase() === p.sku.toLowerCase())) fallar('Ya existe un producto con ese código.');
    const ex = d.productos.find((x) => x.id === p.id);
    if (ex) {
      const cambioUmbral = ex.umbralMin !== p.umbralMin || ex.umbralCritico !== p.umbralCritico;
      Object.assign(ex, p);
      log(d, 'accion', 'Inventario', cambioUmbral ? 'Configuró umbral' : 'Editó producto', `${p.nombre}${cambioUmbral ? ` · mínimo ${p.umbralMin}, crítico ${p.umbralCritico}` : ''}`);
    } else {
      d.productos.push({ ...p, id: uid('p') });
      log(d, 'accion', 'Inventario', 'Creó producto', `${p.sku} ${p.nombre}`);
    }
    evaluarStock(d, ex?.id ?? d.productos[d.productos.length - 1].id);
  });
}

export function guardarProveedor(p: Proveedor) {
  commit((d) => {
    if (!p.nombre.trim()) fallar('Ingresa el nombre del proveedor.');
    if (p.email && !/^\S+@\S+\.\S+$/.test(p.email)) fallar('El correo no es válido.');
    const ex = d.proveedores.find((x) => x.id === p.id);
    if (ex) Object.assign(ex, p);
    else d.proveedores.push({ ...p, id: uid('pv') });
    log(d, 'accion', 'Inventario', ex ? 'Editó proveedor' : 'Registró proveedor', p.nombre);
  });
}

export function guardarUbicacion(u: Ubicacion) {
  commit((d) => {
    if (!u.nombre.trim()) fallar('La ubicación necesita un nombre.');
    const ex = d.ubicaciones.find((x) => x.id === u.id);
    if (ex) Object.assign(ex, u);
    else {
      const nueva = { ...u, id: uid('u') };
      d.ubicaciones.push(nueva);
      d.productos.forEach((p) => (p.stock[nueva.id] = 0));
    }
    log(d, 'accion', 'Inventario', ex ? 'Editó ubicación' : 'Creó ubicación', u.nombre);
  });
}

export function avanzarReposicion(id: string) {
  commit((d) => {
    const o = d.reposiciones.find((x) => x.id === id)!;
    const p = d.productos.find((x) => x.id === o.productoId)!;
    if (o.estado === 'generada') {
      o.estado = 'enviada';
      log(d, 'accion', 'Inventario', 'Envió orden de reposición', `OR ${o.folio} · ${p.nombre}`);
    } else if (o.estado === 'enviada') {
      o.estado = 'recibida';
      p.stock.u1 = (p.stock.u1 ?? 0) + o.cantidad;
      d.movimientos.push({ id: uid('mv'), fecha: new Date().toISOString(), productoId: p.id, ubicacionId: 'u1', tipo: 'ingreso', cantidad: o.cantidad, motivo: `Recepción orden de reposición ${o.folio}`, usuarioId: actorId() });
      d.partidas.push({ id: uid('pt'), fecha: new Date().toISOString(), tipo: 'egreso', categoria: 'Proveedores', descripcion: `Orden de reposición ${o.folio} · ${p.nombre}`, monto: o.cantidad * p.costo, usuarioId: actorId(), conciliada: false, notas: [] });
      evaluarStock(d, p.id);
      log(d, 'accion', 'Inventario', 'Recibió orden de reposición', `OR ${o.folio} · ${p.nombre} +${o.cantidad}`);
    }
  });
}

export function crearReposicionManual(productoId: string, cantidad: number) {
  commit((d) => {
    const p = d.productos.find((x) => x.id === productoId) ?? fallar('Selecciona un producto.');
    if (cantidad <= 0) fallar('La cantidad debe ser mayor a cero.');
    d.reposiciones.push({ id: uid('or'), folio: d.contadores.reposicion++, fecha: new Date().toISOString(), productoId, proveedorId: p.proveedorId, cantidad, estado: 'generada', automatica: false });
    log(d, 'accion', 'Inventario', 'Creó orden de reposición', `${p.nombre}: ${cantidad} unidades`);
  });
}

// ===================== Finanzas (RF54–RF67) =====================
export function crearPartida(p: Omit<Partida, 'id' | 'usuarioId' | 'conciliada' | 'notas'>) {
  commit((d) => {
    if (!p.descripcion.trim()) fallar('Agrega una descripción.');
    if (!(p.monto > 0)) fallar('El monto debe ser mayor a cero.');
    d.partidas.push({ ...p, id: uid('pt'), usuarioId: actorId(), conciliada: false, notas: [] });
    log(d, 'accion', 'Finanzas', p.tipo === 'ingreso' ? 'Registró ingreso' : 'Registró egreso', `${p.categoria} · ${p.descripcion} · ${clp(p.monto)}`);
  });
}

export function agregarNota(partidaId: string, texto: string) {
  commit((d) => {
    if (!texto.trim()) fallar('Escribe la nota.');
    const p = d.partidas.find((x) => x.id === partidaId)!;
    p.notas.push({ autorId: actorId(), fecha: new Date().toISOString(), texto: texto.trim() });
    log(d, 'accion', 'Finanzas', 'Agregó nota a partida', `${p.descripcion}: ${texto.trim()}`);
  });
}

export function conciliar(partidaId: string, movBancoId: string) {
  commit((d) => {
    const p = d.partidas.find((x) => x.id === partidaId)!;
    const b = d.banco.find((x) => x.id === movBancoId)!;
    const montoP = p.tipo === 'ingreso' ? p.monto : -p.monto;
    if (Math.abs(montoP - b.monto) > 1) fallar(`Los montos no coinciden: sistema ${clp(montoP)} y banco ${clp(b.monto)}.`);
    p.conciliada = true;
    p.movBancoId = b.id;
    b.partidaId = p.id;
    log(d, 'accion', 'Finanzas', 'Concilió partida', `${p.descripcion} ↔ ${b.descripcion} (${clp(b.monto)})`);
  });
}

export function deshacerConciliacion(partidaId: string) {
  commit((d) => {
    const p = d.partidas.find((x) => x.id === partidaId)!;
    const b = d.banco.find((x) => x.id === p.movBancoId);
    p.conciliada = false;
    p.movBancoId = undefined;
    if (b) b.partidaId = undefined;
    log(d, 'accion', 'Finanzas', 'Deshizo conciliación', p.descripcion);
  });
}

export function generarReporte(nombre: string, periodo: string) {
  return commit((d) => {
    const { desde, hasta } = rangoDeMes(periodo);
    const t = totalesPartidas(d, desde, hasta);
    const r = { id: uid('rp'), nombre: nombre.trim() || 'Reporte financiero', tipo: 'manual' as const, periodo, creado: new Date().toISOString(), creadoPor: actorId(), ingresos: t.ingresos, egresos: t.egresos, margen: t.margen, archivado: false };
    d.reportes.push(r);
    log(d, 'accion', 'Finanzas', 'Generó reporte financiero', `${r.nombre} · ${periodo}`);
    return r;
  });
}

/** RF57: los reportes no se eliminan, solo se archivan con fecha de cierre */
export function archivarReporte(id: string) {
  commit((d) => {
    const r = d.reportes.find((x) => x.id === id)!;
    r.archivado = true;
    r.fechaCierre = new Date().toISOString();
    log(d, 'accion', 'Finanzas', 'Archivó reporte', `${r.nombre} · ${r.periodo}`);
  });
}

// ===================== Notificaciones =====================
export function notificacionesPara(d: DB, u?: Usuario) {
  if (!u) return [];
  return d.notificaciones
    .filter((n) => n.destino.usuarioId === u.id || n.destino.rol === u.rol || (u.clienteId && n.destino.clienteId === u.clienteId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
export function marcarLeidas(ids: string[]) {
  if (!ids.length) return;
  commit((d) => d.notificaciones.forEach((n) => ids.includes(n.id) && (n.leida = true)));
}

// ===================== Mantenimiento al abrir la app =====================
/** Tareas automáticas: resumen financiero mensual al cierre de cada mes (RF59) y bloqueo por inactividad (RF43) */
function mantenimiento(d: DB) {
  let cambio = false;
  const hoy = new Date();
  const mesAnterior = claveMes(dia(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)));
  if (!d.reportes.some((r) => r.tipo === 'resumen_mensual' && r.periodo === mesAnterior)) {
    const { desde, hasta } = rangoDeMes(mesAnterior);
    const t = totalesPartidas(d, desde, hasta);
    d.reportes.push({ id: uid('rp'), nombre: 'Resumen financiero mensual', tipo: 'resumen_mensual', periodo: mesAnterior, creado: new Date().toISOString(), creadoPor: 'sistema', ingresos: t.ingresos, egresos: t.egresos, margen: t.margen, archivado: false });
    cambio = true;
  }
  for (const u of d.usuarios) {
    if (u.rol === 'cliente' || u.bloqueado || !u.activo) continue;
    if (diasEntre(u.ultimoAcceso, hoy) > d.config.diasBloqueoCuenta) {
      u.bloqueado = true;
      u.motivoBloqueo = `Inactividad mayor a ${d.config.diasBloqueoCuenta} días`;
      d.logs.push({ id: uid('lg'), fecha: hoy.toISOString(), usuarioId: 'sistema', tipo: 'accion', modulo: 'Personal y accesos', accion: 'Bloqueo por inactividad', detalle: `Cuenta ${u.usuario} bloqueada automáticamente` });
      cambio = true;
    }
  }
  if (cambio) guardarLS(KEY_DB, d);
}

export { addDays, stockTotal };
export type { Rol };
