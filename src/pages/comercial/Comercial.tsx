import { useMemo, useState } from 'react';
import { Aviso, Boton, Campo, CategoriaTag, Definiciones, Etiqueta, Filtros, Input, Kpi, Modal, Pagina, Panel, Pestanas, RF, Select, Tabla, resultado, toast } from '../../components/ui';
import { Apiladas, Barras, COLORES_TIER, Ranking } from '../../components/Graficos';
import { aprobarCampana, guardarCampana, guardarConfig, intentar, useDB, useSesion } from '../../lib/store';
import { navegar } from '../../lib/router';
import { addDays, claveMes, clp, dia, fecha, nombreMesCorto, num, pct, diasEntre } from '../../lib/format';
import { categoriaAlCierre, clientesInactivos, estadoCampana, mapaCategorias, nombreCliente, nombreUsuario, ventasEnRango, ventasPorProducto, ventasValidas } from '../../lib/logica';
import { descargarExcel } from '../../lib/exportar';
import { CATEGORIAS, LINEAS } from '../../lib/types';
import type { Campana, Categoria, LineaProducto } from '../../lib/types';
import { NoEncontrado } from '../general/Varios';

const TONO_CAMP = { pendiente: 'alerta', rechazada: 'peligro', programada: 'info', activa: 'bien', finalizada: 'neutro' } as const;
const NOMBRE_EST = { pendiente: 'Pendiente de aprobación', rechazada: 'Rechazada', programada: 'Programada', activa: 'Activa', finalizada: 'Finalizada' };

export function exportarSegmentacion(db: ReturnType<typeof useDB>) {
  const mapa = mapaCategorias(db);
  descargarExcel('segmentacion-y-campanas', [
    { nombre: 'Segmentación', titulo: `Segmentación de clientes al ${fecha(new Date().toISOString())}`, encabezados: ['Cliente', 'Tipo', 'RUT', 'Categoría', 'Compras 12 meses', 'Monto 12 meses', 'Última compra'], filas: db.clientes.map((c) => [nombreCliente(db, c.id), c.tipo === 'empresa' ? 'Empresa' : 'Persona', c.rut, mapa[c.id].categoria, mapa[c.id].compras, mapa[c.id].monto, fecha(mapa[c.id].ultima)]) },
    { nombre: 'Campañas', encabezados: ['Campaña', 'Tipo', 'Desde', 'Hasta', 'Estado', 'Bronce %', 'Plata %', 'Diamante %', 'Premium %', 'Ventas en período', 'Descuento otorgado'], filas: db.campanas.map((c) => { const vs = ventasValidas(db).filter((v) => v.campanaId === c.id); return [c.nombre, c.tipo === 'reactivacion' ? 'Reactivación' : 'Por categoría', fecha(c.desde), fecha(c.hasta), NOMBRE_EST[estadoCampana(c)], c.descuentos.Bronce, c.descuentos.Plata, c.descuentos.Diamante, c.descuentos.Premium, vs.length, vs.reduce((a, v) => a + v.descCampana, 0)]; }) },
  ]);
}

