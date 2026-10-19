import { useState } from 'react';
import { Aviso, Boton, Buscador, Campo, Definiciones, Etiqueta, Filtros, Input, Interruptor, Kpi, Modal, Pagina, Panel, Pestanas, RF, Select, Tabla, Textarea, resultado, toast } from '../../components/ui';
import { Prenda } from '../../components/Prenda';
import { avanzarReposicion, crearReposicionManual, guardarProducto, guardarProveedor, guardarUbicacion, intentar, registrarMovimiento, trasladarStock, useDB, useSesion } from '../../lib/store';
import { navegar } from '../../lib/router';
import { clp, fecha, fechaHora, haceTiempo, num } from '../../lib/format';
import { estadoStock, nombreUsuario, stockTotal } from '../../lib/logica';
import { descargarExcel, exportarPDF } from '../../lib/exportar';
import { LINEAS } from '../../lib/types';
import type { LineaProducto, Producto, Proveedor, Ubicacion } from '../../lib/types';
import { NoEncontrado } from '../general/Varios';

const ESTADO_STOCK = { sin_stock: ['Sin stock', 'peligro'], critico: ['Crítico', 'peligro'], bajo: ['Bajo el umbral', 'alerta'], ok: ['Normal', 'bien'] } as const;
export const EstadoStock = ({ p }: { p: Producto }) => { const [t, tono] = ESTADO_STOCK[estadoStock(p)]; return <Etiqueta tono={tono}>{t}</Etiqueta>; };
const TIPO_MOV = { ingreso: 'Ingreso', salida: 'Salida', venta: 'Venta', ajuste: 'Ajuste', devolucion: 'Devolución', traslado: 'Traslado' } as const;

function FormProducto({ p, onCerrar }: { p: Producto | null; onCerrar: () => void }) {
  const db = useDB();
  const [f, setF] = useState<Producto | null>(p);
  const [prev, setPrev] = useState<Producto | null>(null);
  if (p !== prev) { setPrev(p); setF(p); }
  if (!f) return null;
  const n = (k: keyof Producto) => (e: { target: { value: string } }) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <Modal titulo={f.id ? `Editar ${f.nombre}` : 'Nuevo producto'} abierto onCerrar={onCerrar}
      pie={<><Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (resultado(intentar(() => guardarProducto(f)), 'Producto guardado')) onCerrar(); }}>Guardar</Boton></>}>
      <div className="form-grid">
        <Campo label="Código"><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></Campo>
        <Campo label="Nombre"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <Campo label="Línea"><Select value={f.linea} onChange={(e) => setF({ ...f, linea: e.target.value as LineaProducto })}>{LINEAS.map((l) => <option key={l}>{l}</option>)}</Select></Campo>
        <Campo label="Color"><Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></Campo>
        <Campo label="Tono para la ilustración"><Input type="color" value={f.colorHex} onChange={(e) => setF({ ...f, colorHex: e.target.value })} style={{ padding: 4 }} /></Campo>
        <Campo label="Proveedor"><Select value={f.proveedorId} onChange={(e) => setF({ ...f, proveedorId: e.target.value })}>{db.proveedores.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</Select></Campo>
        <Campo label="Precio de venta"><Input type="number" value={f.precio} onChange={n('precio')} /></Campo>
        <Campo label="Costo unitario"><Input type="number" value={f.costo} onChange={n('costo')} /></Campo>
        <Campo label="Umbral mínimo" ayuda="Bajo este stock se genera una alerta (RF45, RF46)"><Input type="number" value={f.umbralMin} onChange={n('umbralMin')} /></Campo>
        <Campo label="Umbral crítico" ayuda="Al llegar aquí se crea la orden de reposición (RF53)"><Input type="number" value={f.umbralCritico} onChange={n('umbralCritico')} /></Campo>
        <div className="campo-completo"><Interruptor activo={f.activo} onChange={(v) => setF({ ...f, activo: v })} label="Visible en la tienda y en ventas" /></div>
      </div>
    </Modal>
  );
}

