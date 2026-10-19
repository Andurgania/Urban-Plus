import { useMemo, useState } from 'react';
import { Prenda } from '../../components/Prenda';
import { Aviso, Boton, Campo, CategoriaTag, Input, Panel, Select, Vacio, toast, Interruptor } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { calcularTotales, cambiarCantidadCarrito, crearVenta, intentar, registrarPagoRechazado, useCarrito, useDB, useSesion, vaciarCarrito } from '../../lib/store';
import { navegar } from '../../lib/router';
import { clp, fecha } from '../../lib/format';
import { fechaEstimada, stockTotal } from '../../lib/logica';
import type { ItemVenta, MedioPago } from '../../lib/types';

export function useItemsCarrito() {
  const db = useDB();
  const carrito = useCarrito();
  return useMemo(() => carrito.map((c) => {
    const p = db.productos.find((x) => x.id === c.productoId)!;
    return { c, p, item: { productoId: p.id, nombre: p.nombre, talla: c.talla, cantidad: c.cantidad, precioUnit: p.precio, costoUnit: p.costo } as ItemVenta };
  }).filter((x) => x.p), [db, carrito]);
}

export function Carrito() {
  const db = useDB();
  const { usuario } = useSesion();
  const items = useItemsCarrito();
  const subtotal = items.reduce((a, x) => a + x.item.precioUnit * x.item.cantidad, 0);
  const falta = db.config.envioGratisDesde - subtotal;
  if (!items.length) {
    return <Vacio icono="bag" titulo="Tu carro está vacío" texto="Agrega prendas desde el catálogo." accion={<Boton variante="primario" onClick={() => navegar('/tienda')}>Ir al catálogo</Boton>} />;
  }
  return (
    <div className="grid-sidebar">
      <Panel titulo="Tu carro">
        {items.map(({ c, p }, i) => (
          <div className="linea-carro" key={`${c.productoId}-${c.talla}`}>
            <Prenda linea={p.linea} color={p.colorHex} tamano="chico" etiqueta={p.nombre} />
            <div>
              <h3>{p.nombre}</h3>
              <p className="chico texto-3">{p.color} · talla {c.talla} · {clp(p.precio)} c/u</p>
              <div className="cantidad mt-chico">
                <button onClick={() => cambiarCantidadCarrito(i, c.cantidad - 1)} aria-label="Quitar una unidad"><Icono n="minus" size={16} /></button>
                <span>{c.cantidad}</span>
                <button onClick={() => (c.cantidad < stockTotal(p) ? cambiarCantidadCarrito(i, c.cantidad + 1) : toast(`Solo quedan ${stockTotal(p)} unidades`, 'peligro'))} aria-label="Agregar una unidad"><Icono n="plus" size={16} /></button>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong className="precio">{clp(p.precio * c.cantidad)}</strong>
              <div><button className="btn btn-fantasma btn-chico" onClick={() => cambiarCantidadCarrito(i, 0)}>Quitar</button></div>
            </div>
          </div>
        ))}
      </Panel>
      <Panel titulo="Resumen">
        <div className="resumen-filas">
          <div><span>Subtotal</span><strong>{clp(subtotal)}</strong></div>
          <div className="texto-2"><span>Despacho y descuentos</span><span>Se calculan al pagar</span></div>
        </div>
        {falta > 0 ? <Aviso tipo="info">Te faltan {clp(falta)} para tener despacho gratis.</Aviso> : <Aviso tipo="bien">Tu compra tiene despacho gratis.</Aviso>}
        <Boton variante="primario" className="ancho-total mt" onClick={() => navegar(usuario?.rol === 'cliente' ? '/tienda/checkout' : '/login?volver=/tienda/checkout')}>
          {usuario?.rol === 'cliente' ? 'Ir a pagar' : 'Inicia sesión para pagar'}
        </Boton>
      </Panel>
    </div>
  );
}

