// Matriz de permisos por rol (RF35) y menú de navegación
import type { Rol } from './types';

export const NOMBRE_ROL: Record<Rol, string> = {
  cliente: 'Cliente',
  repartidor: 'Repartidor',
  vendedor: 'Vendedor / Operador',
  bodega: 'Administrador de Bodega',
  area: 'Administrador de Área',
  ejecutivo: 'Ejecutivo de Atención al Cliente',
  contador: 'Contador / Auditor',
  gerente: 'Gerente General',
  ti: 'Administrador TI',
};

export const ROLES_INTERNOS: Rol[] = ['vendedor', 'bodega', 'area', 'ejecutivo', 'contador', 'gerente', 'ti', 'repartidor'];

export interface ItemMenu {
  ruta: string;
  titulo: string;
  modulo: Modulo;
  roles: Rol[];
  icono: string;
}

export type Modulo = 'General' | 'Ventas y pagos' | 'Despacho' | 'Clientes y campañas' | 'Personal y accesos' | 'Inventario' | 'Finanzas';

export const MODULOS: Modulo[] = ['General', 'Ventas y pagos', 'Despacho', 'Clientes y campañas', 'Inventario', 'Finanzas', 'Personal y accesos'];

const TODOS_INTERNOS: Rol[] = ['vendedor', 'bodega', 'area', 'ejecutivo', 'contador', 'gerente', 'ti'];

export const MENU: ItemMenu[] = [
  { ruta: '/inicio', titulo: 'Inicio', modulo: 'General', roles: TODOS_INTERNOS, icono: 'home' },
  { ruta: '/repartidor', titulo: 'Mis entregas', modulo: 'Despacho', roles: ['repartidor'], icono: 'truck' },

  { ruta: '/ventas/nueva', titulo: 'Nueva venta', modulo: 'Ventas y pagos', roles: ['vendedor'], icono: 'plus' },
  { ruta: '/ventas', titulo: 'Ventas', modulo: 'Ventas y pagos', roles: ['vendedor', 'area', 'ejecutivo', 'gerente'], icono: 'receipt' },
  { ruta: '/ventas/cotizaciones', titulo: 'Cotizaciones', modulo: 'Ventas y pagos', roles: ['vendedor', 'area'], icono: 'quote' },
  { ruta: '/ventas/devoluciones', titulo: 'Devoluciones', modulo: 'Ventas y pagos', roles: ['ejecutivo', 'area'], icono: 'undo' },
  { ruta: '/ventas/caja', titulo: 'Cierre de caja', modulo: 'Ventas y pagos', roles: ['vendedor', 'area'], icono: 'cash' },
  { ruta: '/ventas/promociones', titulo: 'Promociones', modulo: 'Ventas y pagos', roles: ['area', 'gerente'], icono: 'tag' },
  { ruta: '/ventas/reporte-diario', titulo: 'Reporte diario de ventas', modulo: 'Ventas y pagos', roles: ['area', 'gerente', 'contador'], icono: 'report' },

  { ruta: '/despacho', titulo: 'Pedidos', modulo: 'Despacho', roles: ['bodega', 'area', 'ejecutivo', 'gerente'], icono: 'box' },
  { ruta: '/despacho/reporte', titulo: 'Reporte de despacho', modulo: 'Despacho', roles: ['area', 'gerente', 'bodega'], icono: 'report' },
  { ruta: '/despacho/zonas', titulo: 'Zonas y tarifas', modulo: 'Despacho', roles: ['area'], icono: 'map' },

  { ruta: '/clientes', titulo: 'Clientes', modulo: 'Clientes y campañas', roles: ['vendedor', 'ejecutivo', 'area', 'gerente'], icono: 'users' },
  { ruta: '/comercial/segmentacion', titulo: 'Segmentación', modulo: 'Clientes y campañas', roles: ['gerente', 'area'], icono: 'layers' },
  { ruta: '/comercial/campanas', titulo: 'Campañas', modulo: 'Clientes y campañas', roles: ['area', 'gerente'], icono: 'megaphone' },
  { ruta: '/comercial/inactivos', titulo: 'Clientes inactivos', modulo: 'Clientes y campañas', roles: ['area', 'gerente'], icono: 'moon' },
  { ruta: '/comercial/productos', titulo: 'Más vendidos', modulo: 'Clientes y campañas', roles: ['gerente', 'area'], icono: 'trophy' },
  { ruta: '/comercial/panel', titulo: 'Panel de clientes', modulo: 'Clientes y campañas', roles: ['gerente'], icono: 'chart' },

  { ruta: '/inventario', titulo: 'Productos y stock', modulo: 'Inventario', roles: ['bodega', 'area'], icono: 'shirt' },
  { ruta: '/inventario/movimientos', titulo: 'Movimientos', modulo: 'Inventario', roles: ['bodega', 'area'], icono: 'swap' },
  { ruta: '/inventario/alertas', titulo: 'Alertas de stock', modulo: 'Inventario', roles: ['bodega'], icono: 'bell' },
  { ruta: '/inventario/reposicion', titulo: 'Órdenes de reposición', modulo: 'Inventario', roles: ['bodega'], icono: 'refresh' },
  { ruta: '/inventario/proveedores', titulo: 'Proveedores', modulo: 'Inventario', roles: ['bodega'], icono: 'factory' },
  { ruta: '/inventario/ubicaciones', titulo: 'Ubicaciones de bodega', modulo: 'Inventario', roles: ['bodega'], icono: 'pin' },
  { ruta: '/inventario/reporte', titulo: 'Reporte de inventario', modulo: 'Inventario', roles: ['bodega', 'area'], icono: 'report' },

  { ruta: '/finanzas', titulo: 'Resumen financiero', modulo: 'Finanzas', roles: ['contador', 'gerente'], icono: 'chart' },
  { ruta: '/finanzas/partidas', titulo: 'Ingresos y egresos', modulo: 'Finanzas', roles: ['contador'], icono: 'ledger' },
  { ruta: '/finanzas/reportes', titulo: 'Reportes financieros', modulo: 'Finanzas', roles: ['contador', 'gerente'], icono: 'report' },
  { ruta: '/finanzas/comparar', titulo: 'Comparar períodos', modulo: 'Finanzas', roles: ['contador', 'gerente'], icono: 'compare' },
  { ruta: '/finanzas/rentabilidad', titulo: 'Rentabilidad', modulo: 'Finanzas', roles: ['contador', 'gerente'], icono: 'trophy' },
  { ruta: '/finanzas/conciliacion', titulo: 'Conciliación bancaria', modulo: 'Finanzas', roles: ['contador'], icono: 'bank' },

  { ruta: '/personal/empleados', titulo: 'Empleados', modulo: 'Personal y accesos', roles: ['ti'], icono: 'users' },
  { ruta: '/personal/permisos', titulo: 'Roles y permisos', modulo: 'Personal y accesos', roles: ['ti'], icono: 'shield' },
  { ruta: '/personal/claves', titulo: 'Solicitudes de clave', modulo: 'Personal y accesos', roles: ['ti'], icono: 'key' },
  { ruta: '/personal/auditoria', titulo: 'Log de auditoría', modulo: 'Personal y accesos', roles: ['ti'], icono: 'log' },
  { ruta: '/personal/diagnostico', titulo: 'Diagnóstico', modulo: 'Personal y accesos', roles: ['ti'], icono: 'pulse' },
  { ruta: '/personal/turnos', titulo: 'Turnos', modulo: 'Personal y accesos', roles: ['area'], icono: 'calendar' },
  { ruta: '/personal/asistencia', titulo: 'Asistencia y actividad', modulo: 'Personal y accesos', roles: ['area', 'ti'], icono: 'clock' },
  { ruta: '/personal/carga', titulo: 'Carga por área', modulo: 'Personal y accesos', roles: ['gerente'], icono: 'chart' },
];

