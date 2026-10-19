import { useEffect, useMemo, useState } from 'react';
import { Prenda } from '../../components/Prenda';
import { Aviso, Boton, Buscador, Campo, CategoriaTag, Etiqueta, Input, Modal, Pagina, Panel, Pestanas, RF, Select, toast } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { calcularTotales, crearCotizacion, crearVenta, intentar, registrarPagoRechazado, useDB } from '../../lib/store';
import { navegar, useRuta } from '../../lib/router';
import { addDays, clp, fecha } from '../../lib/format';
import { motivoSugerencia, stockTotal, sugerenciasPara } from '../../lib/logica';
import { LINEAS } from '../../lib/types';
import type { Canal, ItemVenta, LineaProducto, MedioPago, Venta } from '../../lib/types';
import { SelectorCliente } from '../comercial/Clientes';

export function NuevaVenta() {
  const db = useDB();
  const { query } = useRuta();
  const cotId = query.get('cotizacion') ?? undefined;
  const cot = cotId ? db.cotizaciones.find((c) => c.id === cotId) : undefined;
  const [canal, setCanal] = useState<Canal>(() => (window.innerWidth < 760 ? 'movil' : 'web'));
  const [clienteId, setClienteId] = useState<string>(cot?.clienteId ?? '');
  const [items, setItems] = useState<ItemVenta[]>(cot ? cot.items.map((i) => ({ ...i })) : []);
  const [q, setQ] = useState('');
  const [linea, setLinea] = useState<LineaProducto | 'Todas'>('Todas');
  const [promoId, setPromoId] = useState('');
  const [medio, setMedio] = useState<MedioPago>('tarjeta');
  const [recibido, setRecibido] = useState('');
  const [nroOp, setNroOp] = useState('');
  const [rechazar, setRechazar] = useState(false);
  const [aviso, setAviso] = useState('');
  const [hecha, setHecha] = useState<Venta | null>(null);
  const [cotModal, setCotModal] = useState(false);
  const [vigencia, setVigencia] = useState('7');

  useEffect(() => {
    if (cot && cot.estado !== 'vigente') toast('Esta cotización ya no está vigente.', 'peligro');
  }, [cot]);

  const cliente = db.clientes.find((c) => c.id === clienteId);
  const t = calcularTotales(db, clienteId, items, promoId || undefined);
  const productos = db.productos
    .filter((p) => p.activo && (linea === 'Todas' || p.linea === linea))
    .filter((p) => !q || `${p.nombre} ${p.sku} ${p.color}`.toLowerCase().includes(q.toLowerCase()));
  const sugeridos = useMemo(() => (clienteId ? sugerenciasPara(db, clienteId, 3) : []), [db, clienteId]);
  const vuelto = Number(recibido || 0) - t.total;

  const agregar = (pid: string) => {
    const p = db.productos.find((x) => x.id === pid)!;
    const s = stockTotal(p);
    if (s === 0) {
      setAviso(`${p.nombre} (${p.color}) no tiene stock, por eso no se puede vender. Bodega ya tiene la alerta.`);
      return;
    }
    const enVenta = items.filter((i) => i.productoId === pid).reduce((a, i) => a + i.cantidad, 0);
    if (enVenta + 1 > s) {
      setAviso(`Stock insuficiente: ${p.nombre} tiene ${s} unidades y ya agregaste ${enVenta}.`);
      return;
    }
    setAviso('');
    const ex = items.find((i) => i.productoId === pid && i.talla === 'M');
    if (ex) setItems(items.map((i) => (i === ex ? { ...i, cantidad: i.cantidad + 1 } : i)));
    else setItems([...items, { productoId: p.id, nombre: p.nombre, talla: 'M', cantidad: 1, precioUnit: p.precio, costoUnit: p.costo }]);
  };
  const cambiar = (idx: number, cambios: Partial<ItemVenta>) => {
    const it = items[idx];
    if (cambios.cantidad !== undefined) {
      if (cambios.cantidad <= 0) return setItems(items.filter((_, i) => i !== idx));
      const p = db.productos.find((x) => x.id === it.productoId)!;
      const otros = items.filter((x, i) => i !== idx && x.productoId === it.productoId).reduce((a, x) => a + x.cantidad, 0);
      if (cambios.cantidad + otros > stockTotal(p)) {
        setAviso(`Stock insuficiente: ${p.nombre} tiene ${stockTotal(p)} unidades disponibles.`);
        return;
      }
    }
    setAviso('');
    setItems(items.map((x, i) => (i === idx ? { ...x, ...cambios } : x)));
  };

  const confirmar = () => {
    if (!cliente) return toast('Selecciona o registra al cliente.', 'peligro');
    if (medio === 'tarjeta' && rechazar) {
      registrarPagoRechazado(clienteId, t.total);
      toast('Pago con tarjeta rechazado. La venta no se registró; prueba con otro medio de pago.', 'peligro');
      return;
    }
    const r = intentar(() => crearVenta({
      clienteId, items, canal, origen: 'vendedor', medio, promoId: promoId || undefined, cotizacionId: cot?.estado === 'vigente' ? cot.id : undefined,
      montoRecibido: medio === 'efectivo' ? Number(recibido) : undefined, nroOperacion: medio === 'transferencia' ? nroOp : undefined,
      tarjeta: medio === 'tarjeta' ? String(1000 + Math.floor(Math.random() * 9000)) : undefined,
    }));
    if (!r.ok) return toast(r.error, 'peligro');
    setHecha(r.valor);
  };

  const reiniciar = () => {
    setItems([]); setClienteId(''); setPromoId(''); setRecibido(''); setNroOp(''); setHecha(null); setAviso('');
    if (cotId) navegar('/ventas/nueva', { replace: true });
  };

  return (
    <Pagina titulo={cot ? `Venta desde cotización N° ${cot.folio}` : 'Nueva venta'} descripcion={<>Registra ventas desde el computador o el celular. El stock, la boleta, el pedido de despacho y el ingreso en finanzas se generan solos. <RF ids="RF13–RF21 · RF63" /></>}
      acciones={
        <Pestanas valor={canal} onChange={setCanal} opciones={[{ id: 'web', label: <span className="flex"><Icono n="store" size={15} /> Web</span> }, { id: 'movil', label: <span className="flex"><Icono n="phone" size={15} /> Móvil</span> }]} />
      }>
      <div className="pos">
        <div className="pila">
          <Panel titulo="Cliente">
            <SelectorCliente valor={clienteId} onChange={setClienteId} />
            {cliente && (
              <div className="flex mt">
                <CategoriaTag c={t.categoria} />
                {t.campana ? <Etiqueta tono="bien">{t.campana.nombre}: {t.pctCampana}% de descuento automático</Etiqueta> : <span className="chico texto-3">Sin campaña activa para su categoría</span>}
                <span className="chico texto-3">{cliente.tipo === 'empresa' ? 'Empresa' : 'Persona'} · despacho a {cliente.comuna}</span>
              </div>
            )}
            {sugeridos.length > 0 && (
              <div className="mt">
                <span className="campo-label">Sugerencias para este cliente</span>
                <div className="flex mt-chico">
                  {sugeridos.map((p) => (
                    <button key={p.id} className="chip" onClick={() => agregar(p.id)} title={motivoSugerencia(db, clienteId, p)}>+ {p.nombre} · {p.color}</button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <Panel titulo="Productos" acciones={<Buscador valor={q} onChange={setQ} placeholder="Nombre, código o color" />}>
            <div className="chips" style={{ marginBottom: 12 }}>
              {(['Todas', ...LINEAS] as const).map((l) => <button key={l} className={`chip ${linea === l ? 'activo' : ''}`} onClick={() => setLinea(l)}>{l}</button>)}
            </div>
            {aviso && <div style={{ marginBottom: 12 }}><Aviso tipo="alerta">{aviso}</Aviso></div>}
            <div className="resultado-busqueda">
              {productos.map((p) => {
                const s = stockTotal(p);
                return (
                  <button key={p.id} className="prod-mini" onClick={() => agregar(p.id)} aria-disabled={s === 0} style={s === 0 ? { opacity: 0.55 } : undefined}>
                    <Prenda linea={p.linea} color={p.colorHex} tamano="chico" etiqueta={p.nombre} />
                    <strong>{p.nombre}</strong>
                    <span>{p.color} · {clp(p.precio)}</span>
                    <span className={s === 0 ? 'texto-peligro' : s < p.umbralMin ? 'texto-alerta' : ''}>{s === 0 ? 'Sin stock' : `${s} en stock`}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="pos-resumen">
          <Panel titulo={`Detalle (${items.reduce((a, i) => a + i.cantidad, 0)} prendas)`}>
            {!items.length && <p className="texto-3 chico">Agrega productos desde el listado.</p>}
            {items.map((it, i) => (
              <div className="item-venta" key={`${it.productoId}-${i}`}>
                <div>
                  <strong className="chico">{it.nombre}</strong>
                  <div className="chico texto-3">{clp(it.precioUnit)} c/u</div>
                </div>
                <strong className="mono">{clp(it.precioUnit * it.cantidad)}</strong>
                <div className="controles">
                  <Select value={it.talla} onChange={(e) => cambiar(i, { talla: e.target.value })} aria-label="Talla">
                    {['XS', 'S', 'M', 'L', 'XL'].map((x) => <option key={x}>{x}</option>)}
                  </Select>
                  <div className="cantidad">
                    <button onClick={() => cambiar(i, { cantidad: it.cantidad - 1 })} aria-label="Quitar una unidad"><Icono n="minus" size={14} /></button>
                    <span>{it.cantidad}</span>
                    <button onClick={() => cambiar(i, { cantidad: it.cantidad + 1 })} aria-label="Agregar una unidad"><Icono n="plus" size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            <hr className="separador" />
            <Campo label="Promoción autorizada" ayuda="Solo aparecen las promociones aprobadas por un administrador (RF19).">
              <Select value={promoId} onChange={(e) => setPromoId(e.target.value)}>
                <option value="">Sin promoción</option>
                {db.promociones.filter((p) => p.activa).map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.porcentaje}%)</option>)}
              </Select>
            </Campo>
            <div className="resumen-filas mt">
              <div><span>Subtotal</span><span className="mono">{clp(t.subtotal)}</span></div>
              {t.descCampana > 0 && <div className="texto-bien"><span>Campaña ({t.pctCampana}%)</span><span className="mono">−{clp(t.descCampana)}</span></div>}
              {t.descPromo > 0 && <div className="texto-bien"><span>{t.promo?.nombre}</span><span className="mono">−{clp(t.descPromo)}</span></div>}
              <div><span>Despacho {t.zona ? `(${t.zona.nombre})` : ''} {t.envioGratis && <span className="texto-bien">gratis</span>}</span><span className="mono">{clp(t.envio)}</span></div>
              <div className="total"><span>Total</span><span>{clp(t.total)}</span></div>
            </div>
            <hr className="separador" />
            <span className="campo-label">Medio de pago</span>
            <div className="medios mt-chico" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {(['tarjeta', 'transferencia', 'efectivo'] as MedioPago[]).map((m) => (
                <button key={m} className={`medio ${medio === m ? 'activo' : ''}`} onClick={() => setMedio(m)} style={{ padding: '10px 8px', fontSize: 13, justifyContent: 'center' }}>
                  {m === 'tarjeta' ? 'Tarjeta' : m === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                </button>
              ))}
            </div>
            {medio === 'efectivo' && (
              <div className="mt-chico">
                <Campo label="Monto recibido" ayuda={recibido ? (vuelto >= 0 ? <span className="texto-bien">Vuelto: {clp(vuelto)}</span> : <span className="texto-peligro">Faltan {clp(-vuelto)}</span>) : 'El vuelto se calcula solo (RF21).'}>
                  <Input type="number" inputMode="numeric" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={String(Math.ceil(t.total / 1000) * 1000)} />
                </Campo>
              </div>
            )}
            {medio === 'transferencia' && (
              <div className="mt-chico"><Campo label="Número de operación"><Input value={nroOp} onChange={(e) => setNroOp(e.target.value)} /></Campo></div>
            )}
            {medio === 'tarjeta' && (
              <label className="check mt-chico"><input type="checkbox" checked={rechazar} onChange={(e) => setRechazar(e.target.checked)} /> Simular rechazo del pago</label>
            )}
            <Boton variante="primario" className="ancho-total mt" disabled={!items.length || !clienteId || (medio === 'efectivo' && vuelto < 0)} onClick={confirmar}>
              Confirmar venta · {clp(t.total)}
            </Boton>
            <Boton variante="fantasma" className="ancho-total mt-chico" icono="quote" disabled={!items.length || !clienteId} onClick={() => setCotModal(true)}>Guardar como cotización</Boton>
          </Panel>
        </div>
      </div>

      <Modal titulo="Venta registrada" abierto={!!hecha} onCerrar={reiniciar}
        pie={<><Boton icono="receipt" onClick={() => hecha && navegar('/boleta/' + hecha.id)}>Ver boleta</Boton><Boton variante="primario" onClick={reiniciar}>Nueva venta</Boton></>}>
        {hecha && (
          <div className="pila" style={{ gap: 10 }}>
            <Aviso tipo="bien"><strong>Folio {hecha.folio} · boleta N° {hecha.boleta}</strong> por {clp(hecha.total)}.</Aviso>
            {hecha.pago.medio === 'efectivo' && <p>Entrega un vuelto de <strong>{clp(hecha.pago.vuelto ?? 0)}</strong>.</p>}
            <p className="texto-2">Se descontó el stock, se creó el pedido {db.pedidos.find((p) => p.id === hecha.pedidoId)?.nro} para bodega y el ingreso quedó registrado en finanzas. La transacción ya no se puede editar.</p>
          </div>
        )}
      </Modal>

      <Modal titulo="Guardar cotización" abierto={cotModal} onCerrar={() => setCotModal(false)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setCotModal(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => {
          const r = intentar(() => crearCotizacion(clienteId, items, Number(vigencia)));
          if (r.ok) { toast(`Cotización N° ${r.valor.folio} guardada. Vence el ${fecha(addDays(r.valor.fecha, r.valor.vigenciaDias).toISOString())}.`); setCotModal(false); reiniciar(); navegar('/ventas/cotizaciones'); }
          else toast(r.error, 'peligro');
        }}>Guardar cotización</Boton></>}>
        <p className="texto-modal" style={{ marginBottom: 12 }}>La cotización guarda los precios de hoy para {cliente?.nombre}. Total {clp(t.subtotal + t.envio)} (los descuentos de campaña se aplican al momento de comprar).</p>
        <Campo label="Vigencia en días"><Input type="number" min={1} value={vigencia} onChange={(e) => setVigencia(e.target.value)} /></Campo>
      </Modal>
    </Pagina>
  );
}
