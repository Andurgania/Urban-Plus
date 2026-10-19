// Estructura de la app interna: menú lateral por rol, barra superior, notificaciones y control de sesión
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icono } from '../components/Icono';
import { Avatar, toast, useConfirmar } from '../components/ui';
import { MENU, MODULOS, NOMBRE_ROL, moduloDeRuta } from '../lib/permisos';
import { navegar, useRuta } from '../lib/router';
import { getDB, logout, marcarAsistencia, sesionActual, marcarLeidas, notificacionesPara, reiniciarDemo, tocarActividad, useDB, useSesion, intentar } from '../lib/store';
import { dia, haceTiempo, hora } from '../lib/format';

export function BannerDemo() {
  const { confirmar, dialogo } = useConfirmar();
  return (
    <div className="demo-banner no-imprimir">
      Prototipo con datos ficticios para la presentación de Ingeniería de Requisitos.
      <button onClick={async () => {
        if (await confirmar('Reiniciar la demo', 'Se borran todos los cambios hechos en este navegador y se vuelven a cargar los datos de ejemplo. También se cierra la sesión.', 'Reiniciar demo', true)) {
          reiniciarDemo();
          navegar('/login');
          toast('Demo reiniciada con los datos de ejemplo');
        }
      }}>Reiniciar demo</button>
      {dialogo}
    </div>
  );
}

