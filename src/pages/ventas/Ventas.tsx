import { useMemo, useState } from 'react';
import { Aviso, Boton, Buscador, Campo, Definiciones, EstadoPedidoTag, Etiqueta, Filtros, Input, Interruptor, Kpi, Modal, Pagina, Panel, RF, Select, Tabla, Textarea, resultado, toast } from '../../components/ui';
import { anularVenta, anularCotizacion, cerrarCaja, guardarPromocion, intentar, registrarDevolucion, useDB, useSesion, ventasDeTurno } from '../../lib/store';
import { navegar } from '../../lib/router';
import { addDays, clp, dia, fecha, fechaHora, hora, num } from '../../lib/format';
import { nombreCliente, nombreUsuario, ventasPorProducto, ventasValidas } from '../../lib/logica';
import { descargarExcel, exportarPDF } from '../../lib/exportar';
import type { MedioPago, Promocion, Venta } from '../../lib/types';
import { NoEncontrado } from '../general/Varios';
import { Barras } from '../../components/Graficos';

const MEDIO: Record<MedioPago, string> = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', efectivo: 'Efectivo' };

export function Ventas() {
  const db = useDB();
  const { usuario } = useSesion();
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState(dia(addDays(new Date(), -30)));
  const [hasta, setHasta] = useState(dia());
  const [medio, setMedio] = useState('');
  const [canal, setCanal] = useState('');
  const [estado, setEstado] = useState('');
  const [soloMias, setSoloMias] = useState(usuario?.rol === 'vendedor');
  const filas = db.ventas
    .filter((v) => dia(v.fecha) >= desde && dia(v.fecha) <= hasta)
    .filter((v) => !medio || v.pago.medio === medio)
    .filter((v) => !canal || v.canal === canal)
    .filter((v) => !estado || v.estado === estado)
    .filter((v) => !soloMias || v.vendedorId === usuario?.id)
    .filter((v) => !q || `${v.folio} ${v.boleta} ${nombreCliente(db, v.clienteId)}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ok = filas.filter((v) => v.estado === 'confirmada');
  const exportar = () => descargarExcel(`ventas-${desde}-a-${hasta}`, [{
    nombre: 'Ventas', titulo: `Ventas del ${fecha(desde)} al ${fecha(hasta)}`,
    encabezados: ['Folio', 'Boleta', 'Fecha', 'Hora', 'Cliente', 'Canal', 'Origen', 'Vendedor', 'Medio de pago', 'Subtotal', 'Descuentos', 'Despacho', 'Total', 'Estado'],
    filas: filas.map((v) => [v.folio, v.boleta, fecha(v.fecha), hora(v.fecha), nombreCliente(db, v.clienteId), v.canal, v.origen === 'vendedor' ? 'Vendedor' : 'Tienda web', nombreUsuario(db, v.vendedorId), MEDIO[v.pago.medio], v.subtotal, v.descCampana + v.descPromo, v.envio, v.total, v.estado]),
  }]);
  return (
    <Pagina titulo="Ventas" descripcion={<>Cada transacción queda registrada con fecha, hora, monto, medio de pago y responsable, y no se puede editar. <RF ids="RF13 · RF15 · RF17" /></>}
      acciones={<Boton icono="download" onClick={exportar}>Exportar Excel</Boton>}>
      <div className="kpis">
        <Kpi label="Ventas confirmadas" valor={num(ok.length)} />
        <Kpi label="Monto vendido" valor={clp(ok.reduce((a, v) => a + v.total, 0))} />
        <Kpi label="Ticket promedio" valor={clp(ok.length ? ok.reduce((a, v) => a + v.total, 0) / ok.length : 0)} />
        <Kpi label="Anuladas" valor={num(filas.length - ok.length)} />
      </div>
      <Panel className="panel-plano mt">
        <div style={{ padding: '16px 20px 0' }}>
          <Filtros>
            <Buscador valor={q} onChange={setQ} placeholder="Folio, boleta o cliente" />
            <Campo label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
            <Campo label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            <Campo label="Medio"><Select value={medio} onChange={(e) => setMedio(e.target.value)}><option value="">Todos</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option></Select></Campo>
            <Campo label="Canal"><Select value={canal} onChange={(e) => setCanal(e.target.value)}><option value="">Todos</option><option value="web">Web</option><option value="movil">Móvil</option></Select></Campo>
            <Campo label="Estado"><Select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option><option value="confirmada">Confirmadas</option><option value="anulada">Anuladas</option></Select></Campo>
            {usuario?.rol === 'vendedor' && <Interruptor activo={soloMias} onChange={setSoloMias} label="Solo mis ventas" />}
          </Filtros>
        </div>
        <Tabla clave={(v) => v.id} filas={filas} onFila={(v) => navegar('/ventas/detalle/' + v.id)}
          columnas={[
            { titulo: 'Folio', render: (v) => <strong>{v.folio}</strong>, ordenar: (v) => v.folio },
            { titulo: 'Fecha', render: (v) => <>{fecha(v.fecha)}<span className="celda-sub">{hora(v.fecha)}</span></>, ordenar: (v) => v.fecha },
            { titulo: 'Cliente', render: (v) => nombreCliente(db, v.clienteId) },
            { titulo: 'Canal', render: (v) => <>{v.canal === 'web' ? 'Web' : 'Móvil'}<span className="celda-sub">{v.origen === 'vendedor' ? nombreUsuario(db, v.vendedorId) : 'Tienda web'}</span></> },
            { titulo: 'Pago', render: (v) => MEDIO[v.pago.medio] },
            { titulo: 'Total', render: (v) => <strong>{clp(v.total)}</strong>, alinear: 'der', ordenar: (v) => v.total },
            { titulo: 'Estado', render: (v) => (v.estado === 'anulada' ? <Etiqueta tono="peligro">Anulada</Etiqueta> : <Etiqueta tono="bien">Confirmada</Etiqueta>) },
          ]} />
      </Panel>
    </Pagina>
  );
}

export function VentaDetalle({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const { usuario } = useSesion();
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState('');
  const v = db.ventas.find((x) => x.id === params.id);
  if (!v) return <NoEncontrado />;
  const p = db.pedidos.find((x) => x.id === v.pedidoId);
  const devs = db.devoluciones.filter((d) => d.ventaId === v.id);
  const puedeAnular = usuario?.rol === 'area' && v.estado === 'confirmada';
  return (
    <Pagina titulo={`Venta folio ${v.folio}`} volver="/ventas" descripcion={`${fechaHora(v.fecha)} · ${nombreCliente(db, v.clienteId)}`}
      acciones={<>
        <Boton icono="receipt" onClick={() => navegar('/boleta/' + v.id)}>Boleta N° {v.boleta}</Boton>
        {puedeAnular && <Boton variante="peligro" onClick={() => setAnular(true)}>Autorizar anulación</Boton>}
      </>}>
      {v.estado === 'anulada' && <Aviso tipo="peligro"><strong>Venta anulada</strong> el {fechaHora(v.anulacion?.fecha)} por {nombreUsuario(db, v.anulacion?.autorizadaPor)}. Motivo: {v.anulacion?.motivo}</Aviso>}
      {usuario?.rol === 'vendedor' && v.estado === 'confirmada' && <Aviso tipo="info">Para anular esta venta, pide la autorización de un Administrador de Área (RF17).</Aviso>}
      <div className="grid-sidebar mt">
        <Panel titulo="Detalle" className="panel-plano">
          <Tabla clave={(i) => i.productoId + i.talla} filas={v.items}
            columnas={[
              { titulo: 'Producto', render: (i) => <><strong>{i.nombre}</strong><span className="celda-sub">Talla {i.talla}</span></> },
              { titulo: 'Cantidad', render: (i) => i.cantidad, alinear: 'der' },
              { titulo: 'Precio', render: (i) => clp(i.precioUnit), alinear: 'der' },
              { titulo: 'Total', render: (i) => clp(i.precioUnit * i.cantidad), alinear: 'der' },
            ]} />
          <div style={{ padding: '14px 20px' }} className="resumen-filas">
            <div><span>Subtotal</span><span>{clp(v.subtotal)}</span></div>
            {v.descCampana > 0 && <div><span>Descuento campaña ({db.campanas.find((c) => c.id === v.campanaId)?.nombre})</span><span>−{clp(v.descCampana)}</span></div>}
            {v.descPromo > 0 && <div><span>Promoción ({db.promociones.find((x) => x.id === v.promoId)?.nombre})</span><span>−{clp(v.descPromo)}</span></div>}
            <div><span>Despacho</span><span>{clp(v.envio)}</span></div>
            <div className="total"><span>Total</span><span>{clp(v.total)}</span></div>
          </div>
        </Panel>
        <div className="pila">
          <Panel titulo="Transacción">
            <Definiciones items={[
              ['Fecha y hora', fechaHora(v.fecha)], ['Responsable', v.vendedorId ? nombreUsuario(db, v.vendedorId) : 'Tienda web (cliente)'], ['Canal', v.canal === 'web' ? 'Web' : 'Móvil'],
              ['Medio de pago', MEDIO[v.pago.medio]], ['Detalle del pago', v.pago.medio === 'efectivo' ? `Recibido ${clp(v.pago.montoRecibido ?? 0)} · vuelto ${clp(v.pago.vuelto ?? 0)}` : v.pago.medio === 'transferencia' ? `Operación ${v.pago.nroOperacion}` : `Tarjeta terminada en ${v.pago.tarjeta}`],
              ['Cotización', v.cotizacionId ? `N° ${db.cotizaciones.find((c) => c.id === v.cotizacionId)?.folio}` : '—'],
            ]} />
          </Panel>
          {p && (
            <Panel titulo="Pedido de despacho" acciones={<Boton chico onClick={() => navegar('/despacho/pedido/' + p.id)}>Ver pedido</Boton>}>
              <div className="flex"><strong>{p.nro}</strong><EstadoPedidoTag e={p.estado} /></div>
              <p className="chico texto-2 mt-chico">{p.direccion}, {p.comuna}</p>
            </Panel>
          )}
          {devs.length > 0 && (
            <Panel titulo="Devoluciones">
              {devs.map((d) => <p key={d.id} className="chico">{fecha(d.fecha)} · {d.tipo === 'reembolso' ? 'Reembolso' : `Nota de crédito N° ${d.folioNC}`} · {clp(d.monto)} · {d.motivo}</p>)}
            </Panel>
          )}
        </div>
      </div>
      <Modal titulo={`Anular venta folio ${v.folio}`} abierto={anular} onCerrar={() => setAnular(false)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setAnular(false)}>Cancelar</Boton><Boton variante="peligro" onClick={() => {
          if (resultado(intentar(() => anularVenta(v.id, motivo)), 'Venta anulada. Se repuso el stock y se reversó el ingreso.')) setAnular(false);
        }}>Anular venta</Boton></>}>
        <p className="texto-modal" style={{ marginBottom: 12 }}>La anulación queda registrada con tu nombre y el motivo. Se devuelve el stock, se cancela el pedido y se reversa el ingreso en finanzas. No se puede deshacer.</p>
        <Campo label="Motivo de la anulación"><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. Clienta pagó dos veces por error" /></Campo>
      </Modal>
    </Pagina>
  );
}

export function Cotizaciones() {
  const db = useDB();
  const ahora = new Date().toISOString();
  const est = (c: (typeof db.cotizaciones)[number]) => (c.estado !== 'vigente' ? c.estado : addDays(c.fecha, c.vigenciaDias).toISOString() < ahora ? 'vencida' : 'vigente');
  const filas = [...db.cotizaciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Cotizaciones" descripcion={<>Precios formales para el cliente antes de confirmar la venta, con vigencia configurable. <RF ids="RF24" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => navegar('/ventas/nueva')}>Nueva cotización</Boton>}>
      <Aviso tipo="info">Para crear una cotización arma la venta en <strong>Nueva venta</strong> y elige <strong>Guardar como cotización</strong>.</Aviso>
      <Panel className="panel-plano mt">
        <Tabla clave={(c) => c.id} filas={filas}
          columnas={[
            { titulo: 'N°', render: (c) => <strong>{c.folio}</strong> },
            { titulo: 'Fecha', render: (c) => fecha(c.fecha) },
            { titulo: 'Cliente', render: (c) => nombreCliente(db, c.clienteId) },
            { titulo: 'Prendas', render: (c) => <span className="chico">{c.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}</span> },
            { titulo: 'Total', render: (c) => clp(c.total), alinear: 'der' },
            { titulo: 'Vence', render: (c) => fecha(addDays(c.fecha, c.vigenciaDias).toISOString()) },
            { titulo: 'Estado', render: (c) => { const e = est(c); return <Etiqueta tono={e === 'vigente' ? 'bien' : e === 'convertida' ? 'info' : 'neutro'}>{e === 'convertida' ? 'Convertida en venta' : e.charAt(0).toUpperCase() + e.slice(1)}</Etiqueta>; } },
            { titulo: '', render: (c) => est(c) === 'vigente' ? (
              <div className="fila-acciones">
                <Boton chico variante="primario" onClick={() => navegar('/ventas/nueva?cotizacion=' + c.id)}>Convertir en venta</Boton>
                <Boton chico variante="fantasma" onClick={() => { anularCotizacion(c.id); toast('Cotización anulada'); }}>Anular</Boton>
              </div>
            ) : c.ventaId ? <Boton chico variante="fantasma" onClick={() => navegar('/ventas/detalle/' + c.ventaId)}>Ver venta</Boton> : null },
          ]} />
      </Panel>
    </Pagina>
  );
}

export function Devoluciones() {
  const db = useDB();
  const [abierto, setAbierto] = useState(false);
  const [busq, setBusq] = useState('');
  const [venta, setVenta] = useState<Venta | null>(null);
  const [cants, setCants] = useState<Record<string, number>>({});
  const [tipo, setTipo] = useState<'nota_credito' | 'reembolso'>('nota_credito');
  const [motivo, setMotivo] = useState('');
  const buscar = () => {
    const v = db.ventas.find((x) => String(x.folio) === busq.trim() || String(x.boleta) === busq.trim());
    if (!v) return toast('No hay ventas con ese folio o número de boleta.', 'peligro');
    if (v.estado !== 'confirmada') return toast('La venta está anulada.', 'peligro');
    setVenta(v);
    setCants({});
  };
  const filas = [...db.devoluciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Devoluciones" descripcion={<>Devuelve prendas generando una nota de crédito o un reembolso. El stock vuelve a bodega y el monto queda como egreso. <RF ids="RF22" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => { setAbierto(true); setVenta(null); setBusq(''); setMotivo(''); }}>Registrar devolución</Boton>}>
      <Panel className="panel-plano">
        <Tabla clave={(d) => d.id} filas={filas} vacio="Aún no hay devoluciones."
          columnas={[
            { titulo: 'Fecha', render: (d) => fecha(d.fecha) },
            { titulo: 'Venta', render: (d) => { const v = db.ventas.find((x) => x.id === d.ventaId); return <button className="enlace" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => navegar('/ventas/detalle/' + d.ventaId)}>Folio {v?.folio}</button>; } },
            { titulo: 'Cliente', render: (d) => nombreCliente(db, db.ventas.find((x) => x.id === d.ventaId)?.clienteId) },
            { titulo: 'Prendas', render: (d) => d.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ') },
            { titulo: 'Tipo', render: (d) => (d.tipo === 'reembolso' ? <Etiqueta tono="alerta">Reembolso</Etiqueta> : <Etiqueta tono="info">Nota de crédito N° {d.folioNC}</Etiqueta>) },
            { titulo: 'Monto', render: (d) => clp(d.monto), alinear: 'der' },
            { titulo: 'Motivo', render: (d) => <span className="chico">{d.motivo}</span> },
            { titulo: 'Registró', render: (d) => nombreUsuario(db, d.usuarioId) },
          ]} />
      </Panel>
      <Modal titulo="Registrar devolución" abierto={abierto} onCerrar={() => setAbierto(false)}
        pie={venta ? <><Boton variante="fantasma" onClick={() => setAbierto(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => {
          const r = intentar(() => registrarDevolucion(venta.id, Object.entries(cants).map(([productoId, cantidad]) => ({ productoId, cantidad })), tipo, motivo));
          if (r.ok) { toast(`Devolución registrada por ${clp(r.valor.monto)}${r.valor.folioNC ? ` · nota de crédito N° ${r.valor.folioNC}` : ''}`); setAbierto(false); }
          else toast(r.error, 'peligro');
        }}>Registrar devolución</Boton></> : undefined}>
        <form className="flex" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
          <div style={{ flex: 1 }}><Campo label="Folio de venta o número de boleta"><Input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder={`ej. ${db.ventas[db.ventas.length - 5]?.folio}`} /></Campo></div>
          <Boton type="submit" style={{ marginTop: 22 }}>Buscar</Boton>
        </form>
        {venta && (
          <div className="mt">
            <p className="chico texto-2">Venta folio {venta.folio} · {fecha(venta.fecha)} · {nombreCliente(db, venta.clienteId)} · {clp(venta.total)}</p>
            <ul className="lista-simple mt-chico">
              {venta.items.map((i) => (
                <li key={i.productoId}>
                  <span>{i.nombre} <span className="texto-3 chico">(vendidas {i.cantidad})</span></span>
                  <Input type="number" min={0} max={i.cantidad} value={cants[i.productoId] ?? 0} onChange={(e) => setCants({ ...cants, [i.productoId]: Number(e.target.value) })} style={{ width: 90 }} aria-label={`Unidades a devolver de ${i.nombre}`} />
                </li>
              ))}
            </ul>
            <div className="form-grid mt">
              <Campo label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}><option value="nota_credito">Nota de crédito</option><option value="reembolso">Reembolso</option></Select></Campo>
              <Campo label="Motivo" ancho="completo"><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. La talla no le quedó" /></Campo>
            </div>
          </div>
        )}
      </Modal>
    </Pagina>
  );
}

export function CierreCaja() {
  const db = useDB();
  const turnosVenta = db.turnos.filter((t) => t.id === 't1' || t.id === 't2');
  const [turno, setTurno] = useState(turnosVenta.find((t) => { const h = new Date().getHours(); return h >= Number(t.inicio.slice(0, 2)) && h < Number(t.fin.slice(0, 2)); })?.id ?? 't1');
  const vs = ventasDeTurno(db, turno);
  const ok = vs.filter((v) => v.estado === 'confirmada');
  const porMedio = (m: MedioPago) => ok.filter((v) => v.pago.medio === m).reduce((a, v) => a + v.total, 0);
  const yaCerrado = db.cierres.find((c) => c.turnoId === turno && dia(c.fecha) === dia());
  const historial = [...db.cierres].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const porVendedor = useMemo(() => {
    const m: Record<string, { n: number; total: number }> = {};
    ok.forEach((v) => { const k = v.vendedorId ?? 'web'; m[k] = m[k] ?? { n: 0, total: 0 }; m[k].n++; m[k].total += v.total; });
    return Object.entries(m);
  }, [ok]);
  return (
    <Pagina titulo="Cierre de caja" descripcion={<>Consolida las ventas del día al término de cada turno, separadas por medio de pago. <RF ids="RF23" /></>}>
      <Panel titulo={`Turno de hoy · ${fecha(dia())}`} acciones={<Select value={turno} onChange={(e) => setTurno(e.target.value)} aria-label="Turno" style={{ width: 220 }}>{turnosVenta.map((t) => <option key={t.id} value={t.id}>{t.nombre} ({t.inicio}–{t.fin})</option>)}</Select>}>
        <div className="kpis">
          <Kpi label="Ventas del turno" valor={num(ok.length)} detalle={vs.length - ok.length ? `${vs.length - ok.length} anuladas` : undefined} />
          <Kpi label="Tarjeta" valor={clp(porMedio('tarjeta'))} />
          <Kpi label="Transferencia" valor={clp(porMedio('transferencia'))} />
          <Kpi label="Efectivo en caja" valor={clp(porMedio('efectivo'))} />
          <Kpi label="Total del turno" valor={clp(ok.reduce((a, v) => a + v.total, 0))} tono="bien" />
        </div>
        {porVendedor.length > 0 && (
          <p className="chico texto-2 mt">{porVendedor.map(([k, x]) => `${k === 'web' ? 'Tienda web' : nombreUsuario(db, k)}: ${x.n} ventas (${clp(x.total)})`).join(' · ')}</p>
        )}
        <div className="flex mt">
          {yaCerrado ? (
            <Aviso tipo="bien">Turno cerrado a las {hora(yaCerrado.fecha)} por {nombreUsuario(db, yaCerrado.usuarioId)}.</Aviso>
          ) : (
            <Boton variante="primario" icono="check" onClick={() => resultado(intentar(() => cerrarCaja(turno)), 'Cierre de caja registrado')}>Cerrar caja del turno</Boton>
          )}
        </div>
      </Panel>
      <Panel titulo="Cierres anteriores" className="panel-plano">
        <Tabla clave={(c) => c.id} filas={historial} porPagina={10}
          columnas={[
            { titulo: 'Fecha', render: (c) => fecha(c.fecha) },
            { titulo: 'Turno', render: (c) => db.turnos.find((t) => t.id === c.turnoId)?.nombre },
            { titulo: 'Cerró', render: (c) => nombreUsuario(db, c.usuarioId) },
            { titulo: 'Ventas', render: (c) => c.ventas, alinear: 'der' },
            { titulo: 'Tarjeta', render: (c) => clp(c.porMedio.tarjeta), alinear: 'der' },
            { titulo: 'Transferencia', render: (c) => clp(c.porMedio.transferencia), alinear: 'der' },
            { titulo: 'Efectivo', render: (c) => clp(c.porMedio.efectivo), alinear: 'der' },
            { titulo: 'Total', render: (c) => <strong>{clp(c.total)}</strong>, alinear: 'der' },
          ]} />
      </Panel>
    </Pagina>
  );
}

export function Promociones() {
  const db = useDB();
  const [edit, setEdit] = useState<(Partial<Promocion> & { nombre: string; porcentaje: number; activa: boolean }) | null>(null);
  return (
    <Pagina titulo="Promociones" descripcion={<>Descuentos que los vendedores pueden aplicar en una venta. Solo se usan los que están autorizados y activos. <RF ids="RF19" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => setEdit({ nombre: '', porcentaje: 10, activa: true })}>Nueva promoción</Boton>}>
      <Panel className="panel-plano">
        <Tabla clave={(p) => p.id} filas={db.promociones}
          columnas={[
            { titulo: 'Promoción', render: (p) => <strong>{p.nombre}</strong> },
            { titulo: 'Descuento', render: (p) => `${p.porcentaje}%`, alinear: 'der' },
            { titulo: 'Autorizada por', render: (p) => nombreUsuario(db, p.autorizadaPor) },
            { titulo: 'Veces usada', render: (p) => num(db.ventas.filter((v) => v.promoId === p.id).length), alinear: 'der' },
            { titulo: 'Estado', render: (p) => <Etiqueta tono={p.activa ? 'bien' : 'neutro'}>{p.activa ? 'Activa' : 'Inactiva'}</Etiqueta> },
            { titulo: '', render: (p) => <Boton chico variante="fantasma" icono="edit" onClick={() => setEdit({ ...p })}>Editar</Boton> },
          ]} />
      </Panel>
      <Modal titulo={edit?.id ? 'Editar promoción' : 'Nueva promoción'} abierto={!!edit} onCerrar={() => setEdit(null)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (edit && resultado(intentar(() => guardarPromocion(edit)), 'Promoción guardada')) setEdit(null); }}>Guardar</Boton></>}>
        {edit && (
          <div className="pila" style={{ gap: 12 }}>
            <Campo label="Nombre"><Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
            <Campo label="Descuento (%)"><Input type="number" value={edit.porcentaje} onChange={(e) => setEdit({ ...edit, porcentaje: Number(e.target.value) })} /></Campo>
            <Interruptor activo={edit.activa} onChange={(v) => setEdit({ ...edit, activa: v })} label="Disponible para los vendedores" />
          </div>
        )}
      </Modal>
    </Pagina>
  );
}

export function ReporteDiarioVentas() {
  const db = useDB();
  const [d, setD] = useState(dia());
  const vs = ventasValidas(db).filter((v) => dia(v.fecha) === d);
  const porProd = ventasPorProducto(vs);
  const filas = Object.entries(porProd).map(([pid, x]) => ({ p: db.productos.find((y) => y.id === pid)!, ...x })).sort((a, b) => b.monto - a.monto);
  const total = vs.reduce((a, v) => a + v.total, 0);
  const horas = Array.from({ length: 14 }, (_, i) => i + 9).map((h) => ({ label: `${h}h`, valor: vs.filter((v) => new Date(v.fecha).getHours() === h).reduce((a, v) => a + v.total, 0), detalle: `${vs.filter((v) => new Date(v.fecha).getHours() === h).length} ventas` }));
  const exportar = () => descargarExcel(`reporte-ventas-${d}`, [
    { nombre: 'Productos', titulo: `Reporte de ventas del ${fecha(d)}`, encabezados: ['Código', 'Producto', 'Línea', 'Unidades', 'Monto bruto'], filas: filas.map((f) => [f.p.sku, f.p.nombre, f.p.linea, f.unidades, f.monto]) },
    { nombre: 'Ventas', encabezados: ['Folio', 'Hora', 'Cliente', 'Medio', 'Total'], filas: vs.map((v) => [v.folio, hora(v.fecha), nombreCliente(db, v.clienteId), MEDIO[v.pago.medio], v.total]) },
  ]);
  return (
    <Pagina titulo="Reporte diario de ventas" descripcion={<>Detalle de productos, cantidades y montos vendidos en el día. <RF ids="RF67" /></>}
      acciones={<>
        <Input type="date" value={d} onChange={(e) => setD(e.target.value)} style={{ width: 170 }} aria-label="Día del reporte" />
        <Boton icono="download" onClick={exportar}>Excel</Boton>
        <Boton icono="printer" onClick={() => exportarPDF(`Reporte de ventas ${fecha(d)}`)}>PDF</Boton>
      </>}>
      <div className="kpis">
        <Kpi label="Ventas" valor={num(vs.length)} />
        <Kpi label="Monto total" valor={clp(total)} />
        <Kpi label="Prendas vendidas" valor={num(filas.reduce((a, f) => a + f.unidades, 0))} />
        <Kpi label="Ticket promedio" valor={clp(vs.length ? total / vs.length : 0)} />
      </div>
      <Panel titulo="Ventas por hora">
        <Barras etiqueta="Monto vendido por hora del día" datos={horas} formatoTip={clp} alto={180} />
      </Panel>
      <Panel titulo={`Productos vendidos el ${fecha(d)}`} className="panel-plano">
        <Tabla clave={(f) => f.p.id} filas={filas} vacio="No hubo ventas este día." porPagina={50}
          columnas={[
            { titulo: 'Código', render: (f) => <span className="mono">{f.p.sku}</span> },
            { titulo: 'Producto', render: (f) => <><strong>{f.p.nombre}</strong><span className="celda-sub">{f.p.color}</span></> },
            { titulo: 'Línea', render: (f) => f.p.linea },
            { titulo: 'Unidades', render: (f) => num(f.unidades), alinear: 'der' },
            { titulo: 'Monto', render: (f) => clp(f.monto), alinear: 'der' },
          ]} />
      </Panel>
    </Pagina>
  );
}
