// Modelo de datos de Urban Plus

export type Rol =
  | 'cliente'
  | 'repartidor'
  | 'vendedor'
  | 'bodega'
  | 'area'
  | 'ejecutivo'
  | 'contador'
  | 'gerente'
  | 'ti';

export type Categoria = 'Bronce' | 'Plata' | 'Diamante' | 'Premium';
export const CATEGORIAS: Categoria[] = ['Bronce', 'Plata', 'Diamante', 'Premium'];

export type LineaProducto = 'Poleras' | 'Blazers' | 'Pantalones' | 'Parkas' | 'Chaquetas' | 'Trajes de baño';
export const LINEAS: LineaProducto[] = ['Poleras', 'Blazers', 'Pantalones', 'Parkas', 'Chaquetas', 'Trajes de baño'];

export type MedioPago = 'tarjeta' | 'transferencia' | 'efectivo';
export type Canal = 'web' | 'movil';

export type EstadoPedido = 'pendiente' | 'preparacion' | 'en_ruta' | 'entregado' | 'incidencia';
export const ESTADOS_PEDIDO: EstadoPedido[] = ['pendiente', 'preparacion', 'en_ruta', 'entregado', 'incidencia'];

export type TipoIncidencia = 'direccion' | 'ausente' | 'danado';

export interface Zona {
  id: string;
  nombre: string;
  region: string;
  comunas: string[];
  tarifa: number;
  diasMin: number;
  diasMax: number;
  activa: boolean;
}

export interface Ubicacion {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  pais: string;
  ciudad: string;
  contacto: string;
  email: string;
  telefono: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  linea: LineaProducto;
  color: string;
  colorHex: string;
  tallas: string[];
  precio: number;
  costo: number;
  stock: Record<string, number>; // ubicacionId -> unidades
  umbralMin: number;
  umbralCritico: number;
  proveedorId: string;
  activo: boolean;
}

export interface Cliente {
  id: string;
  tipo: 'natural' | 'empresa';
  nombre: string; // nombre persona o nombre de fantasía
  razonSocial?: string;
  giro?: string;
  rut: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  zonaId: string;
  creado: string;
  anonimizado?: boolean;
}

export interface Usuario {
  id: string;
  nombre: string;
  rut: string;
  email: string;
  usuario: string;
  passHash: string;
  rol: Rol;
  area: string;
  nivelAcceso: 'Básico' | 'Intermedio' | 'Total';
  activo: boolean;
  bloqueado: boolean;
  motivoBloqueo?: string;
  intentosFallidos: number;
  ultimoAcceso: string;
  clienteId?: string; // para usuarios cliente
  empresaReparto?: string; // para repartidores
  zonas?: string[]; // zonas que cubre el repartidor
  disponible?: boolean; // repartidor
}

export interface ItemVenta {
  productoId: string;
  nombre: string;
  talla: string;
  cantidad: number;
  precioUnit: number;
  costoUnit: number;
}

export interface PagoInfo {
  medio: MedioPago;
  estado: 'aprobado' | 'rechazado' | 'pendiente';
  montoRecibido?: number;
  vuelto?: number;
  nroOperacion?: string;
  tarjeta?: string; // últimos 4
}

export interface Venta {
  id: string;
  folio: number;
  boleta: number;
  fecha: string;
  canal: Canal;
  origen: 'tienda_web' | 'vendedor';
  vendedorId?: string;
  clienteId: string;
  items: ItemVenta[];
  subtotal: number;
  descCampana: number;
  campanaId?: string;
  descPromo: number;
  promoId?: string;
  envio: number;
  total: number;
  pago: PagoInfo;
  estado: 'confirmada' | 'anulada';
  anulacion?: { motivo: string; autorizadaPor: string; fecha: string };
  pedidoId?: string;
  cotizacionId?: string;
}

export interface EventoPedido {
  estado: EstadoPedido;
  fecha: string;
  usuarioId?: string;
  nota?: string;
}

export interface Incidencia {
  id: string;
  tipo: TipoIncidencia;
  comentario: string;
  fecha: string;
  usuarioId: string;
  resuelta: boolean;
}

export interface Pedido {
  id: string;
  nro: string; // número de orden público
  ventaId: string;
  clienteId: string;
  direccion: string;
  comuna: string;
  zonaId: string;
  estado: EstadoPedido;
  repartidorId?: string;
  historial: EventoPedido[];
  estimadoDesde: string;
  estimadoHasta: string;
  entrega?: { fecha: string; receptor: string; evidencia?: 'foto' | 'firma'; evidenciaData?: string };
  incidencias: Incidencia[];
}

export interface Cotizacion {
  id: string;
  folio: number;
  fecha: string;
  vendedorId: string;
  clienteId: string;
  items: ItemVenta[];
  envio: number;
  total: number;
  vigenciaDias: number;
  estado: 'vigente' | 'convertida' | 'anulada';
  ventaId?: string;
}

export interface Devolucion {
  id: string;
  ventaId: string;
  fecha: string;
  items: { productoId: string; nombre: string; cantidad: number; monto: number }[];
  tipo: 'nota_credito' | 'reembolso';
  monto: number;
  motivo: string;
  usuarioId: string;
  folioNC?: number;
}