function FormMovimiento({ abierto, onCerrar, productoId }: { abierto: boolean; onCerrar: () => void; productoId?: string }) {
  const db = useDB();
  const [tipo, setTipo] = useState<'ingreso' | 'salida' | 'ajuste' | 'traslado'>('ingreso');
  const [pid, setPid] = useState(productoId ?? db.productos[0].id);
  const [ub, setUb] = useState('u1');
  const [dest, setDest] = useState('u2');
  const [cant, setCant] = useState('');
  const [motivo, setMotivo] = useState('');
  const [prev, setPrev] = useState(false);
  if (abierto !== prev) { setPrev(abierto); if (abierto) { setPid(productoId ?? db.productos[0].id); setCant(''); setMotivo(''); } }
  const p = db.productos.find((x) => x.id === pid);
  return (
    <Modal titulo="Registrar movimiento de inventario" abierto={abierto} onCerrar={onCerrar}
      pie={<><Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" onClick={() => {
        const r = tipo === 'traslado' ? intentar(() => trasladarStock(pid, ub, dest, Number(cant))) : intentar(() => registrarMovimiento({ productoId: pid, ubicacionId: ub, tipo, cantidad: Number(cant), motivo }));
        if (resultado(r, 'Movimiento registrado. El stock se actualizó.')) onCerrar();
      }}>Registrar</Boton></>}>
      <Pestanas valor={tipo} onChange={setTipo} opciones={[{ id: 'ingreso', label: 'Ingreso' }, { id: 'salida', label: 'Salida' }, { id: 'ajuste', label: 'Ajuste' }, { id: 'traslado', label: 'Traslado' }]} />
      <div className="form-grid">
        <Campo label="Producto" ancho="completo">
          <Select value={pid} onChange={(e) => setPid(e.target.value)}>{db.productos.map((x) => <option key={x.id} value={x.id}>{x.sku} · {x.nombre} ({x.color}) · stock {stockTotal(x)}</option>)}</Select>
        </Campo>
        <Campo label={tipo === 'traslado' ? 'Desde' : 'Ubicación'} ayuda={p ? `Hay ${p.stock[ub] ?? 0} unidades aquí` : undefined}>
          <Select value={ub} onChange={(e) => setUb(e.target.value)}>{db.ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select>
        </Campo>
        {tipo === 'traslado' && <Campo label="Hacia"><Select value={dest} onChange={(e) => setDest(e.target.value)}>{db.ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</Select></Campo>}
        <Campo label={tipo === 'ajuste' ? 'Cantidad (negativa para mermas)' : 'Cantidad'}><Input type="number" value={cant} onChange={(e) => setCant(e.target.value)} placeholder={tipo === 'ajuste' ? 'ej. -2' : 'ej. 24'} /></Campo>
        {tipo !== 'traslado' && (
          <Campo label={tipo === 'ajuste' ? 'Justificación' : 'Motivo o documento'} ancho="completo">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'ingreso' ? 'ej. Contenedor GZ-2310, factura 4581' : tipo === 'salida' ? 'ej. Muestra para sesión de fotos' : 'ej. Merma: prendas con falla de costura'} />
          </Campo>
        )}
      </div>
      <p className="chico texto-3 mt">Queda registrado con tu nombre, la fecha y la hora (RF44, RF49).</p>
    </Modal>
  );
}

