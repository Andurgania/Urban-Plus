import { Boton, Pagina } from '../../components/ui';
import { useDB, useSesion } from '../../lib/store';
import { clp, fechaHora } from '../../lib/format';
import { nombreUsuario } from '../../lib/logica';
import { exportarPDF } from '../../lib/exportar';
import { NoEncontrado, AccesoDenegado } from './Varios';
import { inicioDeRol } from '../../lib/permisos';

const MEDIO = { tarjeta: 'Tarjeta', transferencia: 'Transferencia', efectivo: 'Efectivo' };

export function Boleta({ ventaId }: { ventaId: string }) {
  const db = useDB();
  const v = db.ventas.find((x) => x.id === ventaId);
  if (!v) return <NoEncontrado />;
  const c = db.clientes.find((x) => x.id === v.clienteId)!;
  const camp = db.campanas.find((x) => x.id === v.campanaId);
  const promo = db.promociones.find((x) => x.id === v.promoId);
  const neto = Math.round(v.total / 1.19);
  const pedido = db.pedidos.find((p) => p.id === v.pedidoId);
  return (
    <div className="boleta">
      <div className="boleta-head">
        <div>
          <h2>Tiendas Urbano</h2>
          <p className="chico texto-2">Comercializadora Urbano SpA · RUT 77.214.530-6<br />Venta de vestuario femenino · Bodega central, Santiago</p>
        </div>
        <div className="boleta-sii">BOLETA ELECTRÓNICA<br />N° {v.boleta}<br /><span style={{ fontWeight: 500 }}>S.I.I. – Santiago</span></div>
      </div>
      <p className="chico"><strong>Fecha:</strong> {fechaHora(v.fecha)} · <strong>Folio venta:</strong> {v.folio}</p>
      <p className="chico"><strong>Cliente:</strong> {c.tipo === 'empresa' ? `${c.razonSocial} (${c.nombre})` : c.nombre} · RUT {c.rut}</p>
      <p className="chico" style={{ marginBottom: 12 }}><strong>Atendido por:</strong> {v.vendedorId ? nombreUsuario(db, v.vendedorId) : 'Tienda web'} · Canal {v.canal === 'web' ? 'web' : 'móvil'}</p>
      <table>
        <tbody>
          {v.items.map((i, k) => (
            <tr key={k}><td>{i.cantidad} × {i.nombre} (talla {i.talla})</td><td>{clp(i.precioUnit * i.cantidad)}</td></tr>
          ))}
          <tr><td>Subtotal</td><td>{clp(v.subtotal)}</td></tr>
          {v.descCampana > 0 && <tr><td>Descuento campaña {camp?.nombre}</td><td>−{clp(v.descCampana)}</td></tr>}
          {v.descPromo > 0 && <tr><td>Promoción {promo?.nombre} ({promo?.porcentaje}%)</td><td>−{clp(v.descPromo)}</td></tr>}
          <tr><td>Despacho {v.envio === 0 ? '(gratis)' : ''}</td><td>{clp(v.envio)}</td></tr>
          <tr><td><strong>Total</strong></td><td><strong>{clp(v.total)}</strong></td></tr>
          <tr><td className="texto-3">Neto / IVA (19%) incluido</td><td className="texto-3">{clp(neto)} / {clp(v.total - neto)}</td></tr>
          <tr><td>Pago: {MEDIO[v.pago.medio]}{v.pago.tarjeta ? ` terminada en ${v.pago.tarjeta}` : ''}{v.pago.nroOperacion ? ` · operación ${v.pago.nroOperacion}` : ''}</td><td>{v.pago.medio === 'efectivo' ? `Recibido ${clp(v.pago.montoRecibido ?? 0)} · vuelto ${clp(v.pago.vuelto ?? 0)}` : 'Aprobado'}</td></tr>
        </tbody>
      </table>
      {pedido && <p className="chico mt">Pedido de despacho <strong>{pedido.nro}</strong>. Puedes seguirlo en la tienda con este número.</p>}
      {v.estado === 'anulada' && <p className="texto-peligro mt">VENTA ANULADA · {v.anulacion?.motivo}</p>}
      <p className="texto-3 chico mt">Documento de ejemplo generado por el prototipo Urban Plus. No es un documento tributario válido.</p>
    </div>
  );
}

export function BoletaPagina({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const { usuario } = useSesion();
  const v = db.ventas.find((x) => x.id === params.id);
  if (usuario?.rol === 'cliente' && v && v.clienteId !== usuario.clienteId) return <AccesoDenegado clienteSolo />;
  return (
    <Pagina titulo={`Boleta N° ${v?.boleta ?? ''}`} volver={usuario?.rol === 'cliente' ? '/tienda/compras' : v ? `/ventas/detalle/${v.id}` : inicioDeRol(usuario?.rol ?? 'cliente')}
      acciones={<Boton icono="download" onClick={() => exportarPDF(`Boleta ${v?.boleta}`)}>Descargar PDF</Boton>}>
      <Boleta ventaId={params.id} />
    </Pagina>
  );
}
