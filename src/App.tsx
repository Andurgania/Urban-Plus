// Rutas de la aplicación y control de acceso por rol
import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { match, navegar, useRuta } from './lib/router';
import { registrarAccesoDenegado, registrarNavegacion, useSesion } from './lib/store';
import { inicioDeRol, rutaPermitida, tituloDeRuta } from './lib/permisos';
import { Toasts } from './components/ui';
import { AppShell } from './layouts/AppShell';
import { StoreShell } from './layouts/StoreShell';

import { Login } from './pages/general/Login';
import { Inicio } from './pages/general/Inicio';
import { Cuenta, AccesoDenegado, NoEncontrado } from './pages/general/Varios';
import { BoletaPagina } from './pages/general/Boleta';
import { Requisitos } from './pages/general/Requisitos';
import { Catalogo, ProductoDetalle } from './pages/store/Catalogo';
import { Carrito, Checkout } from './pages/store/Compra';
import { MisCompras, PedidoCliente, Seguimiento } from './pages/store/Pedidos';
import { NuevaVenta } from './pages/ventas/NuevaVenta';
import { Ventas, VentaDetalle, Cotizaciones, Devoluciones, CierreCaja, Promociones, ReporteDiarioVentas } from './pages/ventas/Ventas';
import { Pedidos, PedidoDetalle, ReporteDespacho, Zonas } from './pages/despacho/Despacho';
import { Repartidor } from './pages/despacho/Repartidor';
import { Clientes, ClienteDetalle } from './pages/comercial/Clientes';
import { Segmentacion, Campanas, CampanaDetalle, Inactivos, MasVendidos, PanelClientes } from './pages/comercial/Comercial';
import { Productos, ProductoInventario, Movimientos, Alertas, Reposicion, Proveedores, Ubicaciones, ReporteInventario } from './pages/inventario/Inventario';
import { ResumenFinanciero, Partidas, Reportes, Comparar, Rentabilidad, Conciliacion } from './pages/finanzas/Finanzas';
import { Empleados, Permisos, Claves, Auditoria, Diagnostico, Turnos, AsistenciaPagina, CargaArea } from './pages/personal/Personal';

type Ruta = { patron: string; comp: ComponentType<{ params: Record<string, string> }>; tipo: 'publica' | 'tienda' | 'cliente' | 'interna' };

