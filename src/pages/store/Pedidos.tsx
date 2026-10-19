import { useState } from 'react';
import { Aviso, Boton, Campo, EstadoPedidoTag, Input, Pagina, Panel, Tabla, Vacio, Etiqueta } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { nombreEstado, NOMBRE_INCIDENCIA, useDB, useSesion } from '../../lib/store';
import { navegar, useRuta } from '../../lib/router';
import { clp, fecha, fechaHora, hora } from '../../lib/format';
import type { DB, Pedido } from '../../lib/types';
import { NoEncontrado, AccesoDenegado } from '../general/Varios';

export function ProgresoPedido({ p }: { p: Pedido }) {
  const pasos = ['pendiente', 'preparacion', 'en_ruta', 'entregado'] as const;
  const idx = p.estado === 'incidencia' ? 2 : pasos.indexOf(p.estado as (typeof pasos)[number]);
  const labels = ['Recibido', 'En preparación', 'En ruta', 'Entregado'];
  return (
    <>
      <div className="progreso-pedido" aria-hidden>
        {pasos.map((s, i) => <div key={s} className={i <= idx ? (p.estado === 'incidencia' && i === 2 ? 'mal' : 'ok') : ''} />)}
      </div>
      <div className="progreso-labels">
        {labels.map((l, i) => <span key={l} className={i <= idx ? 'ok' : ''}>{p.estado === 'incidencia' && i === 2 ? 'Con incidencia' : l}</span>)}
      </div>
    </>
  );
}

export function LineaTiempo({ p, db, interno }: { p: Pedido; db: DB; interno?: boolean }) {
  const eventos = [...p.historial].reverse();
  return (
    <ol className="linea-tiempo">
      {eventos.map((e, i) => (
        <li key={i} className={e.estado === 'incidencia' ? 'problema' : 'hecho'}>
          <span className="hito" />
          <strong>{nombreEstado(e.estado)}</strong>
          <small>{fechaHora(e.fecha)}{interno && e.usuarioId ? ` · ${e.usuarioId === 'sistema' ? 'Sistema' : db.usuarios.find((u) => u.id === e.usuarioId)?.nombre ?? ''}` : ''}</small>
          {e.nota && <p>{e.nota}</p>}
        </li>
      ))}
    </ol>
  );
}

