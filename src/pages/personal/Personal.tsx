import { Fragment, useMemo, useState } from 'react';
import { Aviso, Avatar, Boton, Buscador, Campo, Etiqueta, Filtros, Input, Kpi, Modal, Pagina, Panel, RF, Select, Tabla, resultado, toast, useConfirmar } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { Barras } from '../../components/Graficos';
import { asignarTurno, cambiarEstadoUsuario, getDB, guardarTurno, guardarUsuario, intentar, resolverSolicitud, useDB, useSesion } from '../../lib/store';
import { addDays, clp, dia, diasEntre, fecha, fechaHora, formatoRut, haceTiempo, hora, num } from '../../lib/format';
import { MENU, MODULOS, NOMBRE_ROL, ROLES_INTERNOS } from '../../lib/permisos';
import { cargaRepartidor, nombreUsuario } from '../../lib/logica';
import { descargarBlob, descargarExcel } from '../../lib/exportar';
import type { Rol, TipoLog, Turno, Usuario } from '../../lib/types';

const AREAS = ['Ventas', 'Bodega', 'Operaciones', 'Comercial', 'Atención al cliente', 'Finanzas', 'Auditoría externa', 'Gerencia', 'Tecnología', 'Reparto'];

export function Empleados() {
  const db = useDB();
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [edit, setEdit] = useState<Usuario | null>(null);
  const [clave, setClave] = useState('');
  const { confirmar, dialogo } = useConfirmar();
  const filas = db.usuarios.filter((u) => u.rol !== 'cliente').filter((u) => !rol || u.rol === rol).filter((u) => !q || `${u.nombre} ${u.rut} ${u.usuario}`.toLowerCase().includes(q.toLowerCase()));
  const nuevo = (): Usuario => ({ id: '', nombre: '', rut: '', email: '', usuario: '', passHash: '', rol: 'vendedor', area: 'Ventas', nivelAcceso: 'Básico', activo: true, bloqueado: false, intentosFallidos: 0, ultimoAcceso: '' });
  return (
    <Pagina titulo="Empleados" descripcion={<>Registro de cada empleado con su rol, área y nivel de acceso. Las cuentas sin uso por más de {db.config.diasBloqueoCuenta} días se bloquean solas y requieren reactivación manual. <RF ids="RF34 · RF43 · RNF02" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => { setEdit(nuevo()); setClave(''); }}>Nuevo empleado</Boton>}>
      <div className="kpis">
        <Kpi label="Cuentas internas" valor={num(filas.length)} />
        <Kpi label="Activas" valor={num(db.usuarios.filter((u) => u.rol !== 'cliente' && u.activo && !u.bloqueado).length)} tono="bien" />
        <Kpi label="Bloqueadas" valor={num(db.usuarios.filter((u) => u.bloqueado).length)} tono="alerta" />
        <Kpi label="Desactivadas" valor={num(db.usuarios.filter((u) => !u.activo).length)} />
      </div>
      <Panel className="panel-plano mt">
        <div style={{ padding: '16px 20px 0' }}>
          <Filtros>
            <Buscador valor={q} onChange={setQ} placeholder="Nombre, RUT o usuario" />
            <Select value={rol} onChange={(e) => setRol(e.target.value)} aria-label="Rol" style={{ width: 240 }}><option value="">Todos los roles</option>{ROLES_INTERNOS.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</Select>
          </Filtros>
        </div>
        <Tabla clave={(u) => u.id} filas={filas}
          columnas={[
            { titulo: 'Empleado', render: (u) => <div className="flex" style={{ flexWrap: 'nowrap' }}><Avatar nombre={u.nombre} chico /><div><strong>{u.nombre}</strong><span className="celda-sub">{u.usuario} · {u.rut}</span></div></div>, ordenar: (u) => u.nombre },
            { titulo: 'Rol', render: (u) => NOMBRE_ROL[u.rol], ordenar: (u) => u.rol },
            { titulo: 'Área', render: (u) => u.area },
            { titulo: 'Acceso', render: (u) => u.nivelAcceso },
            { titulo: 'Último acceso', render: (u) => <span className={diasEntre(u.ultimoAcceso, new Date()) > db.config.diasBloqueoCuenta ? 'texto-alerta' : ''}>{haceTiempo(u.ultimoAcceso)}</span>, ordenar: (u) => u.ultimoAcceso },
            { titulo: 'Estado', render: (u) => (!u.activo ? <Etiqueta>Desactivada</Etiqueta> : u.bloqueado ? <Etiqueta tono="peligro">Bloqueada · {u.motivoBloqueo}</Etiqueta> : <Etiqueta tono="bien">Activa</Etiqueta>) },
            { titulo: '', render: (u) => (
              <div className="fila-acciones">
                {u.bloqueado && u.activo && <Boton chico variante="primario" onClick={() => resultado(intentar(() => cambiarEstadoUsuario(u.id, { bloqueado: false })), 'Cuenta reactivada')}>Reactivar</Boton>}
                <Boton chico variante="fantasma" icono="edit" onClick={() => { setEdit({ ...u }); setClave(''); }}>Editar</Boton>
                <Boton chico variante="fantasma" onClick={async () => {
                  if (u.activo && !(await confirmar('Desactivar cuenta', `${u.nombre} ya no podrá ingresar. Su historial se mantiene.`, 'Desactivar', true))) return;
                  resultado(intentar(() => cambiarEstadoUsuario(u.id, { activo: !u.activo })), u.activo ? 'Cuenta desactivada' : 'Cuenta activada');
                }}>{u.activo ? 'Desactivar' : 'Activar'}</Boton>
              </div>
            ) },
          ]} />
      </Panel>
      <Modal titulo={edit?.id ? `Editar ${edit.nombre}` : 'Nuevo empleado'} abierto={!!edit} onCerrar={() => setEdit(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (edit && resultado(intentar(() => guardarUsuario({ ...edit, rut: formatoRut(edit.rut), email: edit.email || `${edit.usuario}@tiendasurbano.cl` }, clave || undefined)), 'Empleado guardado')) setEdit(null); }}>Guardar</Boton></>}>
        {edit && (
          <div className="form-grid">
            <Campo label="Nombre completo"><Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <Campo label="RUT" ayuda="No se permiten RUT repetidos"><Input value={edit.rut} onChange={(e) => setEdit({ ...edit, rut: e.target.value })} /></Campo>
            <Campo label="Usuario"><Input value={edit.usuario} onChange={(e) => setEdit({ ...edit, usuario: e.target.value })} /></Campo>
            <Campo label="Correo"><Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="usuario@tiendasurbano.cl" /></Campo>
            <Campo label="Rol"><Select value={edit.rol} onChange={(e) => setEdit({ ...edit, rol: e.target.value as Rol })}>{ROLES_INTERNOS.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</Select></Campo>
            <Campo label="Área"><Select value={edit.area} onChange={(e) => setEdit({ ...edit, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</Select></Campo>
            <Campo label="Nivel de acceso"><Select value={edit.nivelAcceso} onChange={(e) => setEdit({ ...edit, nivelAcceso: e.target.value as Usuario['nivelAcceso'] })}><option>Básico</option><option>Intermedio</option><option>Total</option></Select></Campo>
            <Campo label={edit.id ? 'Nueva clave (opcional)' : 'Clave inicial'} ayuda="Mínimo 8 caracteres"><Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" /></Campo>
          </div>
        )}
      </Modal>
      {dialogo}
    </Pagina>
  );
}

export function Permisos() {
  const roles = ROLES_INTERNOS;
  return (
    <Pagina titulo="Roles y permisos" descripcion={<>Cada rol ve solo los módulos que le corresponden. Si alguien intenta entrar a otro módulo, el sistema le niega el acceso y lo registra. <RF ids="RF35 · RNF05" /></>}>
      <Aviso tipo="info">Para probarlo, entra como vendedor y escribe en la barra de direcciones <strong>#/finanzas</strong>. Luego revisa el log de auditoría.</Aviso>
      <Panel className="panel-plano mt">
        <div className="tabla-wrap">
          <table className="tabla matriz">
            <thead><tr><th>Pantalla</th>{roles.map((r) => <th key={r} style={{ whiteSpace: 'normal', minWidth: 90 }}>{NOMBRE_ROL[r]}</th>)}</tr></thead>
            <tbody>
              {MODULOS.map((m) => (
                <Fragment key={m}>
                  <tr><td colSpan={roles.length + 1} style={{ background: 'var(--surface-2)', fontWeight: 700, fontSize: 13 }}>{m}</td></tr>
                  {MENU.filter((i) => i.modulo === m).map((i) => (
                    <tr key={i.ruta}>
                      <td>{i.titulo}</td>
                      {roles.map((r) => <td key={r}>{i.roles.includes(r) ? <span className="si"><Icono n="check" size={16} titulo="Permitido" /></span> : <span className="no">—</span>}</td>)}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Pagina>
  );
}

export function Claves() {
  const db = useDB();
  const [temp, setTemp] = useState<{ nombre: string; clave: string } | null>(null);
  const filas = [...db.solicitudes].sort((a, b) => (a.estado === 'pendiente' ? -1 : 1) - (b.estado === 'pendiente' ? -1 : 1) || b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Solicitudes de cambio de clave" descripcion={<>Las claves solo se restablecen cuando el administrador TI aprueba la solicitud. <RF ids="RF40" /></>}>
      <Panel className="panel-plano">
        <Tabla clave={(s) => s.id} filas={filas} vacio="No hay solicitudes."
          columnas={[
            { titulo: 'Empleado', render: (s) => { const u = db.usuarios.find((x) => x.id === s.usuarioId); return <><strong>{u?.nombre}</strong><span className="celda-sub">{u?.usuario} · {u ? NOMBRE_ROL[u.rol] : ''}</span></>; } },
            { titulo: 'Solicitada', render: (s) => fechaHora(s.fecha) },
            { titulo: 'Estado', render: (s) => <Etiqueta tono={s.estado === 'pendiente' ? 'alerta' : s.estado === 'aprobada' ? 'bien' : 'neutro'}>{s.estado === 'pendiente' ? 'Pendiente' : s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</Etiqueta> },
            { titulo: 'Resuelta por', render: (s) => (s.resueltaPor ? `${nombreUsuario(db, s.resueltaPor)} · ${fecha(s.fechaResolucion)}` : '—') },
            { titulo: '', render: (s) => s.estado === 'pendiente' ? (
              <div className="fila-acciones">
                <Boton chico variante="primario" onClick={() => { const r = intentar(() => resolverSolicitud(s.id, true)); if (r.ok && r.valor) setTemp({ nombre: db.usuarios.find((x) => x.id === s.usuarioId)!.nombre, clave: r.valor }); }}>Aprobar</Boton>
                <Boton chico variante="fantasma" onClick={() => { resolverSolicitud(s.id, false); toast('Solicitud rechazada'); }}>Rechazar</Boton>
              </div>
            ) : null },
          ]} />
      </Panel>
      <Modal titulo="Clave temporal generada" abierto={!!temp} onCerrar={() => setTemp(null)} ancho="chico" pie={<Boton variante="primario" onClick={() => setTemp(null)}>Listo</Boton>}>
        <p className="texto-modal">Entrega esta clave a {temp?.nombre} por un canal seguro. Le recomendamos cambiarla al ingresar.</p>
        <p style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontWeight: 700, margin: '14px 0', letterSpacing: '0.02em' }}>{temp?.clave}</p>
      </Modal>
    </Pagina>
  );
}

const NOMBRE_TIPO: Record<TipoLog, string> = { accion: 'Acción', navegacion: 'Navegación', acceso_denegado: 'Acceso denegado', sesion: 'Sesión' };

export function Auditoria() {
  const db = useDB();
  const [usuario, setUsuario] = useState('');
  const [tipo, setTipo] = useState('');
  const [modulo, setModulo] = useState('');
  const [desde, setDesde] = useState(dia(addDays(new Date(), -7)));
  const [q, setQ] = useState('');
  const filas = db.logs
    .filter((l) => (!usuario || l.usuarioId === usuario) && (!tipo || l.tipo === tipo) && (!modulo || l.modulo === modulo) && dia(l.fecha) >= desde)
    .filter((l) => !q || `${l.accion} ${l.detalle}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const modulos = [...new Set(db.logs.map((l) => l.modulo))].sort();
  return (
    <Pagina titulo="Log de auditoría" descripcion={<>Cada acción, inicio de sesión, sección visitada y acceso denegado queda registrado con fecha, hora y usuario. Nadie puede modificar ni borrar estos registros. <RF ids="RF38 · RF39 · RNF18 · RNF19" /></>}
      acciones={<Boton icono="download" onClick={() => descargarExcel(`log-auditoria-${dia()}`, [{ nombre: 'Log', titulo: 'Log de auditoría Urban Plus', encabezados: ['Fecha', 'Hora', 'Usuario', 'Tipo', 'Módulo', 'Acción', 'Detalle'], filas: filas.map((l) => [fecha(l.fecha), hora(l.fecha), nombreUsuario(db, l.usuarioId), NOMBRE_TIPO[l.tipo], l.modulo, l.accion, l.detalle]) }])}>Exportar</Boton>}>
      <Filtros>
        <Buscador valor={q} onChange={setQ} placeholder="Buscar en acción o detalle" />
        <Campo label="Usuario"><Select value={usuario} onChange={(e) => setUsuario(e.target.value)}><option value="">Todos</option><option value="sistema">Sistema</option>{db.usuarios.filter((u) => u.rol !== 'cliente').map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select></Campo>
        <Campo label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{Object.entries(NOMBRE_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
        <Campo label="Módulo"><Select value={modulo} onChange={(e) => setModulo(e.target.value)}><option value="">Todos</option>{modulos.map((m) => <option key={m}>{m}</option>)}</Select></Campo>
        <Campo label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
      </Filtros>
      <Panel className="panel-plano">
        <Tabla clave={(l) => l.id} filas={filas} porPagina={25}
          columnas={[
            { titulo: 'Fecha y hora', render: (l) => fechaHora(l.fecha) },
            { titulo: 'Usuario', render: (l) => nombreUsuario(db, l.usuarioId) },
            { titulo: 'Tipo', render: (l) => <Etiqueta tono={l.tipo === 'acceso_denegado' ? 'peligro' : l.tipo === 'accion' ? 'marca' : l.tipo === 'sesion' ? 'info' : 'neutro'}>{NOMBRE_TIPO[l.tipo]}</Etiqueta> },
            { titulo: 'Módulo', render: (l) => l.modulo },
            { titulo: 'Acción', render: (l) => <strong>{l.accion}</strong> },
            { titulo: 'Detalle', render: (l) => <span className="chico">{l.detalle}</span> },
          ]} />
      </Panel>
    </Pagina>
  );
}

export function Diagnostico() {
  const db = useDB();
  const tamano = useMemo(() => new Blob([JSON.stringify(db)]).size, [db]);
  const t0 = performance.now();
  JSON.parse(JSON.stringify(db.ventas.slice(0, 200)));
  const resp = Math.max(1, Math.round(performance.now() - t0));
  const respaldo = new Date(); respaldo.setHours(3, 0, 0, 0);
  const servicios: [string, string, 'bien' | 'alerta', string][] = [
    ['Base de datos', `${(tamano / 1024).toFixed(0)} KB · ${num(db.ventas.length)} ventas, ${num(db.logs.length)} registros de log`, 'bien', 'Operativa'],
    ['Respaldo automático diario (RNF24)', `Último respaldo: ${fechaHora(respaldo.toISOString())} en entorno separado`, 'bien', 'Al día'],
    ['Entorno de respaldo (RNF32)', 'Servidor secundario listo para activarse ante una caída', 'bien', 'En espera'],
    ['Pasarela de pagos', 'Ambiente de pruebas · tarjetas simuladas', 'alerta', 'Modo demo'],
    ['Correo y notificaciones', `${num(db.notificaciones.length)} notificaciones enviadas`, 'bien', 'Operativo'],
    ['Conexión segura', 'HTTPS con certificado TLS vigente (RNF03)', 'bien', 'Activa'],
    ['Claves de usuario (RNF01)', `Guardadas con hash, nunca en texto plano. Ej.: ${db.usuarios[0].passHash}`, 'bien', 'Protegidas'],
    ['Datos sensibles de clientes (RNF27)', 'RUT, dirección y teléfono cifrados en la base de datos del servidor', 'bien', 'Cifrados'],
  ];
  return (
    <Pagina titulo="Diagnóstico del sistema" descripcion={<>Panel interno con el estado de los servicios, solo para el administrador TI. <RF ids="RNF35 · RNF10 · RNF13" /></>}
      acciones={<Boton icono="download" onClick={() => descargarBlob(new Blob([JSON.stringify(getDB(), null, 1)], { type: 'application/json' }), `respaldo-urbanplus-${dia()}.json`)}>Descargar respaldo</Boton>}>
      <div className="kpis">
        <Kpi label="Disponibilidad (30 días)" valor="99,6%" detalle="Meta: 99% en horario operacional" tono="bien" />
        <Kpi label="Tiempo de respuesta medido" valor={`${resp} ms`} detalle="Meta: menos de 3 segundos" tono="bien" />
        <Kpi label="Usuarios conectados hoy" valor={num(db.usuarios.filter((u) => dia(u.ultimoAcceso) === dia()).length)} detalle="Capacidad: 50 concurrentes" />
        <Kpi label="Intentos fallidos (24 h)" valor={num(db.logs.filter((l) => l.accion === 'Intento fallido' && l.fecha > addDays(new Date(), -1).toISOString()).length)} />
      </div>
      <Panel titulo="Servicios" className="panel-plano mt">
        <Tabla clave={(s) => s[0]} filas={servicios}
          columnas={[
            { titulo: 'Servicio', render: (s) => <strong>{s[0]}</strong> },
            { titulo: 'Detalle', render: (s) => <span className="chico">{s[1]}</span> },
            { titulo: 'Estado', render: (s) => <Etiqueta tono={s[2]}>{s[3]}</Etiqueta> },
          ]} />
      </Panel>
      <p className="chico texto-3 mt">En el prototipo los datos viven en el navegador. En producción este panel consulta el estado real del servidor.</p>
    </Pagina>
  );
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function Turnos() {
  const db = useDB();
  const [edit, setEdit] = useState<Turno | null>(null);
  const personal = db.usuarios.filter((u) => u.rol !== 'cliente' && u.rol !== 'repartidor' && u.activo);
  const sinTurnoHoy = personal.filter((u) => !db.asignaciones.find((a) => a.usuarioId === u.id && a.dia === (new Date().getDay() + 6) % 7)?.turnoId);
  return (
    <Pagina titulo="Turnos del personal" descripcion={<>Define los turnos y asígnalos a cada persona para que nunca falte personal en la operación. <RF ids="RF37" /></>}
      acciones={<Boton icono="plus" onClick={() => setEdit({ id: '', nombre: '', inicio: '09:00', fin: '18:00' })}>Nuevo turno</Boton>}>
      <div className="kpis">
        {db.turnos.map((t) => <Kpi key={t.id} label={`Turno ${t.nombre}`} valor={`${t.inicio}–${t.fin}`} detalle={`${db.asignaciones.filter((a) => a.turnoId === t.id && a.dia === (new Date().getDay() + 6) % 7).length} personas hoy`} />)}
      </div>
      {sinTurnoHoy.length > 0 && <Aviso tipo="info">Hoy no tienen turno: {sinTurnoHoy.map((u) => u.nombre).join(', ')}.</Aviso>}
      <Panel titulo="Asignación semanal" className="panel-plano mt">
        <div className="tabla-wrap">
          <table className="tabla">
            <thead><tr><th>Persona</th>{DIAS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {personal.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong><span className="celda-sub">{u.area}</span></td>
                  {DIAS.map((_, i) => {
                    const a = db.asignaciones.find((x) => x.usuarioId === u.id && x.dia === i);
                    return (
                      <td key={i} className="turno-celda">
                        <Select value={a?.turnoId ?? ''} onChange={(e) => asignarTurno(u.id, i, e.target.value || null)} aria-label={`Turno de ${u.nombre} el ${DIAS[i]}`}>
                          <option value="">Libre</option>
                          {db.turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel titulo="Turnos definidos" className="panel-plano">
        <Tabla clave={(t) => t.id} filas={db.turnos} columnas={[
          { titulo: 'Turno', render: (t) => <strong>{t.nombre}</strong> },
          { titulo: 'Horario', render: (t) => `${t.inicio} a ${t.fin}` },
          { titulo: '', render: (t) => <Boton chico variante="fantasma" icono="edit" onClick={() => setEdit({ ...t })}>Editar</Boton> },
        ]} />
      </Panel>
      <Modal titulo={edit?.id ? 'Editar turno' : 'Nuevo turno'} abierto={!!edit} onCerrar={() => setEdit(null)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (edit && resultado(intentar(() => guardarTurno(edit)), 'Turno guardado')) setEdit(null); }}>Guardar</Boton></>}>
        {edit && (
          <div className="form-grid">
            <Campo label="Nombre" ancho="completo"><Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <Campo label="Inicio"><Input type="time" value={edit.inicio} onChange={(e) => setEdit({ ...edit, inicio: e.target.value })} /></Campo>
            <Campo label="Fin"><Input type="time" value={edit.fin} onChange={(e) => setEdit({ ...edit, fin: e.target.value })} /></Campo>
          </div>
        )}
      </Modal>
    </Pagina>
  );
}

export function AsistenciaPagina() {
  const db = useDB();
  const [desde, setDesde] = useState(dia(addDays(new Date(), -14)));
  const [hasta, setHasta] = useState(dia());
  const [persona, setPersona] = useState('');
  const personal = db.usuarios.filter((u) => u.rol !== 'cliente' && u.rol !== 'repartidor');
  const resumen = personal.filter((u) => !persona || u.id === persona).map((u) => {
    const as = db.asistencias.filter((a) => a.usuarioId === u.id && a.fecha >= desde && a.fecha <= hasta);
    let atrasos = 0, horas = 0;
    for (const a of as) {
      const t = db.turnos.find((x) => x.id === db.asignaciones.find((y) => y.usuarioId === u.id && y.dia === (new Date(a.fecha + 'T12:00').getDay() + 6) % 7)?.turnoId);
      if (t) { const [h, m] = t.inicio.split(':').map(Number); const e = new Date(a.entrada); if (e.getHours() * 60 + e.getMinutes() > h * 60 + m + 10) atrasos++; }
      if (a.salida) horas += (new Date(a.salida).getTime() - new Date(a.entrada).getTime()) / 3600000;
    }
    const acciones = db.logs.filter((l) => l.usuarioId === u.id && l.tipo === 'accion' && dia(l.fecha) >= desde && dia(l.fecha) <= hasta).length;
    return { u, dias: as.length, atrasos, horas, acciones };
  });
  const detalle = persona ? db.asistencias.filter((a) => a.usuarioId === persona && a.fecha >= desde && a.fecha <= hasta).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];
  return (
    <Pagina titulo="Asistencia y actividad" descripcion={<>Horario de entrada y salida de cada persona y su actividad en el sistema, filtrable por período. Cada uno marca su asistencia desde la barra superior. <RF ids="RF36 · RF41" /></>}
      acciones={<Boton icono="download" onClick={() => descargarExcel(`asistencia-${desde}-${hasta}`, [{ nombre: 'Resumen', titulo: `Asistencia y actividad del ${fecha(desde)} al ${fecha(hasta)}`, encabezados: ['Empleado', 'Área', 'Días trabajados', 'Atrasos', 'Horas', 'Acciones en el sistema'], filas: resumen.map((r) => [r.u.nombre, r.u.area, r.dias, r.atrasos, Number(r.horas.toFixed(1)), r.acciones]) }])}>Exportar</Boton>}>
      <Filtros>
        <Campo label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Campo label="Empleado"><Select value={persona} onChange={(e) => setPersona(e.target.value)}><option value="">Todos</option>{personal.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select></Campo>
      </Filtros>
      <Panel className="panel-plano">
        <Tabla clave={(r) => r.u.id} filas={resumen} onFila={(r) => setPersona(r.u.id)}
          columnas={[
            { titulo: 'Empleado', render: (r) => <><strong>{r.u.nombre}</strong><span className="celda-sub">{r.u.area}</span></> },
            { titulo: 'Días trabajados', render: (r) => r.dias, alinear: 'der', ordenar: (r) => r.dias },
            { titulo: 'Atrasos (+10 min)', render: (r) => <span className={r.atrasos ? 'texto-alerta' : ''}>{r.atrasos}</span>, alinear: 'der', ordenar: (r) => r.atrasos },
            { titulo: 'Horas', render: (r) => r.horas.toFixed(1).replace('.', ','), alinear: 'der', ordenar: (r) => r.horas },
            { titulo: 'Acciones en el sistema', render: (r) => num(r.acciones), alinear: 'der', ordenar: (r) => r.acciones },
          ]} />
      </Panel>
      {persona && (
        <Panel titulo={`Detalle de ${nombreUsuario(db, persona)}`} className="panel-plano" acciones={<Boton chico variante="fantasma" onClick={() => setPersona('')}>Ver todos</Boton>}>
          <Tabla clave={(a) => a.id} filas={detalle} columnas={[
            { titulo: 'Fecha', render: (a) => fecha(a.fecha) },
            { titulo: 'Entrada', render: (a) => hora(a.entrada) },
            { titulo: 'Salida', render: (a) => (a.salida ? hora(a.salida) : '—') },
            { titulo: 'Horas', render: (a) => (a.salida ? ((new Date(a.salida).getTime() - new Date(a.entrada).getTime()) / 3600000).toFixed(1).replace('.', ',') : '—'), alinear: 'der' },
          ]} />
        </Panel>
      )}
    </Pagina>
  );
}

export function CargaArea() {
  const db = useDB();
  const hoy = dia();
  const areas = [
    { area: 'Ventas', personas: db.usuarios.filter((u) => u.rol === 'vendedor' && u.activo).length, carga: db.ventas.filter((v) => dia(v.fecha) === hoy && v.origen === 'vendedor').length + db.cotizaciones.filter((c) => c.estado === 'vigente').length, detalle: `${db.ventas.filter((v) => dia(v.fecha) === hoy && v.origen === 'vendedor').length} ventas hoy · ${db.cotizaciones.filter((c) => c.estado === 'vigente').length} cotizaciones vigentes` },
    { area: 'Bodega', personas: db.usuarios.filter((u) => u.rol === 'bodega').length, carga: db.pedidos.filter((p) => p.estado === 'pendiente').length + db.reposiciones.filter((o) => o.estado !== 'recibida').length + db.alertas.filter((a) => a.estado === 'activa').length, detalle: `${db.pedidos.filter((p) => p.estado === 'pendiente').length} pedidos por asignar · ${db.alertas.filter((a) => a.estado === 'activa').length} alertas` },
    { area: 'Reparto', personas: db.usuarios.filter((u) => u.rol === 'repartidor' && u.activo).length, carga: db.pedidos.filter((p) => p.estado === 'preparacion' || p.estado === 'en_ruta').length, detalle: `${db.pedidos.filter((p) => p.estado === 'en_ruta').length} en ruta · ${db.pedidos.filter((p) => p.estado === 'preparacion').length} por salir` },
    { area: 'Atención al cliente', personas: db.usuarios.filter((u) => u.rol === 'ejecutivo').length, carga: db.pedidos.filter((p) => p.estado === 'incidencia').length + db.pedidos.filter((p) => p.estado !== 'entregado' && p.estimadoHasta < new Date().toISOString()).length, detalle: `${db.pedidos.filter((p) => p.estado === 'incidencia').length} incidencias · ${db.pedidos.filter((p) => p.estado !== 'entregado' && p.estimadoHasta < new Date().toISOString()).length} atrasados` },
    { area: 'Finanzas', personas: db.usuarios.filter((u) => u.rol === 'contador').length, carga: db.partidas.filter((p) => !p.conciliada).length, detalle: `${db.partidas.filter((p) => !p.conciliada).length} partidas por conciliar` },
  ];
  const reps = db.usuarios.filter((u) => u.rol === 'repartidor');
  return (
    <Pagina titulo="Carga de trabajo por área" descripcion={<>Panel consolidado del trabajo asignado a cada área para distribuir mejor los recursos. <RF ids="RF42" /></>}>
      <div className="grid-2">
        <Panel titulo="Tareas pendientes por persona">
          <Barras etiqueta="Tareas pendientes por persona en cada área" datos={areas.map((a) => ({ label: a.area === 'Atención al cliente' ? 'Atención' : a.area, valor: a.personas ? Math.round((a.carga / a.personas) * 10) / 10 : a.carga, detalle: `${a.carga} tareas · ${a.personas} personas` }))} formato={(n) => String(n).replace('.', ',')} alto={240} />
        </Panel>
        <Panel titulo="Detalle" className="panel-plano">
          <Tabla clave={(a) => a.area} filas={areas} columnas={[
            { titulo: 'Área', render: (a) => <><strong>{a.area}</strong><span className="celda-sub">{a.detalle}</span></> },
            { titulo: 'Personas', render: (a) => a.personas, alinear: 'der' },
            { titulo: 'Tareas', render: (a) => a.carga, alinear: 'der' },
          ]} />
        </Panel>
      </div>
      <Panel titulo="Repartidores" className="panel-plano">
        <Tabla clave={(u) => u.id} filas={reps} columnas={[
          { titulo: 'Repartidor', render: (u) => <><strong>{u.nombre}</strong><span className="celda-sub">{u.empresaReparto}</span></> },
          { titulo: 'Pedidos en curso', render: (u) => cargaRepartidor(db, u.id), alinear: 'der' },
          { titulo: 'Entregados hoy', render: (u) => db.pedidos.filter((p) => p.repartidorId === u.id && p.entrega && dia(p.entrega.fecha) === hoy).length, alinear: 'der' },
          { titulo: 'Ventas despachadas (30 días)', render: (u) => clp(db.pedidos.filter((p) => p.repartidorId === u.id && p.entrega && p.entrega.fecha > addDays(new Date(), -30).toISOString()).reduce((a, p) => a + (db.ventas.find((v) => v.id === p.ventaId)?.total ?? 0), 0)), alinear: 'der' },
        ]} />
      </Panel>
    </Pagina>
  );
}
