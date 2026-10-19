import { useState } from 'react';
import { Aviso, Boton, Buscador, Campo, Definiciones, EstadoPedidoTag, Etiqueta, Filtros, Input, Interruptor, Kpi, Modal, Pagina, Panel, Pestanas, RF, Select, Tabla, Textarea, resultado, toast } from '../../components/ui';
import { asignarPedido, cambiarDisponibilidad, guardarConfig, guardarZona, intentar, NOMBRE_INCIDENCIA, reasignarPedido, registrarIncidencia, resolverIncidencia, useDB, useSesion } from '../../lib/store';
import { navegar } from '../../lib/router';
import { clp, dia, fecha, fechaHora, haceTiempo, num } from '../../lib/format';
import { cargaRepartidor, nombreCliente, nombreUsuario, sugerirRepartidor } from '../../lib/logica';
import { descargarExcel, exportarPDF } from '../../lib/exportar';
import type { EstadoPedido, Pedido, TipoIncidencia, Zona } from '../../lib/types';
import { LineaTiempo, ProgresoPedido } from '../store/Pedidos';
import { NoEncontrado } from '../general/Varios';

function ModalAsignar({ pedido, onCerrar, reasignar }: { pedido: Pedido | null; onCerrar: () => void; reasignar?: boolean }) {
  const db = useDB();
  const [rep, setRep] = useState('');
  const [motivo, setMotivo] = useState('');
  const [prev, setPrev] = useState<string | null>(null);
  const sug = pedido ? sugerirRepartidor(db, pedido) : undefined;
  if ((pedido?.id ?? null) !== prev) {
    setPrev(pedido?.id ?? null);
    setRep(reasignar ? '' : sug?.id ?? '');
    setMotivo('');
  }
  if (!pedido) return null;
  const reps = db.usuarios.filter((u) => u.rol === 'repartidor' && u.activo);
  const zona = db.zonas.find((z) => z.id === pedido.zonaId);
  return (
    <Modal titulo={`${reasignar ? 'Reasignar' : 'Asignar'} pedido ${pedido.nro}`} abierto onCerrar={onCerrar}
      pie={<><Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" disabled={!rep} onClick={() => {
        const r = intentar(() => (reasignar ? reasignarPedido(pedido.id, rep, motivo) : asignarPedido(pedido.id, rep)));
        if (resultado(r, reasignar ? 'Pedido reasignado' : 'Pedido asignado. El repartidor ya lo ve en su celular.')) onCerrar();
      }}>{reasignar ? 'Reasignar' : 'Asignar'}</Boton></>}>
      <p className="texto-2 chico" style={{ marginBottom: 12 }}>Destino: {pedido.comuna} · zona {zona?.nombre}. {nombreCliente(db, pedido.clienteId)}.</p>
      {sug && !reasignar && <Aviso tipo="info">Sugerencia: <strong>{sug.nombre}</strong> cubre esta zona y es quien tiene menos pedidos en curso ({cargaRepartidor(db, sug.id)}). Puedes elegir a otro. <RF ids="HU09-B" /></Aviso>}
      <div className="tabla-wrap mt" style={{ margin: '12px 0 0' }}>
        <table className="tabla">
          <thead><tr><th></th><th>Repartidor</th><th>Empresa</th><th>Zonas</th><th className="al-der">Carga actual</th><th>Estado</th></tr></thead>
          <tbody>
            {reps.map((u) => {
              const cubre = u.zonas?.includes(pedido.zonaId);
              const disponible = u.disponible !== false && !u.bloqueado;
              return (
                <tr key={u.id} className="fila-click" onClick={() => disponible && setRep(u.id)} style={!disponible ? { opacity: 0.5 } : undefined}>
                  <td><input type="radio" name="rep" checked={rep === u.id} onChange={() => setRep(u.id)} disabled={!disponible || u.id === pedido.repartidorId} aria-label={u.nombre} /></td>
                  <td><strong>{u.nombre}</strong>{u.id === pedido.repartidorId && <span className="celda-sub">Asignado actualmente</span>}</td>
                  <td>{u.empresaReparto}</td>
                  <td>{u.zonas?.map((z) => db.zonas.find((x) => x.id === z)?.nombre).join(', ')} {cubre && <Etiqueta tono="bien">Cubre</Etiqueta>}</td>
                  <td className="al-der">{cargaRepartidor(db, u.id)} pedidos</td>
                  <td>{disponible ? <Etiqueta tono="bien">Disponible</Etiqueta> : <Etiqueta>No disponible</Etiqueta>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {reasignar && <div className="mt"><Campo label="Motivo de la reasignación"><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. El repartidor reportó una falla en su vehículo" /></Campo></div>}
    </Modal>
  );
}

export function Pedidos() {
  const db = useDB();
  const { usuario } = useSesion();
  const rol = usuario!.rol;
  const [tab, setTab] = useState<EstadoPedido | 'activos' | 'todos'>(rol === 'bodega' ? 'pendiente' : 'activos');
  const [q, setQ] = useState('');
  const [zona, setZona] = useState('');
  const [rep, setRep] = useState('');
  const [asignar, setAsignar] = useState<Pedido | null>(null);
  const [reasig, setReasig] = useState<Pedido | null>(null);
  const cuenta = (e: EstadoPedido) => db.pedidos.filter((p) => p.estado === e).length;
  const filas = db.pedidos
    .filter((p) => (tab === 'todos' ? true : tab === 'activos' ? p.estado !== 'entregado' : p.estado === tab))
    .filter((p) => !zona || p.zonaId === zona)
    .filter((p) => !rep || p.repartidorId === rep)
    .filter((p) => !q || `${p.nro} ${nombreCliente(db, p.clienteId)} ${p.comuna}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.historial[0].fecha.localeCompare(a.historial[0].fecha));
  return (
    <Pagina titulo="Pedidos" descripcion={<>Estado de cada pedido en tiempo real, asignación de repartidores e incidencias. <RF ids="RF02 · RF06 · RF08 · RF09" /></>}>
      <div className="kpis">
        <Kpi label="Por asignar" valor={num(cuenta('pendiente'))} tono={cuenta('pendiente') ? 'alerta' : undefined} />
        <Kpi label="En preparación" valor={num(cuenta('preparacion'))} />
        <Kpi label="En ruta" valor={num(cuenta('en_ruta'))} />
        <Kpi label="Con incidencia" valor={num(cuenta('incidencia'))} tono={cuenta('incidencia') ? 'peligro' : undefined} />
        <Kpi label="Entregados hoy" valor={num(db.pedidos.filter((p) => p.entrega && dia(p.entrega.fecha) === dia()).length)} tono="bien" />
      </div>
      <Panel className="panel-plano mt">
        <div style={{ padding: '6px 20px 0' }}>
          <Pestanas valor={tab} onChange={setTab} opciones={[
            { id: 'activos', label: 'En curso' }, { id: 'pendiente', label: `Por asignar (${cuenta('pendiente')})` }, { id: 'preparacion', label: 'En preparación' },
            { id: 'en_ruta', label: 'En ruta' }, { id: 'incidencia', label: `Incidencias (${cuenta('incidencia')})` }, { id: 'entregado', label: 'Entregados' }, { id: 'todos', label: 'Todos' },
          ]} />
          <Filtros>
            <Buscador valor={q} onChange={setQ} placeholder="N° de pedido, cliente o comuna" />
            <Select value={zona} onChange={(e) => setZona(e.target.value)} aria-label="Zona" style={{ width: 200 }}><option value="">Todas las zonas</option>{db.zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</Select>
            <Select value={rep} onChange={(e) => setRep(e.target.value)} aria-label="Repartidor" style={{ width: 200 }}><option value="">Todos los repartidores</option>{db.usuarios.filter((u) => u.rol === 'repartidor').map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select>
          </Filtros>
        </div>
        <Tabla clave={(p) => p.id} filas={filas} onFila={(p) => navegar('/despacho/pedido/' + p.id)}
          columnas={[
            { titulo: 'Pedido', render: (p) => <><strong>{p.nro}</strong><span className="celda-sub">{haceTiempo(p.historial[0].fecha)}</span></>, ordenar: (p) => p.historial[0].fecha },
            { titulo: 'Cliente', render: (p) => nombreCliente(db, p.clienteId) },
            { titulo: 'Destino', render: (p) => <>{p.comuna}<span className="celda-sub">{db.zonas.find((z) => z.id === p.zonaId)?.nombre}</span></> },
            { titulo: 'Repartidor', render: (p) => (p.repartidorId ? nombreUsuario(db, p.repartidorId) : <span className="texto-3">Sin asignar</span>) },
            { titulo: 'Entrega estimada', render: (p) => { const atr = p.estado !== 'entregado' && p.estimadoHasta < new Date().toISOString(); return <span className={atr ? 'texto-peligro' : ''}>{p.entrega ? `Entregado ${fecha(p.entrega.fecha)}` : `${fecha(p.estimadoDesde)} – ${fecha(p.estimadoHasta)}`}{atr ? ' · atrasado' : ''}</span>; } },
            { titulo: 'Estado', render: (p) => <EstadoPedidoTag e={p.estado} /> },
            { titulo: '', render: (p) => (
              <div className="fila-acciones" onClick={(e) => e.stopPropagation()}>
                {p.estado === 'pendiente' && (rol === 'bodega' || rol === 'area') && <Boton chico variante="primario" onClick={() => setAsignar(p)}>Asignar</Boton>}
                {rol === 'area' && p.repartidorId && p.estado !== 'entregado' && <Boton chico onClick={() => setReasig(p)}>Reasignar</Boton>}
              </div>
            ) },
          ]} />
      </Panel>
      <ModalAsignar pedido={asignar} onCerrar={() => setAsignar(null)} />
      <ModalAsignar pedido={reasig} onCerrar={() => setReasig(null)} reasignar />
    </Pagina>
  );
}

export function PedidoDetalle({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const { usuario } = useSesion();
  const rol = usuario!.rol;
  const [asignar, setAsignar] = useState(false);
  const [reasig, setReasig] = useState(false);
  const [resolver, setResolver] = useState(false);
  const [nota, setNota] = useState('');
  const [inc, setInc] = useState(false);
  const [tipoInc, setTipoInc] = useState<TipoIncidencia>('direccion');
  const [coment, setComent] = useState('');
  const p = db.pedidos.find((x) => x.id === params.id);
  if (!p) return <NoEncontrado />;
  const v = db.ventas.find((x) => x.id === p.ventaId);
  const c = db.clientes.find((x) => x.id === p.clienteId);
  const abiertas = p.incidencias.filter((i) => !i.resuelta);
  return (
    <Pagina titulo={`Pedido ${p.nro}`} volver="/despacho" descripcion={`${nombreCliente(db, p.clienteId)} · ${p.comuna}`}
      acciones={<>
        {p.estado === 'pendiente' && (rol === 'bodega' || rol === 'area') && <Boton variante="primario" onClick={() => setAsignar(true)}>Asignar repartidor</Boton>}
        {rol === 'area' && p.repartidorId && p.estado !== 'entregado' && <Boton onClick={() => setReasig(true)}>Reasignar</Boton>}
        {(rol === 'ejecutivo' || rol === 'area') && p.estado !== 'entregado' && p.estado !== 'incidencia' && <Boton variante="fantasma" icono="alert" onClick={() => setInc(true)}>Registrar incidencia</Boton>}
      </>}>
      {abiertas.length > 0 && (
        <Aviso tipo="peligro">
          <strong>{NOMBRE_INCIDENCIA[abiertas[0].tipo]}</strong> · {abiertas[0].comentario} <span className="chico">({fechaHora(abiertas[0].fecha)}, {nombreUsuario(db, abiertas[0].usuarioId)})</span>
          {(rol === 'ejecutivo' || rol === 'area') && <div className="mt-chico"><Boton chico variante="primario" onClick={() => setResolver(true)}>Marcar como resuelta</Boton></div>}
        </Aviso>
      )}
      <div className="grid-sidebar mt">
        <Panel titulo={<span className="flex">Seguimiento <EstadoPedidoTag e={p.estado} /></span>}>
          <ProgresoPedido p={p} />
          <hr className="separador" />
          <LineaTiempo p={p} db={db} interno />
        </Panel>
        <div className="pila">
          <Panel titulo="Despacho">
            <Definiciones items={[
              ['Dirección', `${p.direccion}, ${p.comuna}`], ['Zona', db.zonas.find((z) => z.id === p.zonaId)?.nombre ?? '—'],
              ['Repartidor', p.repartidorId ? `${nombreUsuario(db, p.repartidorId)} (${db.usuarios.find((u) => u.id === p.repartidorId)?.empresaReparto})` : 'Sin asignar'],
              ['Entrega estimada', `${fecha(p.estimadoDesde)} al ${fecha(p.estimadoHasta)}`],
              ['Entrega real', p.entrega ? `${fechaHora(p.entrega.fecha)} · recibió ${p.entrega.receptor}` : '—'],
              ['Evidencia', p.entrega?.evidencia ? (p.entrega.evidencia === 'firma' ? 'Firma digital' : 'Foto') : '—'],
            ]} />
            {p.entrega?.evidenciaData && <img src={p.entrega.evidenciaData} alt="Evidencia de entrega" style={{ width: '100%', marginTop: 12, borderRadius: 8, border: '1px solid var(--borde)' }} />}
          </Panel>
          <Panel titulo="Cliente y compra">
            <Definiciones items={[
              ['Cliente', c ? <button className="enlace" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => navegar('/clientes/' + c.id)}>{nombreCliente(db, c.id)}</button> : '—'],
              ['Teléfono', c?.telefono ?? '—'], ['Venta', v ? `Folio ${v.folio} · ${clp(v.total)}` : '—'],
              ['Prendas', v?.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ') ?? '—'],
            ]} />
          </Panel>
        </div>
      </div>
      {asignar && <ModalAsignar pedido={p} onCerrar={() => setAsignar(false)} />}
      {reasig && <ModalAsignar pedido={p} onCerrar={() => setReasig(false)} reasignar />}
      <Modal titulo="Resolver incidencia" abierto={resolver} onCerrar={() => setResolver(false)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setResolver(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (resultado(intentar(() => resolverIncidencia(p.id, nota)), 'Incidencia resuelta. El pedido vuelve a preparación.')) { setResolver(false); setNota(''); } }}>Guardar</Boton></>}>
        <Campo label="¿Cómo se resolvió?"><Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. La clienta confirmó la dirección correcta por teléfono" /></Campo>
      </Modal>
      <Modal titulo="Registrar incidencia" abierto={inc} onCerrar={() => setInc(false)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setInc(false)}>Cancelar</Boton><Boton variante="peligro" onClick={() => { if (resultado(intentar(() => registrarIncidencia(p.id, tipoInc, coment)), 'Incidencia registrada y cliente notificado')) { setInc(false); setComent(''); } }}>Registrar</Boton></>}>
        <div className="pila" style={{ gap: 12 }}>
          <Campo label="Motivo"><Select value={tipoInc} onChange={(e) => setTipoInc(e.target.value as TipoIncidencia)}>{(Object.keys(NOMBRE_INCIDENCIA) as TipoIncidencia[]).map((k) => <option key={k} value={k}>{NOMBRE_INCIDENCIA[k]}</option>)}</Select></Campo>
          <Campo label="Comentario"><Textarea value={coment} onChange={(e) => setComent(e.target.value)} /></Campo>
        </div>
      </Modal>
    </Pagina>
  );
}

export function ReporteDespacho() {
  const db = useDB();
  const [d, setD] = useState(dia());
  const [rep, setRep] = useState('');
  const [zona, setZona] = useState('');
  const base = db.pedidos.filter((p) => (!rep || p.repartidorId === rep) && (!zona || p.zonaId === zona));
  const despachados = base.filter((p) => p.historial.some((h) => h.estado === 'en_ruta' && dia(h.fecha) === d));
  const entregados = base.filter((p) => p.entrega && dia(p.entrega.fecha) === d);
  const pendientes = base.filter((p) => p.historial[0].fecha <= new Date(d + 'T23:59').toISOString() && (!p.entrega || dia(p.entrega.fecha) > d) && p.estado !== 'entregado');
  const incid = base.filter((p) => p.incidencias.some((i) => dia(i.fecha) === d));
  const filas = [...new Set([...despachados, ...entregados, ...incid])];
  const exportar = () => descargarExcel(`reporte-despacho-${d}`, [{
    nombre: 'Despacho', titulo: `Reporte de despacho ${fecha(d)}`, encabezados: ['Pedido', 'Cliente', 'Comuna', 'Zona', 'Repartidor', 'Estado', 'Despachado', 'Entregado', 'Incidencias'],
    filas: filas.map((p) => [p.nro, nombreCliente(db, p.clienteId), p.comuna, db.zonas.find((z) => z.id === p.zonaId)?.nombre, nombreUsuario(db, p.repartidorId), p.estado, despachados.includes(p) ? 'Sí' : '', p.entrega && dia(p.entrega.fecha) === d ? fechaHora(p.entrega.fecha) : '', p.incidencias.filter((i) => dia(i.fecha) === d).map((i) => NOMBRE_INCIDENCIA[i.tipo]).join(', ')]),
  }, { nombre: 'Pendientes', encabezados: ['Pedido', 'Cliente', 'Comuna', 'Estado', 'Estimado hasta'], filas: pendientes.map((p) => [p.nro, nombreCliente(db, p.clienteId), p.comuna, p.estado, fecha(p.estimadoHasta)]) }]);
  return (
    <Pagina titulo="Reporte diario de despacho" descripcion={<>Pedidos despachados, entregados, pendientes e incidencias del día, filtrable por repartidor y zona. <RF ids="RF11" /></>}
      acciones={<><Boton icono="download" onClick={exportar}>Excel</Boton><Boton icono="printer" onClick={() => exportarPDF(`Reporte de despacho ${fecha(d)}`)}>PDF</Boton></>}>
      <Filtros>
        <Campo label="Día"><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Campo>
        <Campo label="Repartidor"><Select value={rep} onChange={(e) => setRep(e.target.value)}><option value="">Todos</option>{db.usuarios.filter((u) => u.rol === 'repartidor').map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select></Campo>
        <Campo label="Zona"><Select value={zona} onChange={(e) => setZona(e.target.value)}><option value="">Todas</option>{db.zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}</Select></Campo>
      </Filtros>
      <div className="kpis">
        <Kpi label="Despachados" valor={num(despachados.length)} />
        <Kpi label="Entregados" valor={num(entregados.length)} tono="bien" />
        <Kpi label="Pendientes al cierre" valor={num(pendientes.length)} tono={pendientes.length ? 'alerta' : undefined} />
        <Kpi label="Incidencias" valor={num(incid.length)} tono={incid.length ? 'peligro' : undefined} />
      </div>
      <Panel titulo="Movimiento del día" className="panel-plano">
        <Tabla clave={(p) => p.id} filas={filas} onFila={(p) => navegar('/despacho/pedido/' + p.id)} vacio="Sin movimientos de despacho este día."
          columnas={[
            { titulo: 'Pedido', render: (p) => <strong>{p.nro}</strong> },
            { titulo: 'Cliente', render: (p) => nombreCliente(db, p.clienteId) },
            { titulo: 'Comuna', render: (p) => p.comuna },
            { titulo: 'Repartidor', render: (p) => nombreUsuario(db, p.repartidorId) },
            { titulo: 'Estado actual', render: (p) => <EstadoPedidoTag e={p.estado} /> },
            { titulo: 'Entrega', render: (p) => (p.entrega && dia(p.entrega.fecha) === d ? fechaHora(p.entrega.fecha) : '—') },
          ]} />
      </Panel>
      <Panel titulo="Pendientes al cierre del día" className="panel-plano">
        <Tabla clave={(p) => p.id} filas={pendientes} porPagina={10} onFila={(p) => navegar('/despacho/pedido/' + p.id)}
          columnas={[
            { titulo: 'Pedido', render: (p) => <strong>{p.nro}</strong> },
            { titulo: 'Comuna', render: (p) => p.comuna },
            { titulo: 'Repartidor', render: (p) => nombreUsuario(db, p.repartidorId) },
            { titulo: 'Estimado hasta', render: (p) => fecha(p.estimadoHasta) },
            { titulo: 'Estado', render: (p) => <EstadoPedidoTag e={p.estado} /> },
          ]} />
      </Panel>
    </Pagina>
  );
}

export function Zonas() {
  const db = useDB();
  const [edit, setEdit] = useState<Zona | null>(null);
  const [comunasTxt, setComunasTxt] = useState('');
  const [gratis, setGratis] = useState(String(db.config.envioGratisDesde));
  const abrir = (z: Zona) => { setEdit({ ...z }); setComunasTxt(z.comunas.join(', ')); };
  return (
    <Pagina titulo="Zonas y tarifas de despacho" descripcion={<>El costo de envío se calcula solo según la zona de la dirección. Los cambios de tarifa aplican a las ventas nuevas. <RF ids="RF01 · RF01-B · RF07 · HU01-A" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => abrir({ id: '', nombre: '', region: '', comunas: [], tarifa: 3990, diasMin: 2, diasMax: 4, activa: true })}>Nueva zona</Boton>}>
      <Panel titulo="Despacho gratis">
        <div className="flex">
          <Campo label="Monto mínimo de la compra para no cobrar envío">
            <Input type="number" value={gratis} onChange={(e) => setGratis(e.target.value)} style={{ width: 200 }} />
          </Campo>
          <Boton style={{ marginTop: 22 }} onClick={() => { guardarConfig({ envioGratisDesde: Number(gratis) }, `Despacho gratis desde ${clp(Number(gratis))}`); toast('Monto de despacho gratis actualizado'); }}>Guardar</Boton>
        </div>
      </Panel>
      <Panel className="panel-plano">
        <Tabla clave={(z) => z.id} filas={db.zonas}
          columnas={[
            { titulo: 'Zona', render: (z) => <><strong>{z.nombre}</strong><span className="celda-sub">{z.region}</span></> },
            { titulo: 'Comunas', render: (z) => <span className="chico">{z.comunas.join(', ')}</span> },
            { titulo: 'Tarifa', render: (z) => clp(z.tarifa), alinear: 'der' },
            { titulo: 'Plazo', render: (z) => `${z.diasMin} a ${z.diasMax} días` },
            { titulo: 'Estado', render: (z) => <Etiqueta tono={z.activa ? 'bien' : 'neutro'}>{z.activa ? 'Activa' : 'Inactiva'}</Etiqueta> },
            { titulo: '', render: (z) => <Boton chico variante="fantasma" icono="edit" onClick={() => abrir(z)}>Editar</Boton> },
          ]} />
      </Panel>
      <Panel titulo="Repartidores" className="panel-plano">
        <Tabla clave={(u) => u.id} filas={db.usuarios.filter((u) => u.rol === 'repartidor')}
          columnas={[
            { titulo: 'Repartidor', render: (u) => <strong>{u.nombre}</strong> },
            { titulo: 'Empresa de reparto', render: (u) => u.empresaReparto },
            { titulo: 'Zonas', render: (u) => u.zonas?.map((z) => db.zonas.find((x) => x.id === z)?.nombre).join(', ') },
            { titulo: 'Pedidos en curso', render: (u) => cargaRepartidor(db, u.id), alinear: 'der' },
            { titulo: 'Disponible', render: (u) => <Interruptor activo={u.disponible !== false} onChange={(v) => cambiarDisponibilidad(u.id, v)} label={u.disponible !== false ? 'Sí' : 'No'} /> },
          ]} />
      </Panel>
      <Modal titulo={edit?.id ? `Editar ${edit.nombre}` : 'Nueva zona'} abierto={!!edit} onCerrar={() => setEdit(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Boton><Boton variante="primario" onClick={() => {
          if (edit && resultado(intentar(() => guardarZona({ ...edit, comunas: comunasTxt.split(',') })), 'Zona guardada')) setEdit(null);
        }}>Guardar zona</Boton></>}>
        {edit && (
          <div className="form-grid">
            <Campo label="Nombre"><Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <Campo label="Región"><Input value={edit.region} onChange={(e) => setEdit({ ...edit, region: e.target.value })} /></Campo>
            <Campo label="Comunas (separadas por coma)" ancho="completo"><Textarea value={comunasTxt} onChange={(e) => setComunasTxt(e.target.value)} /></Campo>
            <Campo label="Tarifa"><Input type="number" value={edit.tarifa} onChange={(e) => setEdit({ ...edit, tarifa: Number(e.target.value) })} /></Campo>
            <Campo label="Días mínimos"><Input type="number" value={edit.diasMin} onChange={(e) => setEdit({ ...edit, diasMin: Number(e.target.value) })} /></Campo>
            <Campo label="Días máximos"><Input type="number" value={edit.diasMax} onChange={(e) => setEdit({ ...edit, diasMax: Number(e.target.value) })} /></Campo>
            <div className="campo-completo"><Interruptor activo={edit.activa} onChange={(v) => setEdit({ ...edit, activa: v })} label="Zona activa" /></div>
          </div>
        )}
      </Modal>
    </Pagina>
  );
}