export function Productos() {
  const db = useDB();
  const [q, setQ] = useState('');
  const [linea, setLinea] = useState('');
  const [est, setEst] = useState('');
  const [edit, setEdit] = useState<Producto | null>(null);
  const [mov, setMov] = useState(false);
  const filas = db.productos
    .filter((p) => !linea || p.linea === linea)
    .filter((p) => !est || estadoStock(p) === est)
    .filter((p) => !q || `${p.sku} ${p.nombre} ${p.color}`.toLowerCase().includes(q.toLowerCase()));
  const nuevo = (): Producto => ({ id: '', sku: '', nombre: '', linea: 'Poleras', color: '', colorHex: '#8a2d5f', tallas: ['XS', 'S', 'M', 'L', 'XL'], precio: 19990, costo: 8000, stock: Object.fromEntries(db.ubicaciones.map((u) => [u.id, 0])), umbralMin: 10, umbralCritico: 5, proveedorId: db.proveedores[0].id, activo: true });
  return (
    <Pagina titulo="Productos y stock" descripcion={<>Stock actualizado en tiempo real por ubicación, con umbral mínimo y crítico configurables por producto. <RF ids="RF44 · RF46 · RF52 · RNF31" /></>}
      acciones={<><Boton icono="swap" onClick={() => setMov(true)}>Registrar movimiento</Boton><Boton variante="primario" icono="plus" onClick={() => setEdit(nuevo())}>Nuevo producto</Boton></>}>
      <div className="kpis">
        <Kpi label="Productos" valor={num(db.productos.length)} />
        <Kpi label="Unidades en bodega" valor={num(db.productos.reduce((a, p) => a + stockTotal(p), 0))} />
        <Kpi label="Valor del inventario (costo)" valor={clp(db.productos.reduce((a, p) => a + stockTotal(p) * p.costo, 0))} />
        <Kpi label="Bajo el umbral" valor={num(db.productos.filter((p) => estadoStock(p) !== 'ok').length)} tono="alerta" />
      </div>
      <Panel className="panel-plano mt">
        <div style={{ padding: '16px 20px 0' }}>
          <Filtros>
            <Buscador valor={q} onChange={setQ} placeholder="Código, nombre o color" />
            <Select value={linea} onChange={(e) => setLinea(e.target.value)} aria-label="Línea" style={{ width: 180 }}><option value="">Todas las líneas</option>{LINEAS.map((l) => <option key={l}>{l}</option>)}</Select>
            <Select value={est} onChange={(e) => setEst(e.target.value)} aria-label="Estado de stock" style={{ width: 180 }}><option value="">Todos los estados</option><option value="ok">Normal</option><option value="bajo">Bajo el umbral</option><option value="critico">Crítico</option><option value="sin_stock">Sin stock</option></Select>
          </Filtros>
        </div>
        <Tabla clave={(p) => p.id} filas={filas} porPagina={20} onFila={(p) => navegar('/inventario/producto/' + p.id)}
          columnas={[
            { titulo: '', render: (p) => <div style={{ width: 38 }}><Prenda linea={p.linea} color={p.colorHex} tamano="chico" /></div>, ancho: '50px' },
            { titulo: 'Producto', render: (p) => <><strong>{p.nombre}</strong><span className="celda-sub">{p.sku} · {p.color}</span></>, ordenar: (p) => p.nombre },
            { titulo: 'Línea', render: (p) => p.linea, ordenar: (p) => p.linea },
            ...db.ubicaciones.map((u) => ({ titulo: u.nombre, render: (p: Producto) => num(p.stock[u.id] ?? 0), alinear: 'der' as const })),
            { titulo: 'Total', render: (p) => <strong>{num(stockTotal(p))}</strong>, alinear: 'der', ordenar: (p) => stockTotal(p) },
            { titulo: 'Umbral', render: (p) => <span className="texto-3">{p.umbralMin} / {p.umbralCritico}</span>, alinear: 'der' },
            { titulo: 'Estado', render: (p) => <EstadoStock p={p} /> },
            { titulo: '', render: (p) => <span onClick={(e) => e.stopPropagation()}><Boton chico variante="fantasma" icono="edit" onClick={() => setEdit({ ...p })}>Editar</Boton></span> },
          ]} />
      </Panel>
      <FormProducto p={edit} onCerrar={() => setEdit(null)} />
      <FormMovimiento abierto={mov} onCerrar={() => setMov(false)} />
    </Pagina>
  );
}