export function Notificaciones() {
  const db = useDB();
  const { usuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lista = notificacionesPara(db, usuario).slice(0, 20);
  const sinLeer = lista.filter((n) => !n.leida);
  useEffect(() => {
    if (!abierto) return;
    const f = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAbierto(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [abierto]);
  return (
    <div className="rel" ref={ref}>
      <button className="icono-btn" onClick={() => setAbierto(!abierto)} aria-label={`Notificaciones${sinLeer.length ? `, ${sinLeer.length} sin leer` : ''}`} aria-expanded={abierto}>
        <Icono n="bell" />
        {sinLeer.length > 0 && <span className="punto-notif">{sinLeer.length}</span>}
      </button>
      {abierto && (
        <div className="popover">
          <h3>
            Notificaciones
            {sinLeer.length > 0 && <button onClick={() => marcarLeidas(sinLeer.map((n) => n.id))}>Marcar todas como leídas</button>}
          </h3>
          {lista.length === 0 && <p className="texto-3 chico" style={{ padding: '8px 0 12px' }}>No tienes notificaciones.</p>}
          {lista.map((n) => (
            <div className="notif" key={n.id}>
              <span className={`punto ${n.leida ? 'leida' : ''}`} />
              <div>
                <strong>{n.titulo}</strong>
                <p>{n.texto}</p>
                <small>{haceTiempo(n.fecha)}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** RNF04: cierra la sesión tras N minutos sin actividad */
export function useControlSesion() {
  const { sesion } = useSesion();
  useEffect(() => {
    if (!sesion) return;
    let ultimo = 0;
    const act = () => {
      const t = Date.now();
      if (t - ultimo > 20000) {
        ultimo = t;
        tocarActividad();
      }
    };
    window.addEventListener('mousemove', act);
    window.addEventListener('keydown', act);
    window.addEventListener('touchstart', act);
    const iv = setInterval(() => {
      const s = sesionActual();
      if (!s) return;
      const min = getDB().config.minutosSesion;
      if (Date.now() - new Date(s.actividad).getTime() > min * 60000) {
        logout('Sesión expirada');
        navegar('/login?expirada=1');
      }
    }, 15000);
    return () => {
      window.removeEventListener('mousemove', act);
      window.removeEventListener('keydown', act);
      window.removeEventListener('touchstart', act);
      clearInterval(iv);
    };
  }, [sesion?.usuarioId]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const db = useDB();
  const { usuario } = useSesion();
  const { path } = useRuta();
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  useControlSesion();
  useEffect(() => setAbierto(false), [path]);

  const rol = usuario!.rol;
  const items = MENU.filter((m) => m.roles.includes(rol));
  const badges = useMemo(() => {
    const b: Record<string, number> = {};
    b['/despacho'] = db.pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'incidencia').length;
    b['/inventario/alertas'] = db.alertas.filter((a) => a.estado === 'activa').length;
    b['/inventario/reposicion'] = db.reposiciones.filter((o) => o.estado === 'generada').length;
    b['/personal/claves'] = db.solicitudes.filter((s) => s.estado === 'pendiente').length;
    b['/comercial/campanas'] = rol === 'gerente' ? db.campanas.filter((c) => c.estadoAprobacion === 'pendiente').length : 0;
    b['/repartidor'] = db.pedidos.filter((p) => p.repartidorId === usuario?.id && (p.estado === 'preparacion' || p.estado === 'en_ruta')).length;
    return b;
  }, [db, rol, usuario?.id]);

  const asistenciaHoy = db.asistencias.find((a) => a.usuarioId === usuario!.id && a.fecha === dia());
  const actual = items.find((m) => m.ruta === path) ?? items.filter((m) => path.startsWith(m.ruta + '/')).sort((a, b) => b.ruta.length - a.ruta.length)[0];

  return (
    <>
      <BannerDemo />
      <div className="app">
        {abierto && <div className="velo" onClick={() => setAbierto(false)} />}
        <aside className={`lateral ${abierto ? 'abierto' : ''}`} aria-label="Menú principal">
          <div className="lateral-marca">
            <span className="logo-marca"><Icono n="shirt" size={18} /></span>
            <div>
              <strong>Urban Plus</strong>
              <small>Tiendas Urbano</small>
            </div>
          </div>
          <nav>
            {MODULOS.map((mod) => {
              const its = items.filter((i) => i.modulo === mod);
              if (!its.length) return null;
              return (
                <div className="menu-grupo" key={mod}>
                  {mod !== 'General' && <span>{mod}</span>}
                  {its.map((i) => (
                    <a key={i.ruta} href={'#' + i.ruta} className={`menu-item ${actual?.ruta === i.ruta ? 'activo' : ''}`} aria-current={actual?.ruta === i.ruta ? 'page' : undefined}
                      onClick={(e) => { e.preventDefault(); navegar(i.ruta); }}>
                      <Icono n={i.icono} size={17} />
                      {i.titulo}
                      {badges[i.ruta] ? <span className="menu-badge">{badges[i.ruta]}</span> : null}
                    </a>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="lateral-pie">
            <span>Conectado como {NOMBRE_ROL[rol]}</span>
            <button onClick={() => navegar('/requisitos')}><Icono n="log" size={16} /> Mapa de requisitos</button>
            <button onClick={() => { logout(); navegar('/login'); }}><Icono n="logout" size={16} /> Cerrar sesión</button>
          </div>
        </aside>
        <div className="principal">
          <header className="barra-sup">
            <button className="icono-btn menu-movil" onClick={() => setAbierto(true)} aria-label="Abrir menú"><Icono n="menu" /></button>
            <div className="migas">
              {moduloDeRuta(path) !== 'General' && <><span>{moduloDeRuta(path)}</span><span>/</span></>}
              <strong>{actual?.titulo ?? (path === '/cuenta' ? 'Mi cuenta' : '')}</strong>
            </div>
            <div className="espacio" />
            {rol !== 'repartidor' && (
              <button className={`btn btn-chico btn-asistencia ${asistenciaHoy && !asistenciaHoy.salida ? 'btn-secundario' : 'btn-fantasma'}`} title="Registro de asistencia (RF36)"
                disabled={!!asistenciaHoy?.salida}
                onClick={() => {
                  const r = intentar(() => marcarAsistencia());
                  if (r.ok) toast(r.valor === 'entrada' ? `Entrada registrada a las ${hora(new Date().toISOString())}` : `Salida registrada a las ${hora(new Date().toISOString())}`);
                  else toast(r.error, 'peligro');
                }}>
                <Icono n="clock" size={15} />
                <span>{!asistenciaHoy ? 'Marcar entrada' : !asistenciaHoy.salida ? `Entrada ${hora(asistenciaHoy.entrada)} · marcar salida` : `Jornada ${hora(asistenciaHoy.entrada)}–${hora(asistenciaHoy.salida)}`}</span>
              </button>
            )}
            <Notificaciones />
            <div className="rel">
              <button className="usuario-chip" onClick={() => setMenuUsuario(!menuUsuario)} aria-expanded={menuUsuario}>
                <Avatar nombre={usuario!.nombre} />
                <div>
                  <strong>{usuario!.nombre}</strong>
                  <small>{NOMBRE_ROL[rol]}</small>
                </div>
                <Icono n="down" size={14} />
              </button>
              {menuUsuario && (
                <div className="popover" style={{ width: 220 }} onMouseLeave={() => setMenuUsuario(false)}>
                  <button className="menu-item" style={{ color: 'var(--texto)' }} onClick={() => { setMenuUsuario(false); navegar('/cuenta'); }}><Icono n="user" size={16} /> Mi cuenta</button>
                  <button className="menu-item" style={{ color: 'var(--texto)' }} onClick={() => { setMenuUsuario(false); navegar('/login?cambiar=1'); }}><Icono n="users" size={16} /> Cambiar de usuario</button>
                  <button className="menu-item" style={{ color: 'var(--texto)' }} onClick={() => { logout(); navegar('/login'); }}><Icono n="logout" size={16} /> Cerrar sesión</button>
                </div>
              )}
            </div>
          </header>
          <main className="contenido" id="contenido">{children}</main>
        </div>
      </div>
    </>
  );
}