/** Rutas con parámetros que heredan el permiso de una ruta del menú */
const RUTAS_HIJAS: { prefijo: string; padre: string }[] = [
  { prefijo: '/ventas/detalle/', padre: '/ventas' },
  { prefijo: '/clientes/', padre: '/clientes' },
  { prefijo: '/despacho/pedido/', padre: '/despacho' },
  { prefijo: '/comercial/campanas/', padre: '/comercial/campanas' },
  { prefijo: '/inventario/producto/', padre: '/inventario' },
];

export function rutaPermitida(rol: Rol, path: string): boolean {
  if (path === '/cuenta' || path === '/notificaciones' || path.startsWith('/boleta/')) return true;
  const item = MENU.find((m) => m.ruta === path);
  if (item) return item.roles.includes(rol);
  const hija = RUTAS_HIJAS.find((h) => path.startsWith(h.prefijo));
  if (hija) return rutaPermitida(rol, hija.padre);
  return false;
}

export function inicioDeRol(rol: Rol) {
  if (rol === 'cliente') return '/tienda';
  if (rol === 'repartidor') return '/repartidor';
  return '/inicio';
}

export function moduloDeRuta(path: string): string {
  const item = MENU.find((m) => m.ruta === path) ?? MENU.find((m) => path.startsWith(m.ruta + '/') && m.ruta !== '/inicio');
  return item?.modulo ?? 'General';
}

export function tituloDeRuta(path: string): string {
  const item = MENU.find((m) => m.ruta === path);
  return item?.titulo ?? path;
}