export function ProductoInventario({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const [mov, setMov] = useState(false);
  const [edit, setEdit] = useState<Producto | null>(null);
  const p = db.productos.find((x) => x.id === params.id);
  if (!p) return <NoEncontrado />;
  const movs = db.movimientos.filter((m) => m.productoId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const prov = db.proveedores.find((x) => x.id === p.proveedorId);
  return (
    <Pagina titulo={p.nombre} volver="/inventario" descripcion={`${p.sku} · ${p.linea} · ${p.color}`}
      acciones={<><Boton icono="edit" onClick={() => setEdit({ ...p })}>Editar y umbrales</Boton><Boton variante="primario" icono="swap" onClick={() => setMov(true)}>Registrar movimiento</Boton></>}>
      <div className="grid-sidebar">
        <Panel titulo={<>Historial de movimientos <RF ids="RF50" /></>} className="panel-plano">
          <Tabla clave={(m) => m.id} filas={movs} vacio="Sin movimientos registrados."
            columnas={[
              { titulo: 'Fecha', render: (m) => fechaHora(m.fecha) },
              { titulo: 'Tipo', render: (m) => <Etiqueta tono={m.cantidad > 0 ? 'bien' : m.tipo === 'venta' ? 'neutro' : 'alerta'}>{TIPO_MOV[m.tipo]}</Etiqueta> },
              { titulo: 'Ubicación', render: (m) => db.ubicaciones.find((u) => u.id === m.ubicacionId)?.nombre },
              { titulo: 'Cantidad', render: (m) => <strong className={m.cantidad > 0 ? 'texto-bien' : ''}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</strong>, alinear: 'der' },
              { titulo: 'Motivo', render: (m) => <span className="chico">{m.motivo}</span> },
              { titulo: 'Responsable', render: (m) => nombreUsuario(db, m.usuarioId) },
            ]} />
        </Panel>
        <div className="pila">
          <Panel>
            <Prenda linea={p.linea} color={p.colorHex} />
            <div className="flex-entre mt"><strong style={{ fontSize: 22, fontFamily: 'var(--f-display)' }}>{num(stockTotal(p))} unidades</strong><EstadoStock p={p} /></div>
            <ul className="lista-simple mt-chico">
              {db.ubicaciones.map((u) => <li key={u.id}><span>{u.nombre} <span className="texto-3 chico">{u.descripcion}</span></span><strong>{p.stock[u.id] ?? 0}</strong></li>)}
            </ul>
          </Panel>
          <Panel titulo="Datos">
            <Definiciones items={[['Precio', clp(p.precio)], ['Costo', clp(p.costo)], ['Margen unitario', clp(p.precio - p.costo)], ['Umbral mínimo', p.umbralMin], ['Umbral crítico', p.umbralCritico], ['Proveedor', prov?.nombre ?? '—'], ['Contacto', prov ? `${prov.contacto} · ${prov.email}` : '—']]} />
          </Panel>
        </div>
      </div>
      <FormMovimiento abierto={mov} onCerrar={() => setMov(false)} productoId={p.id} />
      <FormProducto p={edit} onCerrar={() => setEdit(null)} />
    </Pagina>
  );
}

export function Movimientos() {
  const db = useDB();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [mov, setMov] = useState(false);
  const filas = db.movimientos
    .filter((m) => !tipo || m.tipo === tipo)
    .filter((m) => { if (!q) return true; const p = db.productos.find((x) => x.id === m.productoId); return `${p?.sku} ${p?.nombre}`.toLowerCase().includes(q.toLowerCase()); })
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Movimientos de inventario" descripcion={<>Ingresos, salidas, ajustes (mermas y devoluciones) y traslados, siempre con responsable y justificación. Busca por código o nombre para ver el historial de un producto. <RF ids="RF44 · RF49 · RF50" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => setMov(true)}>Registrar movimiento</Boton>}>
      <Panel className="panel-plano">
        <div style={{ padding: '16px 20px 0' }}>
          <Filtros>
            <Buscador valor={q} onChange={setQ} placeholder="Código o nombre del producto" />
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de movimiento" style={{ width: 180 }}><option value="">Todos los tipos</option>{Object.entries(TIPO_MOV).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          </Filtros>
        </div>
        <Tabla clave={(m) => m.id} filas={filas} porPagina={20}
          columnas={[
            { titulo: 'Fecha', render: (m) => fechaHora(m.fecha), ordenar: (m) => m.fecha },
            { titulo: 'Producto', render: (m) => { const p = db.productos.find((x) => x.id === m.productoId); return <button className="enlace" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => navegar('/inventario/producto/' + m.productoId)}>{p?.nombre}<span className="celda-sub">{p?.sku} · {p?.color}</span></button>; } },
            { titulo: 'Tipo', render: (m) => <Etiqueta tono={m.cantidad > 0 ? 'bien' : m.tipo === 'venta' ? 'neutro' : 'alerta'}>{TIPO_MOV[m.tipo]}</Etiqueta> },
            { titulo: 'Ubicación', render: (m) => db.ubicaciones.find((u) => u.id === m.ubicacionId)?.nombre },
            { titulo: 'Cantidad', render: (m) => <strong>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</strong>, alinear: 'der' },
            { titulo: 'Motivo', render: (m) => <span className="chico">{m.motivo}</span> },
            { titulo: 'Responsable', render: (m) => nombreUsuario(db, m.usuarioId) },
          ]} />
      </Panel>
      <FormMovimiento abierto={mov} onCerrar={() => setMov(false)} />
    </Pagina>
  );
}