export function Segmentacion() {
  const db = useDB();
  const { usuario } = useSesion();
  const mapa = useMemo(() => mapaCategorias(db), [db]);
  const [cat, setCat] = useState<Categoria | ''>('');
  const [umbrales, setUmbrales] = useState(db.config.categorias);
  const [editar, setEditar] = useState(false);
  const por = CATEGORIAS.map((c) => ({ c, n: db.clientes.filter((x) => mapa[x.id].categoria === c).length, monto: db.clientes.filter((x) => mapa[x.id].categoria === c).reduce((a, x) => a + mapa[x.id].monto, 0) }));
  const filas = db.clientes.filter((c) => !cat || mapa[c.id].categoria === cat).sort((a, b) => mapa[b.id].monto - mapa[a.id].monto);
  return (
    <Pagina titulo="Segmentación de clientes" descripcion={<>Los clientes se clasifican solos según su frecuencia de compra y monto acumulado en los últimos 12 meses. <RF ids="RF25 · RF33" /></>}
      acciones={<>
        <Boton icono="download" onClick={() => exportarSegmentacion(db)}>Exportar Excel</Boton>
        {usuario?.rol === 'gerente' && <Boton icono="edit" onClick={() => { setUmbrales(db.config.categorias); setEditar(true); }}>Cambiar reglas</Boton>}
      </>}>
      <div className="kpis">
        {por.map((x) => (
          <button key={x.c} className="kpi" style={{ textAlign: 'left', cursor: 'pointer', outline: cat === x.c ? '2px solid var(--marca)' : undefined }} onClick={() => setCat(cat === x.c ? '' : x.c)}>
            <span className="kpi-label"><CategoriaTag c={x.c} /></span>
            <strong className="kpi-valor">{num(x.n)} clientes</strong>
            <span className="kpi-detalle">{x.c === 'Bronce' ? 'Menos de ' + clp(db.config.categorias.Plata.monto) : `Desde ${clp(db.config.categorias[x.c].monto)} y ${db.config.categorias[x.c].compras} compras`} · {clp(x.monto)} en total</span>
          </button>
        ))}
      </div>
      <Panel className="panel-plano mt" titulo={cat ? `Clientes ${cat}` : 'Todos los clientes'} acciones={cat && <Boton chico variante="fantasma" onClick={() => setCat('')}>Ver todos</Boton>}>
        <Tabla clave={(c) => c.id} filas={filas} onFila={(c) => navegar('/clientes/' + c.id)}
          columnas={[
            { titulo: 'Cliente', render: (c) => <><strong>{nombreCliente(db, c.id)}</strong><span className="celda-sub">{c.tipo === 'empresa' ? 'Empresa' : 'Persona'} · {c.comuna}</span></> },
            { titulo: 'Categoría', render: (c) => <CategoriaTag c={mapa[c.id].categoria} /> },
            { titulo: 'Compras', render: (c) => num(mapa[c.id].compras), alinear: 'der', ordenar: (c) => mapa[c.id].compras },
            { titulo: 'Monto acumulado', render: (c) => clp(mapa[c.id].monto), alinear: 'der', ordenar: (c) => mapa[c.id].monto },
            { titulo: 'Última compra', render: (c) => fecha(mapa[c.id].ultima), ordenar: (c) => mapa[c.id].ultima ?? '' },
          ]} />
      </Panel>
      <Modal titulo="Reglas de categorías" abierto={editar} onCerrar={() => setEditar(false)}
        pie={<><Boton variante="fantasma" onClick={() => setEditar(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => { guardarConfig({ categorias: umbrales }, 'Cambió las reglas de segmentación de clientes'); toast('Reglas actualizadas. Los clientes se reclasificaron.'); setEditar(false); }}>Guardar reglas</Boton></>}>
        <p className="texto-modal" style={{ marginBottom: 12 }}>Un cliente sube de categoría cuando cumple ambos mínimos en los últimos 12 meses.</p>
        {(['Plata', 'Diamante', 'Premium'] as Categoria[]).map((c) => (
          <div key={c} className="form-grid" style={{ marginBottom: 10 }}>
            <Campo label={`${c}: monto mínimo`}><Input type="number" value={umbrales[c].monto} onChange={(e) => setUmbrales({ ...umbrales, [c]: { ...umbrales[c], monto: Number(e.target.value) } })} /></Campo>
            <Campo label={`${c}: compras mínimas`}><Input type="number" value={umbrales[c].compras} onChange={(e) => setUmbrales({ ...umbrales, [c]: { ...umbrales[c], compras: Number(e.target.value) } })} /></Campo>
          </div>
        ))}
      </Modal>
    </Pagina>
  );
}

type FormCamp = Omit<Campana, 'id' | 'creadaPor' | 'estadoAprobacion' | 'aprobadaPor'> & { id?: string };

export function FormCampana({ inicial, onCerrar }: { inicial: FormCamp | null; onCerrar: () => void }) {
  const [c, setC] = useState<FormCamp | null>(inicial);
  const [prev, setPrev] = useState<FormCamp | null>(null);
  if (inicial !== prev) { setPrev(inicial); setC(inicial); }
  if (!c) return null;
  return (
    <Modal titulo={c.id ? 'Editar campaña' : c.tipo === 'reactivacion' ? 'Campaña de reactivación' : 'Nueva campaña'} abierto onCerrar={onCerrar}
      pie={<><Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" onClick={() => { if (resultado(intentar(() => guardarCampana(c)), 'Campaña enviada a gerencia para su aprobación')) onCerrar(); }}>Enviar a aprobación</Boton></>}>
      <div className="form-grid">
        <Campo label="Nombre" ancho="completo"><Input value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} placeholder="ej. Liquidación de temporada" /></Campo>
        <Campo label="Desde"><Input type="date" value={dia(c.desde)} onChange={(e) => setC({ ...c, desde: new Date(e.target.value + 'T00:00').toISOString() })} /></Campo>
        <Campo label="Hasta"><Input type="date" value={dia(c.hasta)} onChange={(e) => setC({ ...c, hasta: new Date(e.target.value + 'T23:59:59').toISOString() })} /></Campo>
      </div>
      <h3 style={{ fontSize: 15, margin: '18px 0 8px', fontFamily: 'var(--f-ui)' }}>Descuento sobre el total de la compra</h3>
      <div className="form-grid">
        {CATEGORIAS.map((k) => (
          <Campo key={k} label={k}><Input type="number" min={0} max={50} value={c.descuentos[k]} onChange={(e) => setC({ ...c, descuentos: { ...c.descuentos, [k]: Number(e.target.value) } })} /></Campo>
        ))}
      </div>
      {c.tipo === 'reactivacion' && <Aviso tipo="info">Se aplica solo a los {c.clientesObjetivo?.length} clientes inactivos seleccionados.</Aviso>}
      <p className="chico texto-3 mt">La campaña se activa y termina sola en las fechas indicadas (RF27), pero antes debe aprobarla el Gerente General.</p>
    </Modal>
  );
}

export function Campanas() {
  const db = useDB();
  const { usuario } = useSesion();
  const esGerente = usuario?.rol === 'gerente';
  const [form, setForm] = useState<FormCamp | null>(null);
  const filas = [...db.campanas].sort((a, b) => b.desde.localeCompare(a.desde));
  const nueva = (): FormCamp => ({ nombre: '', tipo: 'categoria', desde: addDays(new Date(), 1).toISOString(), hasta: addDays(new Date(), 8).toISOString(), descuentos: { Bronce: 5, Plata: 8, Diamante: 12, Premium: 15 } });
  return (
    <Pagina titulo="Campañas" descripcion={<>Descuentos diferenciados por categoría de cliente. Se ejecutan solas durante su vigencia y al terminar generan su reporte de efectividad. <RF ids="RF26 · RF27 · RF28" /></>}
      acciones={<>
        <Boton icono="download" onClick={() => exportarSegmentacion(db)}>Exportar historial</Boton>
        {!esGerente && <Boton variante="primario" icono="plus" onClick={() => setForm(nueva())}>Nueva campaña</Boton>}
      </>}>
      {esGerente && db.campanas.some((c) => c.estadoAprobacion === 'pendiente') && <Aviso tipo="alerta">Hay campañas esperando tu aprobación. Ninguna campaña se activa sin tu visto bueno.</Aviso>}
      <Panel className="panel-plano mt">
        <Tabla clave={(c) => c.id} filas={filas} onFila={(c) => navegar('/comercial/campanas/' + c.id)}
          columnas={[
            { titulo: 'Campaña', render: (c) => <><strong>{c.nombre}</strong><span className="celda-sub">{c.tipo === 'reactivacion' ? `Reactivación · ${c.clientesObjetivo?.length} clientes` : 'Por categoría'}</span></> },
            { titulo: 'Vigencia', render: (c) => `${fecha(c.desde)} al ${fecha(c.hasta)}` },
            { titulo: 'Descuentos', render: (c) => <span className="chico">{CATEGORIAS.map((k) => `${k} ${c.descuentos[k]}%`).join(' · ')}</span> },
            { titulo: 'Estado', render: (c) => { const e = estadoCampana(c); return <Etiqueta tono={TONO_CAMP[e]}>{NOMBRE_EST[e]}</Etiqueta>; } },
            { titulo: 'Ventas', render: (c) => num(db.ventas.filter((v) => v.campanaId === c.id && v.estado === 'confirmada').length), alinear: 'der' },
            { titulo: '', render: (c) => (
              <div className="fila-acciones" onClick={(e) => e.stopPropagation()}>
                {esGerente && c.estadoAprobacion === 'pendiente' && <>
                  <Boton chico variante="exito" onClick={() => resultado(intentar(() => aprobarCampana(c.id, true)), 'Campaña aprobada')}>Aprobar</Boton>
                  <Boton chico variante="fantasma" onClick={() => resultado(intentar(() => aprobarCampana(c.id, false)), 'Campaña rechazada')}>Rechazar</Boton>
                </>}
                {!esGerente && ['pendiente', 'programada', 'rechazada'].includes(estadoCampana(c)) && <Boton chico variante="fantasma" icono="edit" onClick={() => setForm({ ...c })}>Editar</Boton>}
              </div>
            ) },
          ]} />
      </Panel>
      <FormCampana inicial={form} onCerrar={() => setForm(null)} />
    </Pagina>
  );
}

export function CampanaDetalle({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const c = db.campanas.find((x) => x.id === params.id);
  if (!c) return <NoEncontrado />;
  const est = estadoCampana(c);
  const vsPeriodo = ventasEnRango(db, c.desde, c.hasta);
  const conDesc = vsPeriodo.filter((v) => v.campanaId === c.id);
  const dur = Math.max(1, diasEntre(c.desde, c.hasta) + 1);
  const antes = ventasEnRango(db, addDays(c.desde, -dur).toISOString(), c.desde);
  const montoP = vsPeriodo.reduce((a, v) => a + v.total, 0);
  const montoA = antes.reduce((a, v) => a + v.total, 0);
  const descuento = conDesc.reduce((a, v) => a + v.descCampana, 0);
  const mapa = mapaCategorias(db);
  const porCat = CATEGORIAS.map((k) => ({ label: k, valor: conDesc.filter((v) => mapa[v.clienteId]?.categoria === k).length, detalle: clp(conDesc.filter((v) => mapa[v.clienteId]?.categoria === k).reduce((a, v) => a + v.descCampana, 0)) + ' en descuentos' }));
  const clientes = new Set(conDesc.map((v) => v.clienteId)).size;
  const variacion = montoA ? ((montoP - montoA) / montoA) * 100 : 0;
  return (
    <Pagina titulo={c.nombre} volver="/comercial/campanas" descripcion={<>{fecha(c.desde)} al {fecha(c.hasta)} · <Etiqueta tono={TONO_CAMP[est]}>{NOMBRE_EST[est]}</Etiqueta> <RF ids="RF28" /></>}>
      {est === 'finalizada' ? <Aviso tipo="info">Reporte de efectividad generado automáticamente al terminar la campaña.</Aviso> : est === 'activa' ? <Aviso tipo="bien">La campaña está activa: el descuento se aplica solo en la tienda web y en las ventas de los vendedores.</Aviso> : null}
      <div className="kpis mt">
        <Kpi label="Ventas con descuento" valor={num(conDesc.length)} detalle={`${clientes} clientes distintos`} />
        <Kpi label="Ventas totales en el período" valor={clp(montoP)} detalle={montoA ? `${variacion >= 0 ? '+' : ''}${pct(variacion)} vs. los ${dur} días anteriores` : undefined} tono={variacion >= 0 ? 'bien' : 'alerta'} />
        <Kpi label="Descuento otorgado" valor={clp(descuento)} detalle={montoP ? `${pct((descuento / montoP) * 100, 1)} de lo vendido` : undefined} />
        <Kpi label="Retorno por peso de descuento" valor={descuento ? `${((montoP - montoA) / descuento).toFixed(1).replace('.', ',')}` : '—'} detalle="Venta adicional ÷ descuento" />
      </div>
      <div className="grid-2 mt">
        <Panel titulo="Ventas con descuento por categoría">
          <Barras etiqueta="Ventas con descuento por categoría" datos={porCat} formato={(n) => String(Math.round(n))} alto={200} />
        </Panel>
        <Panel titulo="Condiciones">
          <Definiciones items={[
            ['Tipo', c.tipo === 'reactivacion' ? 'Reactivación de clientes inactivos' : 'Por categoría de cliente'],
            ...CATEGORIAS.map((k) => [`Descuento ${k}`, `${c.descuentos[k]}%`] as [string, string]),
            ['Creada por', nombreUsuario(db, c.creadaPor)], ['Aprobada por', c.aprobadaPor ? nombreUsuario(db, c.aprobadaPor) : '—'],
          ]} />
        </Panel>
      </div>
    </Pagina>
  );
}

export function Inactivos() {
  const db = useDB();
  const { usuario } = useSesion();
  const lista = clientesInactivos(db).sort((a, b) => b.resumen.monto - a.resumen.monto);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormCamp | null>(null);
  const toggle = (id: string) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s); };
  return (
    <Pagina titulo="Clientes inactivos" descripcion={<>Clientes sin compras en los últimos {db.config.diasClienteInactivo} días. Selecciónalos para ofrecerles una campaña de reactivación. <RF ids="RF30" /></>}
      acciones={usuario?.rol === 'area' && <Boton variante="primario" icono="megaphone" disabled={!sel.size} onClick={() => setForm({ nombre: 'Te extrañamos', tipo: 'reactivacion', desde: addDays(new Date(), 1).toISOString(), hasta: addDays(new Date(), 15).toISOString(), descuentos: { Bronce: 15, Plata: 15, Diamante: 18, Premium: 20 }, clientesObjetivo: [...sel] })}>Crear campaña de reactivación ({sel.size})</Boton>}>
      <Panel className="panel-plano">
        <Tabla clave={(x) => x.cliente.id} filas={lista} vacio="No hay clientes inactivos."
          columnas={[
            { titulo: '', render: (x) => <input type="checkbox" checked={sel.has(x.cliente.id)} onChange={() => toggle(x.cliente.id)} aria-label={`Seleccionar ${x.cliente.nombre}`} />, ancho: '40px' },
            { titulo: 'Cliente', render: (x) => <><strong>{x.cliente.nombre}</strong><span className="celda-sub">{x.cliente.email}</span></> },
            { titulo: 'Categoría', render: (x) => <CategoriaTag c={x.resumen.categoria} /> },
            { titulo: 'Última compra', render: (x) => fecha(x.resumen.ultima) },
            { titulo: 'Días sin comprar', render: (x) => <span className="texto-alerta">{x.dias}</span>, alinear: 'der', ordenar: (x) => x.dias },
            { titulo: 'Monto 12 meses', render: (x) => clp(x.resumen.monto), alinear: 'der' },
            { titulo: 'Campaña', render: (x) => { const c = db.campanas.find((k) => k.tipo === 'reactivacion' && k.clientesObjetivo?.includes(x.cliente.id) && ['activa', 'programada', 'pendiente'].includes(estadoCampana(k))); return c ? <Etiqueta tono="info">{c.nombre}</Etiqueta> : '—'; } },
          ]} />
      </Panel>
      <FormCampana inicial={form} onCerrar={() => { setForm(null); setSel(new Set()); }} />
    </Pagina>
  );
}