const TARJETA_RECHAZO = '4000 0000 0000 0002';

export function Checkout() {
  const db = useDB();
  const { usuario } = useSesion();
  const items = useItemsCarrito();
  const cliente = db.clientes.find((c) => c.id === usuario?.clienteId)!;
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '');
  const [comuna, setComuna] = useState(cliente?.comuna ?? '');
  const [medio, setMedio] = useState<MedioPago>('tarjeta');
  const [tarjeta, setTarjeta] = useState({ numero: '4111 1111 1111 1111', nombre: cliente?.nombre ?? '', venc: '12/28', cvv: '123' });
  const [nroOp, setNroOp] = useState('');
  const [rechazar, setRechazar] = useState(false);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const comunas = db.zonas.filter((z) => z.activa).flatMap((z) => z.comunas).sort((a, b) => a.localeCompare(b, 'es'));
  const lista = items.map((x) => x.item);
  const t = calcularTotales(db, cliente?.id, lista, undefined, comuna);
  const est = t.zona ? fechaEstimada(db, t.zona) : null;

  if (!items.length) return <Vacio icono="bag" titulo="No hay nada que pagar" texto="Tu carro está vacío." accion={<Boton variante="primario" onClick={() => navegar('/tienda')}>Ir al catálogo</Boton>} />;

  const pagar = () => {
    setError('');
    if (!direccion.trim()) return setError('Escribe la dirección de despacho.');
    if (medio === 'tarjeta') {
      const num = tarjeta.numero.replace(/\s/g, '');
      if (num.length < 15 || !tarjeta.nombre.trim() || !/^\d{2}\/\d{2}$/.test(tarjeta.venc) || tarjeta.cvv.length < 3) return setError('Revisa los datos de la tarjeta.');
    }
    setProcesando(true);
    setTimeout(() => {
      setProcesando(false);
      if (medio === 'tarjeta' && (rechazar || tarjeta.numero === TARJETA_RECHAZO)) {
        registrarPagoRechazado(cliente.id, t.total);
        setError('El banco rechazó el pago con tarjeta. Tu compra no se confirmó y no se hizo ningún cargo. Prueba con otra tarjeta o paga por transferencia.');
        return;
      }
      const r = intentar(() => crearVenta({
        clienteId: cliente.id, items: lista, canal: window.innerWidth < 760 ? 'movil' : 'web', origen: 'tienda_web', medio,
        nroOperacion: medio === 'transferencia' ? nroOp : undefined, tarjeta: medio === 'tarjeta' ? tarjeta.numero.replace(/\s/g, '').slice(-4) : undefined,
        direccion: { direccion, comuna },
      }));
      if (!r.ok) return setError(r.error);
      vaciarCarrito();
      navegar(`/tienda/pedido/${r.valor.pedidoId}?nueva=1`);
    }, 900);
  };

  return (
    <div className="grid-sidebar">
      <div className="pila">
        <Panel titulo="1. Despacho">
          <div className="form-grid">
            <Campo label="Dirección" ancho="completo"><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></Campo>
            <Campo label="Comuna">
              <Select value={comuna} onChange={(e) => setComuna(e.target.value)}>
                {comunas.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Campo>
            <Campo label="Zona de despacho">
              <Input value={t.zona ? `${t.zona.nombre} · ${clp(t.zona.tarifa)}` : 'Sin cobertura'} disabled />
            </Campo>
          </div>
          {est && <Aviso tipo="info"><strong>Llega entre el {fecha(est.desde)} y el {fecha(est.hasta)}.</strong> Calculado según tu zona{est.extra ? ' y la cantidad de pedidos que tenemos en preparación' : ''}.</Aviso>}
        </Panel>
        <Panel titulo="2. Pago">
          <div className="medios" role="radiogroup" aria-label="Medio de pago">
            <button className={`medio ${medio === 'tarjeta' ? 'activo' : ''}`} onClick={() => setMedio('tarjeta')} role="radio" aria-checked={medio === 'tarjeta'}><Icono n="cash" /> Tarjeta de débito o crédito</button>
            <button className={`medio ${medio === 'transferencia' ? 'activo' : ''}`} onClick={() => setMedio('transferencia')} role="radio" aria-checked={medio === 'transferencia'}><Icono n="bank" /> Transferencia bancaria</button>
          </div>
          <p className="chico texto-3 mt-chico">El pago en efectivo está disponible cuando compras con una de nuestras vendedoras.</p>
          {medio === 'tarjeta' ? (
            <div className="form-grid mt">
              <Campo label="Número de tarjeta" ancho="completo" ayuda={`Pago simulado. Para probar un rechazo usa ${TARJETA_RECHAZO} o activa la opción de abajo.`}>
                <Input value={tarjeta.numero} onChange={(e) => setTarjeta({ ...tarjeta, numero: e.target.value })} inputMode="numeric" />
              </Campo>
              <Campo label="Nombre en la tarjeta"><Input value={tarjeta.nombre} onChange={(e) => setTarjeta({ ...tarjeta, nombre: e.target.value })} /></Campo>
              <Campo label="Vencimiento (MM/AA)"><Input value={tarjeta.venc} onChange={(e) => setTarjeta({ ...tarjeta, venc: e.target.value })} /></Campo>
              <Campo label="CVV"><Input value={tarjeta.cvv} onChange={(e) => setTarjeta({ ...tarjeta, cvv: e.target.value })} type="password" maxLength={4} /></Campo>
              <div className="campo-completo"><Interruptor activo={rechazar} onChange={setRechazar} label="Simular pago rechazado por el banco" /></div>
            </div>
          ) : (
            <div className="mt">
              <Aviso tipo="info">Transfiere a <strong>Comercializadora Urbano SpA</strong>, RUT 77.214.530-6, Banco Estado, cuenta corriente 123-4-567890-1, correo pagos@tiendasurbano.cl. Luego escribe el número de operación.</Aviso>
              <div className="form-grid mt"><Campo label="Número de operación"><Input value={nroOp} onChange={(e) => setNroOp(e.target.value)} placeholder="ej. 48291034" /></Campo></div>
            </div>
          )}
        </Panel>
      </div>
      <Panel titulo="3. Confirmar compra">
        {items.map(({ c, p }) => (
          <div key={`${c.productoId}-${c.talla}`} className="flex-entre chico" style={{ padding: '6px 0' }}>
            <span>{c.cantidad} × {p.nombre} <span className="texto-3">({c.talla})</span></span>
            <span className="mono">{clp(p.precio * c.cantidad)}</span>
          </div>
        ))}
        <hr className="separador" />
        <div className="resumen-filas">
          <div><span>Subtotal</span><span className="mono">{clp(t.subtotal)}</span></div>
          {t.descCampana > 0 && (
            <div className="texto-bien"><span>{t.campana?.nombre} ({t.pctCampana}%)</span><span className="mono">−{clp(t.descCampana)}</span></div>
          )}
          <div><span>Despacho {t.envioGratis && <span className="texto-bien">gratis</span>}</span><span className="mono">{clp(t.envio)}</span></div>
          <div className="total"><span>Total</span><span>{clp(t.total)}</span></div>
        </div>
        <div className="flex mt-chico"><span className="chico texto-2">Tu categoría:</span><CategoriaTag c={t.categoria} /></div>
        {error && <div className="mt"><Aviso tipo="peligro">{error}</Aviso></div>}
        <Boton variante="primario" className="ancho-total mt" onClick={pagar} disabled={procesando || !t.zona}>{procesando ? 'Procesando pago…' : `Pagar ${clp(t.total)}`}</Boton>
        <p className="chico texto-3 mt-chico">Al confirmar se genera tu boleta electrónica y te avisamos por correo cada vez que tu pedido cambie de estado.</p>
      </Panel>
    </div>
  );
}