export function Alertas() {
  const db = useDB();
  const [tab, setTab] = useState<'activa' | 'resuelta'>('activa');
  const filas = db.alertas.filter((a) => a.estado === tab).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Alertas de stock" descripcion={<>Se generan solas cuando un producto baja de su umbral mínimo, una sola vez hasta que se repone. <RF ids="RF45 · RF53" /></>}>
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: 'activa', label: `Activas (${db.alertas.filter((a) => a.estado === 'activa').length})` }, { id: 'resuelta', label: 'Resueltas' }]} />
      <Panel className="panel-plano">
        <Tabla clave={(a) => a.id} filas={filas} vacio={tab === 'activa' ? 'No hay productos bajo el umbral.' : 'Sin alertas resueltas.'}
          columnas={[
            { titulo: 'Producto', render: (a) => { const p = db.productos.find((x) => x.id === a.productoId)!; return <button className="enlace" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => navegar('/inventario/producto/' + p.id)}>{p.nombre}<span className="celda-sub">{p.sku} · {p.color}</span></button>; } },
            { titulo: 'Desde', render: (a) => haceTiempo(a.fecha) },
            { titulo: 'Stock actual', render: (a) => { const p = db.productos.find((x) => x.id === a.productoId)!; return <strong>{stockTotal(p)}</strong>; }, alinear: 'der' },
            { titulo: 'Umbral', render: (a) => { const p = db.productos.find((x) => x.id === a.productoId)!; return `${p.umbralMin} (crítico ${p.umbralCritico})`; } },
            { titulo: 'Estado', render: (a) => { const p = db.productos.find((x) => x.id === a.productoId)!; return <EstadoStock p={p} />; } },
            { titulo: 'Reposición', render: (a) => { const o = db.reposiciones.find((x) => x.productoId === a.productoId && x.estado !== 'recibida'); return o ? <Etiqueta tono="info">OR {o.folio} · {o.estado}</Etiqueta> : tab === 'activa' ? <Boton chico onClick={() => resultado(intentar(() => crearReposicionManual(a.productoId, 24)), 'Orden de reposición creada')}>Pedir reposición</Boton> : '—'; } },
          ]} />
      </Panel>
    </Pagina>
  );
}

export function Reposicion() {
  const db = useDB();
  const [nueva, setNueva] = useState(false);
  const [pid, setPid] = useState(db.productos[0].id);
  const [cant, setCant] = useState('24');
  const filas = [...db.reposiciones].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <Pagina titulo="Órdenes de reposición" descripcion={<>Cuando un producto llega a su umbral crítico, el sistema crea la orden al proveedor. Bodega la envía y registra la recepción, que suma el stock. <RF ids="RF53 · RF48" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => setNueva(true)}>Orden manual</Boton>}>
      <Panel className="panel-plano">
        <Tabla clave={(o) => o.id} filas={filas}
          columnas={[
            { titulo: 'N°', render: (o) => <strong>OR {o.folio}</strong> },
            { titulo: 'Fecha', render: (o) => fecha(o.fecha) },
            { titulo: 'Producto', render: (o) => db.productos.find((p) => p.id === o.productoId)?.nombre },
            { titulo: 'Proveedor', render: (o) => { const p = db.proveedores.find((x) => x.id === o.proveedorId); return <>{p?.nombre}<span className="celda-sub">{p?.contacto} · {p?.email}</span></>; } },
            { titulo: 'Cantidad', render: (o) => num(o.cantidad), alinear: 'der' },
            { titulo: 'Origen', render: (o) => (o.automatica ? <Etiqueta tono="marca">Automática</Etiqueta> : <Etiqueta>Manual</Etiqueta>) },
            { titulo: 'Estado', render: (o) => <Etiqueta tono={o.estado === 'recibida' ? 'bien' : o.estado === 'enviada' ? 'info' : 'alerta'}>{o.estado === 'generada' ? 'Por enviar' : o.estado === 'enviada' ? 'Enviada al proveedor' : 'Recibida'}</Etiqueta> },
            { titulo: '', render: (o) => o.estado !== 'recibida' ? <Boton chico variante={o.estado === 'generada' ? 'primario' : 'exito'} onClick={() => { avanzarReposicion(o.id); toast(o.estado === 'generada' ? 'Orden enviada al proveedor' : 'Recepción registrada. El stock aumentó.'); }}>{o.estado === 'generada' ? 'Enviar' : 'Registrar recepción'}</Boton> : null },
          ]} />
      </Panel>
      <Modal titulo="Nueva orden de reposición" abierto={nueva} onCerrar={() => setNueva(false)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setNueva(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (resultado(intentar(() => crearReposicionManual(pid, Number(cant))), 'Orden creada')) setNueva(false); }}>Crear orden</Boton></>}>
        <div className="pila" style={{ gap: 12 }}>
          <Campo label="Producto"><Select value={pid} onChange={(e) => setPid(e.target.value)}>{db.productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.color}) · stock {stockTotal(p)}</option>)}</Select></Campo>
          <Campo label="Cantidad"><Input type="number" value={cant} onChange={(e) => setCant(e.target.value)} /></Campo>
        </div>
      </Modal>
    </Pagina>
  );
}