export function MasVendidos() {
  const db = useDB();
  const [tab, setTab] = useState<'periodo' | 'ranking'>('periodo');
  const [desde, setDesde] = useState(dia(addDays(new Date(), -30)));
  const [hasta, setHasta] = useState(dia());
  const [linea, setLinea] = useState<LineaProducto | ''>('');
  const meses = Array.from({ length: 6 }, (_, i) => claveMes(dia(new Date(new Date().getFullYear(), new Date().getMonth() - i, 1))));
  const [mes, setMes] = useState(meses[0]);
  const vs = ventasEnRango(db, new Date(desde + 'T00:00').toISOString(), new Date(hasta + 'T23:59:59').toISOString());
  const por = ventasPorProducto(vs);
  const filas = Object.entries(por).map(([id, x]) => ({ p: db.productos.find((y) => y.id === id)!, ...x })).filter((f) => f.p && (!linea || f.p.linea === linea)).sort((a, b) => b.unidades - a.unidades);
  const porLinea = LINEAS.map((l) => ({ label: l === 'Trajes de baño' ? 'Trajes baño' : l, valor: filas.filter((f) => f.p.linea === l).reduce((a, f) => a + f.unidades, 0) }));
  const vsMes = ventasValidas(db).filter((v) => claveMes(v.fecha) === mes);
  const porMes = ventasPorProducto(vsMes);
  return (
    <Pagina titulo="Productos más vendidos" descripcion={<>Qué se vende más por período y línea, y el ranking mensual de los 10 más vendidos por categoría. <RF ids="RF29 · RF31" /></>}>
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: 'periodo', label: 'Por período' }, { id: 'ranking', label: 'Ranking mensual por línea' }]} />
      {tab === 'periodo' ? (
        <>
          <Filtros>
            <Campo label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
            <Campo label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            <Campo label="Línea"><Select value={linea} onChange={(e) => setLinea(e.target.value as LineaProducto | '')}><option value="">Todas</option>{LINEAS.map((l) => <option key={l}>{l}</option>)}</Select></Campo>
          </Filtros>
          <div className="grid-2">
            <Panel titulo="Top 10 del período">
              <Ranking filas={filas.slice(0, 10).map((f) => ({ key: f.p.id, label: `${f.p.nombre} · ${f.p.color}`, valor: f.unidades, extra: `${clp(f.monto)} · ${f.p.linea}` }))} formato={(n) => `${n} u.`} />
            </Panel>
            <Panel titulo="Unidades por línea">
              <Barras etiqueta="Unidades vendidas por línea de producto" datos={porLinea} formato={(n) => String(Math.round(n))} alto={260} />
            </Panel>
          </div>
        </>
      ) : (
        <>
          <Filtros>
            <Campo label="Mes"><Select value={mes} onChange={(e) => setMes(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{nombreMesCorto(m)}</option>)}</Select></Campo>
            <Boton icono="download" onClick={() => descargarExcel(`ranking-${mes}`, LINEAS.map((l) => ({ nombre: l, titulo: `Top 10 ${l} · ${mes}`, encabezados: ['#', 'Producto', 'Color', 'Unidades', 'Monto'], filas: Object.entries(porMes).map(([id, x]) => ({ p: db.productos.find((y) => y.id === id)!, ...x })).filter((f) => f.p.linea === l).sort((a, b) => b.unidades - a.unidades).slice(0, 10).map((f, i) => [i + 1, f.p.nombre, f.p.color, f.unidades, f.monto]) })))}>Exportar</Boton>
          </Filtros>
          <div className="grid-3">
            {LINEAS.map((l) => {
              const top = Object.entries(porMes).map(([id, x]) => ({ p: db.productos.find((y) => y.id === id)!, ...x })).filter((f) => f.p?.linea === l).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
              return (
                <Panel key={l} titulo={l}>
                  {top.length ? <Ranking filas={top.map((f) => ({ key: f.p.id, label: `${f.p.nombre} · ${f.p.color}`, valor: f.unidades }))} formato={(n) => `${n} u.`} /> : <p className="texto-3 chico">Sin ventas este mes.</p>}
                </Panel>
              );
            })}
          </div>
        </>
      )}
    </Pagina>
  );
}