export function MisCompras() {
  const db = useDB();
  const { usuario } = useSesion();
  const ventas = db.ventas.filter((v) => v.clienteId === usuario?.clienteId).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Mis compras" descripcion="Todas tus compras con su boleta y el estado del despacho.">
      {!ventas.length ? (
        <Vacio icono="bag" titulo="Aún no tienes compras" texto="Cuando compres, verás aquí tus boletas y pedidos." accion={<Boton variante="primario" onClick={() => navegar('/tienda')}>Ir al catálogo</Boton>} />
      ) : (
        <Panel className="panel-plano">
          <Tabla clave={(v) => v.id} filas={ventas} porPagina={10}
            columnas={[
              { titulo: 'Fecha', render: (v) => fecha(v.fecha) },
              { titulo: 'Prendas', render: (v) => <span>{v.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ')}</span> },
              { titulo: 'Total', render: (v) => <strong>{clp(v.total)}</strong>, alinear: 'der' },
              { titulo: 'Pedido', render: (v) => { const p = db.pedidos.find((x) => x.id === v.pedidoId); return p ? <EstadoPedidoTag e={p.estado} /> : v.estado === 'anulada' ? <Etiqueta tono="peligro">Anulada</Etiqueta> : '—'; } },
              { titulo: '', render: (v) => (
                <div className="fila-acciones">
                  {v.pedidoId && <Boton chico onClick={() => navegar('/tienda/pedido/' + v.pedidoId)}>Seguir</Boton>}
                  <Boton chico variante="fantasma" icono="receipt" onClick={() => navegar('/tienda/boleta/' + v.id)}>Boleta</Boton>
                </div>
              ) },
            ]} />
        </Panel>
      )}
    </Pagina>
  );
}

export function PedidoCliente({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const { usuario } = useSesion();
  const { query } = useRuta();
  const p = db.pedidos.find((x) => x.id === params.id);
  if (!p) return <NoEncontrado />;
  if (p.clienteId !== usuario?.clienteId) return <AccesoDenegado clienteSolo />;
  const v = db.ventas.find((x) => x.id === p.ventaId)!;
  const rep = db.usuarios.find((u) => u.id === p.repartidorId);
  const abiertas = p.incidencias.filter((i) => !i.resuelta);
  return (
    <Pagina titulo={`Pedido ${p.nro}`} volver="/tienda/compras" acciones={<Boton icono="receipt" onClick={() => navegar('/tienda/boleta/' + v.id)}>Ver boleta</Boton>}>
      {query.get('nueva') && (
        <Aviso tipo="bien"><strong>¡Listo! Tu compra quedó confirmada.</strong> Boleta electrónica N° {v.boleta} por {clp(v.total)}. Te avisaremos cuando tu pedido salga a reparto.</Aviso>
      )}
      <div className="grid-sidebar mt">
        <Panel titulo={<span className="flex">Estado <EstadoPedidoTag e={p.estado} /></span>}>
          <ProgresoPedido p={p} />
          {abiertas.length > 0 && (
            <div className="mt"><Aviso tipo="peligro"><strong>{NOMBRE_INCIDENCIA[abiertas[0].tipo]}.</strong> {abiertas[0].comentario} Nuestro equipo de atención te contactará.</Aviso></div>
          )}
          <p className="chico texto-3 mt">Esta página se actualiza sola cuando cambia el estado de tu pedido.</p>
          <hr className="separador" />
          <LineaTiempo p={p} db={db} />
        </Panel>
        <div className="pila">
          <Panel titulo="Entrega">
            {p.entrega ? (
              <p>Entregado el {fecha(p.entrega.fecha)} a las {hora(p.entrega.fecha)}. Recibió {p.entrega.receptor}.</p>
            ) : (
              <p>Llega entre el <strong>{fecha(p.estimadoDesde)}</strong> y el <strong>{fecha(p.estimadoHasta)}</strong>.</p>
            )}
            <p className="chico texto-2 mt-chico">{p.direccion}, {p.comuna}</p>
            {rep && <p className="chico texto-2 mt-chico">Repartidor: {rep.nombre.split(' ')[0]} ({rep.empresaReparto})</p>}
          </Panel>
          <Panel titulo="Tu compra">
            {v.items.map((i, k) => <div key={k} className="flex-entre chico" style={{ padding: '4px 0' }}><span>{i.cantidad} × {i.nombre} ({i.talla})</span><span className="mono">{clp(i.cantidad * i.precioUnit)}</span></div>)}
            <hr className="separador" />
            <div className="flex-entre"><strong>Total pagado</strong><strong>{clp(v.total)}</strong></div>
          </Panel>
        </div>
      </div>
    </Pagina>
  );
}

const KEY_INTENTOS = 'urbanplus-consulta';
function leerIntentos(): { n: number; hasta?: number } {
  try { return JSON.parse(localStorage.getItem(KEY_INTENTOS) || '{"n":0}'); } catch { return { n: 0 }; }
}
function guardarIntentos(v: { n: number; hasta?: number }) {
  try { localStorage.setItem(KEY_INTENTOS, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

/** RF12: consulta pública por número de orden, sin iniciar sesión y sin mostrar datos personales */
export function Seguimiento() {
  const db = useDB();
  const [nro, setNro] = useState('');
  const [buscado, setBuscado] = useState<string | null>(null);
  const [error, setError] = useState('');
  const p = buscado ? db.pedidos.find((x) => x.nro.toLowerCase() === buscado.toLowerCase()) : undefined;
  const ejemplo = db.pedidos.filter((x) => x.estado === 'en_ruta').slice(-1)[0]?.nro ?? db.pedidos[db.pedidos.length - 1]?.nro;

  const consultar = () => {
    setError('');
    const st = leerIntentos();
    if (st.hasta && st.hasta > Date.now()) {
      setError(`Hiciste demasiados intentos. Espera ${Math.ceil((st.hasta - Date.now()) / 60000)} minuto(s) antes de volver a consultar.`);
      return;
    }
    const n = nro.trim().toUpperCase();
    const existe = db.pedidos.some((x) => x.nro === n);
    if (!existe) {
      const intentos = (st.hasta && st.hasta <= Date.now() ? 0 : st.n) + 1;
      guardarIntentos(intentos >= 5 ? { n: 0, hasta: Date.now() + 2 * 60000 } : { n: intentos });
      setBuscado(null);
      setError(intentos >= 5 ? 'Hiciste 5 consultas con números que no existen. Por seguridad, la consulta queda bloqueada por 2 minutos.' : `No encontramos el pedido ${n}. Revisa el número en tu boleta (formato UP-123456). Intentos: ${intentos} de 5.`);
      return;
    }
    guardarIntentos({ n: 0 });
    setBuscado(n);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.03em' }}>Sigue tu pedido</h1>
      <p className="texto-2" style={{ margin: '8px 0 20px' }}>Escribe el número que aparece en tu boleta. No necesitas iniciar sesión.</p>
      <form className="flex" onSubmit={(e) => { e.preventDefault(); consultar(); }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Campo label="Número de pedido" ayuda={ejemplo ? `Para la demo puedes probar con ${ejemplo}` : undefined}>
            <Input value={nro} onChange={(e) => setNro(e.target.value)} placeholder="UP-104512" />
          </Campo>
        </div>
        <Boton variante="primario" type="submit" icono="search" style={{ marginTop: 4 }}>Consultar</Boton>
      </form>
      {error && <div className="mt"><Aviso tipo="peligro">{error}</Aviso></div>}
      {p && (
        <Panel className="mt" titulo={<span className="flex">Pedido {p.nro} <EstadoPedidoTag e={p.estado} /></span>}>
          <ProgresoPedido p={p} />
          <div className="defs mt" style={{ display: 'grid' }}>
            <div><dt className="campo-label">Destino</dt><dd>{p.comuna}</dd></div>
            <div><dt className="campo-label">{p.entrega ? 'Entregado' : 'Fecha estimada'}</dt><dd>{p.entrega ? fechaHora(p.entrega.fecha) : `${fecha(p.estimadoDesde)} al ${fecha(p.estimadoHasta)}`}</dd></div>
            <div><dt className="campo-label">Última actualización</dt><dd>{fechaHora(p.historial[p.historial.length - 1].fecha)}</dd></div>
          </div>
          {p.estado === 'incidencia' && <div className="mt"><Aviso tipo="alerta">Hubo un problema con la entrega. Nuestro equipo ya está contactando a la persona que compró.</Aviso></div>}
          <p className="chico texto-3 mt"><Icono n="lock" size={13} /> Por privacidad no mostramos nombre, dirección ni teléfono.</p>
        </Panel>
      )}
    </div>
  );
}