export function Proveedores() {
  const db = useDB();
  const [edit, setEdit] = useState<Proveedor | null>(null);
  return (
    <Pagina titulo="Proveedores" descripcion={<>Proveedores de cada producto con su información de contacto para la reposición. <RF ids="RF48" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => setEdit({ id: '', nombre: '', pais: 'China', ciudad: '', contacto: '', email: '', telefono: '' })}>Nuevo proveedor</Boton>}>
      <Panel className="panel-plano">
        <Tabla clave={(p) => p.id} filas={db.proveedores}
          columnas={[
            { titulo: 'Proveedor', render: (p) => <><strong>{p.nombre}</strong><span className="celda-sub">{p.ciudad}, {p.pais}</span></> },
            { titulo: 'Contacto', render: (p) => p.contacto },
            { titulo: 'Correo', render: (p) => <a href={`mailto:${p.email}`}>{p.email}</a> },
            { titulo: 'Teléfono', render: (p) => p.telefono },
            { titulo: 'Productos', render: (p) => num(db.productos.filter((x) => x.proveedorId === p.id).length), alinear: 'der' },
            { titulo: '', render: (p) => <Boton chico variante="fantasma" icono="edit" onClick={() => setEdit({ ...p })}>Editar</Boton> },
          ]} />
      </Panel>
      <Modal titulo={edit?.id ? 'Editar proveedor' : 'Nuevo proveedor'} abierto={!!edit} onCerrar={() => setEdit(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (edit && resultado(intentar(() => guardarProveedor(edit)), 'Proveedor guardado')) setEdit(null); }}>Guardar</Boton></>}>
        {edit && (
          <div className="form-grid">
            {(['nombre', 'pais', 'ciudad', 'contacto', 'email', 'telefono'] as const).map((k) => (
              <Campo key={k} label={{ nombre: 'Nombre', pais: 'País', ciudad: 'Ciudad', contacto: 'Persona de contacto', email: 'Correo', telefono: 'Teléfono' }[k]}>
                <Input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} />
              </Campo>
            ))}
          </div>
        )}
      </Modal>
    </Pagina>
  );
}

export function Ubicaciones() {
  const db = useDB();
  const [edit, setEdit] = useState<Ubicacion | null>(null);
  const [mov, setMov] = useState(false);
  return (
    <Pagina titulo="Ubicaciones de bodega" descripcion={<>Distintas ubicaciones dentro de la bodega, con los productos asociados a cada una. <RF ids="RF52" /></>}
      acciones={<><Boton icono="swap" onClick={() => setMov(true)}>Trasladar stock</Boton><Boton variante="primario" icono="plus" onClick={() => setEdit({ id: '', nombre: '', descripcion: '' })}>Nueva ubicación</Boton></>}>
      <div className="grid-3">
        {db.ubicaciones.map((u) => {
          const prods = db.productos.filter((p) => (p.stock[u.id] ?? 0) > 0).sort((a, b) => (b.stock[u.id] ?? 0) - (a.stock[u.id] ?? 0));
          return (
            <Panel key={u.id} titulo={u.nombre} acciones={<Boton chico variante="fantasma" icono="edit" onClick={() => setEdit({ ...u })}>Editar</Boton>}>
              <p className="chico texto-3">{u.descripcion}</p>
              <div className="flex-entre mt-chico"><span className="texto-2">{prods.length} productos</span><strong>{num(prods.reduce((a, p) => a + (p.stock[u.id] ?? 0), 0))} unidades</strong></div>
              <ul className="lista-simple mt-chico">
                {prods.slice(0, 8).map((p) => <li key={p.id}><span className="chico">{p.nombre} · {p.color}</span><strong className="chico">{p.stock[u.id]}</strong></li>)}
              </ul>
              {prods.length > 8 && <p className="chico texto-3">y {prods.length - 8} más</p>}
            </Panel>
          );
        })}
      </div>
      <Modal titulo={edit?.id ? 'Editar ubicación' : 'Nueva ubicación'} abierto={!!edit} onCerrar={() => setEdit(null)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setEdit(null)}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (edit && resultado(intentar(() => guardarUbicacion(edit)), 'Ubicación guardada')) setEdit(null); }}>Guardar</Boton></>}>
        {edit && (
          <div className="pila" style={{ gap: 12 }}>
            <Campo label="Nombre"><Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} placeholder="ej. Pasillo C" /></Campo>
            <Campo label="Descripción"><Input value={edit.descripcion} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></Campo>
          </div>
        )}
      </Modal>
      <FormMovimiento abierto={mov} onCerrar={() => setMov(false)} />
    </Pagina>
  );
}

