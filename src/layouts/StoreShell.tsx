// Estructura de la tienda web para clientes
import type { ReactNode } from 'react';
import { Icono } from '../components/Icono';
import { Avatar } from '../components/ui';
import { navegar, useRuta } from '../lib/router';
import { logout, useCarrito, useSesion } from '../lib/store';
import { BannerDemo, Notificaciones, useControlSesion } from './AppShell';
import { inicioDeRol } from '../lib/permisos';

export function Wordmark() {
  return (
    <a className="wordmark" href="#/tienda" onClick={(e) => { e.preventDefault(); navegar('/tienda'); }} aria-label="Urbano, ir al inicio de la tienda">
      urbano<span>.</span>
    </a>
  );
}

export function StoreShell({ children }: { children: ReactNode }) {
  const { path } = useRuta();
  const { usuario } = useSesion();
  const carrito = useCarrito();
  useControlSesion();
  const unidades = carrito.reduce((a, i) => a + i.cantidad, 0);
  const esCliente = usuario?.rol === 'cliente';
  const links = [
    { to: '/tienda', label: 'Catálogo', activo: path === '/tienda' || path.startsWith('/tienda/producto') },
    { to: '/seguimiento', label: 'Seguir mi pedido', activo: path === '/seguimiento' },
    ...(esCliente ? [{ to: '/tienda/compras', label: 'Mis compras', activo: path.startsWith('/tienda/compras') || path.startsWith('/tienda/pedido') }] : []),
  ];
  const nav = (cls: string) => (
    <nav className={cls} aria-label="Tienda">
      {links.map((l) => (
        <a key={l.to} href={'#' + l.to} className={l.activo ? 'activo' : ''} onClick={(e) => { e.preventDefault(); navegar(l.to); }}>{l.label}</a>
      ))}
    </nav>
  );
  return (
    <div className="tienda">
      <BannerDemo />
      <header className="tienda-head">
        <div className="tienda-head-in">
          <Wordmark />
          {nav('tienda-nav')}
          <div className="espacio" style={{ flex: 1 }} />
          <div className="tienda-acciones">
            {esCliente && <Notificaciones />}
            <button className="icono-btn carro-btn" onClick={() => navegar('/tienda/carrito')} aria-label={`Carro de compras, ${unidades} productos`}>
              <Icono n="bag" size={20} />
              {unidades > 0 && <span className="punto-notif">{unidades}</span>}
            </button>
            {usuario ? (
              <>
                {usuario.rol !== 'cliente' && (
                  <button className="btn btn-chico btn-secundario" onClick={() => navegar(inicioDeRol(usuario.rol))}>Ir al sistema interno</button>
                )}
                <button className="usuario-chip" onClick={() => { if (window.confirm('¿Cerrar sesión?')) { logout(); navegar('/tienda'); } }} title="Cerrar sesión">
                  <Avatar nombre={usuario.nombre} chico />
                  <div><strong>{usuario.nombre.split(' ')[0]}</strong><small>Cerrar sesión</small></div>
                </button>
              </>
            ) : (
              <button className="btn btn-chico btn-primario" onClick={() => navegar('/login?volver=' + encodeURIComponent(path))}>Iniciar sesión</button>
            )}
          </div>
        </div>
        {nav('tienda-nav-movil')}
      </header>
      <main className="tienda-main">{children}</main>
      <footer className="tienda-pie">
        Tiendas Urbano · Ropa femenina importada · Despachos a Santiago y regiones · Prototipo Urban Plus
      </footer>
    </div>
  );
}