export function PanelClientes() {
  const db = useDB();
  const mapa = useMemo(() => mapaCategorias(db), [db]);
  const meses = Array.from({ length: 6 }, (_, i) => 5 - i).map((i) => new Date(new Date().getFullYear(), new Date().getMonth() - i + 1, 0, 23, 59));
  meses[meses.length - 1] = new Date();
  const evol = useMemo(() => CATEGORIAS.map((k) => ({
    nombre: k, color: COLORES_TIER[k],
    valores: meses.map((m) => db.clientes.filter((c) => categoriaAlCierre(db, c.id, m) === k).length),
  })), [db]);
  const etiquetas = meses.map((m, i) => (i === meses.length - 1 ? 'Hoy' : nombreMesCorto(claveMes(dia(m)))));
  const actuales = CATEGORIAS.map((k) => ({ k, n: db.clientes.filter((c) => mapa[c.id].categoria === k).length }));
  const total = db.clientes.length;
  const altos = (i: number) => evol.filter((s) => s.nombre === 'Diamante' || s.nombre === 'Premium').reduce((a, s) => a + s.valores[i], 0);
  return (
    <Pagina titulo="Panel de clientes" descripcion={<>Distribución de clientes por categoría y cómo ha cambiado mes a mes. <RF ids="RF32" /></>}>
      <div className="kpis">
        {actuales.map((x) => <Kpi key={x.k} label={x.k} valor={num(x.n)} detalle={`${pct((x.n / total) * 100)} de los clientes`} />)}
        <Kpi label="Diamante + Premium vs. hace 5 meses" valor={`${altos(5) - altos(0) >= 0 ? '+' : ''}${altos(5) - altos(0)}`} tono={altos(5) >= altos(0) ? 'bien' : 'alerta'} />
      </div>
      <Panel titulo="Evolución mensual por categoría">
        <Apiladas etiqueta="Cantidad de clientes por categoría al cierre de cada mes" etiquetas={etiquetas} series={evol} formato={(n) => `${n} clientes`} />
      </Panel>
      <Panel titulo="Composición (porcentaje del total)">
        <Apiladas etiqueta="Porcentaje de clientes por categoría al cierre de cada mes" etiquetas={etiquetas} series={evol} porcentaje formato={(n) => `${n} clientes`} alto={200} />
      </Panel>
    </Pagina>
  );
}