export function ReporteInventario() {
  const db = useDB();
  const { usuario } = useSesion();
  const [linea, setLinea] = useState('');
  const [est, setEst] = useState('');
  const filas = db.productos.filter((p) => (!linea || p.linea === linea) && (!est || estadoStock(p) === est));
  const exportar = () => descargarExcel('reporte-inventario', [{
    nombre: 'Inventario', titulo: `Reporte de inventario al ${fecha(new Date().toISOString())}${linea ? ` · ${linea}` : ''}`,
    encabezados: ['Código', 'Producto', 'Línea', 'Color', ...db.ubicaciones.map((u) => u.nombre), 'Total', 'Umbral mínimo', 'Estado', 'Costo unitario', 'Valor a costo'],
    filas: filas.map((p) => [p.sku, p.nombre, p.linea, p.color, ...db.ubicaciones.map((u) => p.stock[u.id] ?? 0), stockTotal(p), p.umbralMin, ESTADO_STOCK[estadoStock(p)][0], p.costo, p.costo * stockTotal(p)]),
  }]);
  return (
    <Pagina titulo="Reporte de inventario" descripcion={<>Exportable en PDF y Excel, con filtros por línea y estado. <RF ids="RF47" /></>}
      acciones={<><Boton icono="download" onClick={exportar}>Excel</Boton><Boton icono="printer" onClick={() => exportarPDF('Reporte de inventario')}>PDF</Boton></>}>
      <Filtros>
        <Campo label="Línea"><Select value={linea} onChange={(e) => setLinea(e.target.value)}><option value="">Todas</option>{LINEAS.map((l) => <option key={l}>{l}</option>)}</Select></Campo>
        <Campo label="Estado"><Select value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos</option><option value="ok">Normal</option><option value="bajo">Bajo el umbral</option><option value="critico">Crítico</option><option value="sin_stock">Sin stock</option></Select></Campo>
      </Filtros>
      <Panel titulo={`Inventario al ${fecha(new Date().toISOString())} · generado por ${usuario?.nombre}`} className="panel-plano">
        <Tabla clave={(p) => p.id} filas={filas} porPagina={100}
          columnas={[
            { titulo: 'Código', render: (p) => <span className="mono">{p.sku}</span> },
            { titulo: 'Producto', render: (p) => `${p.nombre} · ${p.color}` },
            { titulo: 'Línea', render: (p) => p.linea },
            { titulo: 'Total', render: (p) => num(stockTotal(p)), alinear: 'der' },
            { titulo: 'Umbral', render: (p) => p.umbralMin, alinear: 'der' },
            { titulo: 'Estado', render: (p) => <EstadoStock p={p} /> },
            { titulo: 'Valor a costo', render: (p) => clp(p.costo * stockTotal(p)), alinear: 'der' },
          ]} />
        <div style={{ padding: '12px 20px' }} className="flex-entre"><strong>Total</strong><strong>{num(filas.reduce((a, p) => a + stockTotal(p), 0))} unidades · {clp(filas.reduce((a, p) => a + p.costo * stockTotal(p), 0))}</strong></div>
      </Panel>
      {filas.some((p) => estadoStock(p) !== 'ok') && <Aviso tipo="alerta">{filas.filter((p) => estadoStock(p) !== 'ok').length} productos están bajo su umbral.</Aviso>}
    </Pagina>
  );
}