const RUTAS: Ruta[] = [
  { patron: '/login', comp: Login, tipo: 'publica' },
  { patron: '/requisitos', comp: Requisitos, tipo: 'publica' },
  { patron: '/tienda', comp: Catalogo, tipo: 'tienda' },
  { patron: '/tienda/producto/:id', comp: ProductoDetalle, tipo: 'tienda' },
  { patron: '/tienda/carrito', comp: Carrito, tipo: 'tienda' },
  { patron: '/tienda/checkout', comp: Checkout, tipo: 'cliente' },
  { patron: '/tienda/compras', comp: MisCompras, tipo: 'cliente' },
  { patron: '/tienda/pedido/:id', comp: PedidoCliente, tipo: 'cliente' },
  { patron: '/tienda/boleta/:id', comp: BoletaPagina, tipo: 'cliente' },
  { patron: '/seguimiento', comp: Seguimiento, tipo: 'tienda' },

  { patron: '/inicio', comp: Inicio, tipo: 'interna' },
  { patron: '/cuenta', comp: Cuenta, tipo: 'interna' },
  { patron: '/boleta/:id', comp: BoletaPagina, tipo: 'interna' },
  { patron: '/repartidor', comp: Repartidor, tipo: 'interna' },
  { patron: '/ventas/nueva', comp: NuevaVenta, tipo: 'interna' },
  { patron: '/ventas', comp: Ventas, tipo: 'interna' },
  { patron: '/ventas/detalle/:id', comp: VentaDetalle, tipo: 'interna' },
  { patron: '/ventas/cotizaciones', comp: Cotizaciones, tipo: 'interna' },
  { patron: '/ventas/devoluciones', comp: Devoluciones, tipo: 'interna' },
  { patron: '/ventas/caja', comp: CierreCaja, tipo: 'interna' },
  { patron: '/ventas/promociones', comp: Promociones, tipo: 'interna' },
  { patron: '/ventas/reporte-diario', comp: ReporteDiarioVentas, tipo: 'interna' },
  { patron: '/despacho', comp: Pedidos, tipo: 'interna' },
  { patron: '/despacho/pedido/:id', comp: PedidoDetalle, tipo: 'interna' },
  { patron: '/despacho/reporte', comp: ReporteDespacho, tipo: 'interna' },
  { patron: '/despacho/zonas', comp: Zonas, tipo: 'interna' },
  { patron: '/clientes', comp: Clientes, tipo: 'interna' },
  { patron: '/clientes/:id', comp: ClienteDetalle, tipo: 'interna' },
  { patron: '/comercial/segmentacion', comp: Segmentacion, tipo: 'interna' },
  { patron: '/comercial/campanas', comp: Campanas, tipo: 'interna' },
  { patron: '/comercial/campanas/:id', comp: CampanaDetalle, tipo: 'interna' },
  { patron: '/comercial/inactivos', comp: Inactivos, tipo: 'interna' },
  { patron: '/comercial/productos', comp: MasVendidos, tipo: 'interna' },
  { patron: '/comercial/panel', comp: PanelClientes, tipo: 'interna' },
  { patron: '/inventario', comp: Productos, tipo: 'interna' },
  { patron: '/inventario/producto/:id', comp: ProductoInventario, tipo: 'interna' },
  { patron: '/inventario/movimientos', comp: Movimientos, tipo: 'interna' },
  { patron: '/inventario/alertas', comp: Alertas, tipo: 'interna' },
  { patron: '/inventario/reposicion', comp: Reposicion, tipo: 'interna' },
  { patron: '/inventario/proveedores', comp: Proveedores, tipo: 'interna' },
  { patron: '/inventario/ubicaciones', comp: Ubicaciones, tipo: 'interna' },
  { patron: '/inventario/reporte', comp: ReporteInventario, tipo: 'interna' },
  { patron: '/finanzas', comp: ResumenFinanciero, tipo: 'interna' },
  { patron: '/finanzas/partidas', comp: Partidas, tipo: 'interna' },
  { patron: '/finanzas/reportes', comp: Reportes, tipo: 'interna' },
  { patron: '/finanzas/comparar', comp: Comparar, tipo: 'interna' },
  { patron: '/finanzas/rentabilidad', comp: Rentabilidad, tipo: 'interna' },
  { patron: '/finanzas/conciliacion', comp: Conciliacion, tipo: 'interna' },
  { patron: '/personal/empleados', comp: Empleados, tipo: 'interna' },
  { patron: '/personal/permisos', comp: Permisos, tipo: 'interna' },
  { patron: '/personal/claves', comp: Claves, tipo: 'interna' },
  { patron: '/personal/auditoria', comp: Auditoria, tipo: 'interna' },
  { patron: '/personal/diagnostico', comp: Diagnostico, tipo: 'interna' },
  { patron: '/personal/turnos', comp: Turnos, tipo: 'interna' },
  { patron: '/personal/asistencia', comp: AsistenciaPagina, tipo: 'interna' },
  { patron: '/personal/carga', comp: CargaArea, tipo: 'interna' },
];

function Redirigir({ to }: { to: string }) {
  useEffect(() => navegar(to, { replace: true }), [to]);
  return null;
}

export default function App() {
  const { path } = useRuta();
  const { usuario } = useSesion();

  let encontrada: { r: Ruta; params: Record<string, string> } | null = null;
  for (const r of RUTAS) {
    const p = match(r.patron, path);
    if (p) { encontrada = { r, params: p }; break; }
  }

  const permitido = !!(encontrada && encontrada.r.tipo === 'interna' && usuario && usuario.rol !== 'cliente' && rutaPermitida(usuario.rol, path));
  useEffect(() => {
    if (encontrada?.r.tipo !== 'interna' || !usuario || usuario.rol === 'cliente') return;
    if (permitido) registrarNavegacion(path, tituloDeRuta(path));
    else registrarAccesoDenegado(path);
  }, [path, usuario?.id, permitido]);

  let vista;
  if (path === '/' || path === '') {
    vista = <Redirigir to={usuario ? inicioDeRol(usuario.rol) : '/login'} />;
  } else if (!encontrada) {
    vista = usuario && usuario.rol !== 'cliente' ? <AppShell><NoEncontrado /></AppShell> : <StoreShell><NoEncontrado /></StoreShell>;
  } else {
    const { r, params } = encontrada;
    const C = r.comp;
    if (r.tipo === 'publica') vista = <C params={params} />;
    else if (r.tipo === 'tienda') vista = <StoreShell><C params={params} /></StoreShell>;
    else if (r.tipo === 'cliente') {
      vista = !usuario ? <Redirigir to={'/login?volver=' + encodeURIComponent(path)} /> : usuario.rol !== 'cliente' ? <StoreShell><AccesoDenegado clienteSolo /></StoreShell> : <StoreShell><C params={params} /></StoreShell>;
    } else {
      if (!usuario) vista = <Redirigir to={'/login?volver=' + encodeURIComponent(path)} />;
      else if (usuario.rol === 'cliente') vista = <Redirigir to="/tienda" />;
      else vista = <AppShell>{permitido ? <C params={params} /> : <AccesoDenegado />}</AppShell>;
    }
  }

  return (
    <>
      {vista}
      <Toasts />
    </>
  );
}