export interface CierreCaja {
  id: string;
  fecha: string;
  turnoId: string;
  usuarioId: string;
  ventas: number;
  porMedio: Record<MedioPago, number>;
  total: number;
  anuladas: number;
}

export interface Promocion {
  id: string;
  nombre: string;
  porcentaje: number;
  autorizadaPor: string;
  activa: boolean;
}

export interface Campana {
  id: string;
  nombre: string;
  tipo: 'categoria' | 'reactivacion';
  desde: string;
  hasta: string;
  descuentos: Record<Categoria, number>; // % por categoría
  clientesObjetivo?: string[]; // reactivación
  creadaPor: string;
  aprobadaPor?: string;
  estadoAprobacion: 'pendiente' | 'aprobada' | 'rechazada';
}

export interface Turno {
  id: string;
  nombre: string;
  inicio: string; // HH:MM
  fin: string;
}

export interface AsignacionTurno {
  usuarioId: string;
  dia: number; // 0 lunes .. 6 domingo
  turnoId: string | null;
}

export interface Asistencia {
  id: string;
  usuarioId: string;
  fecha: string; // yyyy-mm-dd
  entrada: string; // ISO
  salida?: string;
}

export type TipoLog = 'accion' | 'navegacion' | 'acceso_denegado' | 'sesion';

export interface LogEntry {
  id: string;
  fecha: string;
  usuarioId: string;
  tipo: TipoLog;
  modulo: string;
  accion: string;
  detalle: string;
}

export interface SolicitudClave {
  id: string;
  usuarioId: string;
  fecha: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  resueltaPor?: string;
  fechaResolucion?: string;
  claveTemporal?: string;
}

export interface Movimiento {
  id: string;
  fecha: string;
  productoId: string;
  ubicacionId: string;
  tipo: 'ingreso' | 'salida' | 'venta' | 'ajuste' | 'devolucion' | 'traslado';
  cantidad: number; // positivo entra, negativo sale
  motivo: string;
  usuarioId: string;
}

export interface AlertaStock {
  id: string;
  productoId: string;
  fecha: string;
  stock: number;
  estado: 'activa' | 'resuelta';
}

export interface OrdenReposicion {
  id: string;
  folio: number;
  fecha: string;
  productoId: string;
  proveedorId: string;
  cantidad: number;
  estado: 'generada' | 'enviada' | 'recibida';
  automatica: boolean;
}

export type CatEgreso = 'Logística' | 'Sueldos' | 'Proveedores' | 'Servicios' | 'Otros';
export const CATS_EGRESO: CatEgreso[] = ['Logística', 'Sueldos', 'Proveedores', 'Servicios', 'Otros'];
export type CatIngreso = 'Ventas' | 'Otros ingresos';

export interface NotaPartida {
  autorId: string;
  fecha: string;
  texto: string;
}

export interface Partida {
  id: string;
  fecha: string;
  tipo: 'ingreso' | 'egreso';
  categoria: CatEgreso | CatIngreso;
  descripcion: string;
  monto: number;
  ventaId?: string;
  usuarioId: string;
  conciliada: boolean;
  movBancoId?: string;
  notas: NotaPartida[];
}

export interface MovBanco {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number; // + abono, - cargo
  partidaId?: string;
}

export interface ReporteFinanciero {
  id: string;
  nombre: string;
  tipo: 'resumen_mensual' | 'manual';
  periodo: string;
  creado: string;
  creadoPor: string;
  ingresos: number;
  egresos: number;
  margen: number;
  archivado: boolean;
  fechaCierre?: string;
}

export interface Notificacion {
  id: string;
  fecha: string;
  destino: { clienteId?: string; usuarioId?: string; rol?: Rol };
  titulo: string;
  texto: string;
  leida: boolean;
}

export interface Config {
  envioGratisDesde: number;
  umbralEgresosPct: number;
  diasClienteInactivo: number;
  diasBloqueoCuenta: number;
  minutosSesion: number;
  intentosMaximos: number;
  categorias: Record<Categoria, { monto: number; compras: number }>;
  velocidadSprint: number;
}

export interface DB {
  version: number;
  creado: string;
  config: Config;
  zonas: Zona[];
  ubicaciones: Ubicacion[];
  proveedores: Proveedor[];
  productos: Producto[];
  clientes: Cliente[];
  usuarios: Usuario[];
  ventas: Venta[];
  pedidos: Pedido[];
  cotizaciones: Cotizacion[];
  devoluciones: Devolucion[];
  cierres: CierreCaja[];
  promociones: Promocion[];
  campanas: Campana[];
  turnos: Turno[];
  asignaciones: AsignacionTurno[];
  asistencias: Asistencia[];
  logs: LogEntry[];
  solicitudes: SolicitudClave[];
  movimientos: Movimiento[];
  alertas: AlertaStock[];
  reposiciones: OrdenReposicion[];
  partidas: Partida[];
  banco: MovBanco[];
  reportes: ReporteFinanciero[];
  notificaciones: Notificacion[];
  contadores: { folio: number; boleta: number; cotizacion: number; reposicion: number; nc: number; pedido: number };
}
