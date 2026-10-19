import { useMemo, useState } from 'react';
import { Aviso, Boton, Buscador, Campo, Etiqueta, Filtros, Input, Kpi, Modal, Pagina, Panel, Pestanas, RF, Select, Tabla, Textarea, resultado, toast } from '../../components/ui';
import { Barras, Lineas, Ranking } from '../../components/Graficos';
import { agregarNota, archivarReporte, conciliar, crearPartida, deshacerConciliacion, generarReporte, guardarConfig, intentar, useDB, useSesion } from '../../lib/store';
import { addDays, claveMes, clp, dia, fecha, fechaHora, nombreMes, nombreMesCorto, num, pct } from '../../lib/format';
import { alertaEgresos, mesesDisponibles, nombreUsuario, rangoDeMes, totalesPartidas, ventasEnRango, ventasPorProducto } from '../../lib/logica';
import { descargarExcel, exportarPDF } from '../../lib/exportar';
import { CATS_EGRESO, LINEAS } from '../../lib/types';
import type { CatEgreso, DB, Partida, ReporteFinanciero } from '../../lib/types';

type Gran = 'diario' | 'semanal' | 'mensual';

function serieMargen(db: DB, gran: Gran) {
  const hoy = new Date();
  const puntos: { label: string; desde: Date; hasta: Date }[] = [];
  if (gran === 'diario') {
    for (let i = 29; i >= 0; i--) { const d = addDays(hoy, -i); const a = new Date(d); a.setHours(0, 0, 0, 0); const b = new Date(d); b.setHours(23, 59, 59, 999); puntos.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, desde: a, hasta: b }); }
  } else if (gran === 'semanal') {
    const lunes = addDays(hoy, -((hoy.getDay() + 6) % 7)); lunes.setHours(0, 0, 0, 0);
    for (let i = 11; i >= 0; i--) { const a = addDays(lunes, -7 * i); const b = addDays(a, 7); b.setMilliseconds(-1); puntos.push({ label: `${a.getDate()}/${a.getMonth() + 1}`, desde: a, hasta: b }); }
  } else {
    for (let i = 6; i >= 0; i--) { const clave = claveMes(dia(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1))); const r = rangoDeMes(clave); puntos.push({ label: nombreMesCorto(clave), desde: new Date(r.desde), hasta: new Date(r.hasta) }); }
  }
  return puntos.map((p) => ({ label: p.label, ...totalesPartidas(db, p.desde.toISOString(), p.hasta.toISOString()) }));
}

export function ResumenFinanciero() {
  const db = useDB();
  const { usuario } = useSesion();
  const [gran, setGran] = useState<Gran>('mensual');
  const [umbral, setUmbral] = useState(String(db.config.umbralEgresosPct));
  const mes = claveMes(dia());
  const al = alertaEgresos(db, mes);
  const mesAnt = claveMes(dia(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));
  const alAnt = alertaEgresos(db, mesAnt);
  const serie = useMemo(() => serieMargen(db, gran), [db, gran]);
  const egresosCat = CATS_EGRESO.map((c) => ({ key: c, label: c, valor: al.porCat[c] ?? 0 })).sort((a, b) => b.valor - a.valor);
  return (
    <Pagina titulo="Resumen financiero" descripcion={<>Margen operacional por período, alertas de egresos y composición de los gastos. Solo lo ven contador, auditor y gerente. <RF ids="RF55 · RF61 · RNF05" /></>}>
      {al.supera && <Aviso tipo="peligro"><strong>Alerta: los egresos de {nombreMes(mes)} ya son el {pct(al.pctEgresos)} de los ingresos</strong>, sobre el umbral de {db.config.umbralEgresosPct}%. Revisa los gastos del período.</Aviso>}
      {!al.supera && alAnt.supera && <Aviso tipo="alerta">En {nombreMes(mesAnt)} los egresos llegaron al {pct(alAnt.pctEgresos)} de los ingresos (umbral {db.config.umbralEgresosPct}%).</Aviso>}
      <div className="kpis mt">
        <Kpi label={`Ingresos ${nombreMes(mes)}`} valor={clp(al.ingresos)} />
        <Kpi label="Egresos" valor={clp(al.egresos)} detalle={`${pct(al.pctEgresos)} de los ingresos`} tono={al.supera ? 'peligro' : undefined} />
        <Kpi label="Margen operacional" valor={clp(al.margen)} detalle={pct(al.margenPct, 1)} tono={al.margen >= 0 ? 'bien' : 'peligro'} />
        <Kpi label={`Margen ${nombreMes(mesAnt)}`} valor={pct(alAnt.margenPct, 1)} detalle={clp(alAnt.margen)} />
      </div>
      <Panel titulo="Ingresos y egresos" acciones={<Pestanas valor={gran} onChange={setGran} opciones={[{ id: 'diario', label: 'Diario' }, { id: 'semanal', label: 'Semanal' }, { id: 'mensual', label: 'Mensual' }]} />}>
        <Lineas etiqueta={`Ingresos y egresos ${gran}`} etiquetas={serie.map((s) => s.label)} formatoTip={clp}
          series={[{ nombre: 'Ingresos', color: 'var(--viz-a)', valores: serie.map((s) => s.ingresos) }, { nombre: 'Egresos', color: 'var(--viz-b)', valores: serie.map((s) => s.egresos) }]} />
      </Panel>
      <div className="grid-2">
        <Panel titulo="Margen operacional">
          <Barras etiqueta={`Margen operacional ${gran}`} datos={serie.map((s) => ({ label: s.label, valor: s.margen, detalle: pct(s.margenPct, 1) }))} formatoTip={clp} alto={220} />
        </Panel>
        <Panel titulo={`Egresos de ${nombreMes(mes)} por categoría`}>
          <Ranking filas={egresosCat} formato={clp} color="var(--viz-b)" />
        </Panel>
      </div>
      {usuario?.rol === 'gerente' && (
        <Panel titulo="Umbral de alerta de egresos">
          <div className="flex">
            <Campo label="Avisar cuando los egresos superen este % de los ingresos del período"><Input type="number" value={umbral} onChange={(e) => setUmbral(e.target.value)} style={{ width: 160 }} /></Campo>
            <Boton style={{ marginTop: 22 }} onClick={() => { guardarConfig({ umbralEgresosPct: Number(umbral) }, `Umbral de egresos: ${umbral}%`); toast('Umbral actualizado'); }}>Guardar</Boton>
          </div>
        </Panel>
      )}
    </Pagina>
  );
}

function ModalNotas({ partida, onCerrar }: { partida: Partida | null; onCerrar: () => void }) {
  const db = useDB();
  const [txt, setTxt] = useState('');
  const p = partida ? db.partidas.find((x) => x.id === partida.id) : null;
  if (!p) return null;
  return (
    <Modal titulo="Notas de auditoría" abierto onCerrar={onCerrar}
      pie={<><Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton><Boton variante="primario" onClick={() => { if (resultado(intentar(() => agregarNota(p.id, txt)), 'Nota agregada')) setTxt(''); }}>Agregar nota</Boton></>}>
      <p className="texto-2 chico">{fecha(p.fecha)} · {p.categoria} · {p.descripcion} · <strong>{clp(p.monto)}</strong></p>
      <ul className="lista-simple mt">
        {p.notas.map((n, i) => <li key={i} style={{ display: 'block' }}><strong className="chico">{nombreUsuario(db, n.autorId)}</strong> <span className="texto-3 chico">{fechaHora(n.fecha)}</span><p>{n.texto}</p></li>)}
        {!p.notas.length && <li className="texto-3 chico">Sin notas todavía.</li>}
      </ul>
      <Campo label="Nueva nota"><Textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="ej. Se solicita respaldo de la factura" /></Campo>
    </Modal>
  );
}

export function Partidas() {
  const db = useDB();
  const meses = mesesDisponibles(db).reverse();
  const [mes, setMes] = useState(meses[0] ?? claveMes(dia()));
  const [tipo, setTipo] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [nueva, setNueva] = useState(false);
  const [notas, setNotas] = useState<Partida | null>(null);
  const [f, setF] = useState({ tipo: 'egreso' as 'ingreso' | 'egreso', categoria: 'Logística' as Partida['categoria'], descripcion: '', monto: '', fecha: dia() });
  const { desde, hasta } = rangoDeMes(mes);
  const filas = db.partidas
    .filter((p) => p.fecha >= desde && p.fecha <= hasta)
    .filter((p) => !tipo || p.tipo === tipo)
    .filter((p) => !cat || p.categoria === cat)
    .filter((p) => !q || p.descripcion.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const t = totalesPartidas(db, desde, hasta);
  return (
    <Pagina titulo="Ingresos y egresos" descripcion={<>Registro de todas las partidas con categoría, descripción, fecha y monto. Las ventas confirmadas entran solas como ingreso. <RF ids="RF54 · RF58 · RF62 · RF63" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => setNueva(true)}>Registrar partida</Boton>}>
      <Filtros>
        <Campo label="Mes"><Select value={mes} onChange={(e) => setMes(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</Select></Campo>
        <Campo label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option></Select></Campo>
        <Campo label="Categoría"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas</option><option>Ventas</option><option>Otros ingresos</option>{CATS_EGRESO.map((c) => <option key={c}>{c}</option>)}</Select></Campo>
        <Buscador valor={q} onChange={setQ} placeholder="Buscar descripción" />
      </Filtros>
      <div className="kpis">
        <Kpi label="Ingresos" valor={clp(t.ingresos)} />
        <Kpi label="Egresos" valor={clp(t.egresos)} />
        <Kpi label="Margen" valor={clp(t.margen)} tono={t.margen >= 0 ? 'bien' : 'peligro'} />
        <Kpi label="Partidas" valor={num(filas.length)} />
      </div>
      <Panel className="panel-plano mt">
        <Tabla clave={(p) => p.id} filas={filas} porPagina={20}
          columnas={[
            { titulo: 'Fecha', render: (p) => fecha(p.fecha), ordenar: (p) => p.fecha },
            { titulo: 'Tipo', render: (p) => <Etiqueta tono={p.tipo === 'ingreso' ? 'bien' : 'alerta'}>{p.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</Etiqueta> },
            { titulo: 'Categoría', render: (p) => p.categoria },
            { titulo: 'Descripción', render: (p) => <>{p.descripcion}{p.ventaId && <span className="celda-sub">Registrada automáticamente</span>}</> },
            { titulo: 'Monto', render: (p) => <strong className={p.monto < 0 ? 'texto-peligro' : ''}>{clp(p.monto)}</strong>, alinear: 'der', ordenar: (p) => p.monto },
            { titulo: 'Conciliada', render: (p) => (p.conciliada ? <Etiqueta tono="bien">Sí</Etiqueta> : <span className="texto-3">No</span>) },
            { titulo: 'Notas', render: (p) => <Boton chico variante="fantasma" onClick={() => setNotas(p)}>{p.notas.length ? `${p.notas.length} nota${p.notas.length > 1 ? 's' : ''}` : 'Anotar'}</Boton> },
          ]} />
      </Panel>
      <ModalNotas partida={notas} onCerrar={() => setNotas(null)} />
      <Modal titulo="Registrar partida" abierto={nueva} onCerrar={() => setNueva(false)}
        pie={<><Boton variante="fantasma" onClick={() => setNueva(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => {
          if (resultado(intentar(() => crearPartida({ tipo: f.tipo, categoria: f.categoria, descripcion: f.descripcion, monto: Number(f.monto), fecha: new Date(f.fecha + 'T12:00').toISOString() })), 'Partida registrada')) { setNueva(false); setF({ ...f, descripcion: '', monto: '' }); }
        }}>Guardar</Boton></>}>
        <div className="form-grid">
          <Campo label="Tipo"><Select value={f.tipo} onChange={(e) => { const tp = e.target.value as 'ingreso' | 'egreso'; setF({ ...f, tipo: tp, categoria: tp === 'ingreso' ? 'Otros ingresos' : 'Logística' }); }}><option value="egreso">Egreso</option><option value="ingreso">Ingreso</option></Select></Campo>
          <Campo label="Categoría"><Select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as CatEgreso })}>{f.tipo === 'egreso' ? CATS_EGRESO.map((c) => <option key={c}>{c}</option>) : <><option>Otros ingresos</option><option>Ventas</option></>}</Select></Campo>
          <Campo label="Fecha"><Input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
          <Campo label="Monto"><Input type="number" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></Campo>
          <Campo label="Descripción" ancho="completo"><Input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="ej. Pago RutaSur Express segunda quincena" /></Campo>
        </div>
      </Modal>
    </Pagina>
  );
}

function hojasReporte(db: DB, r: ReporteFinanciero) {
  const { desde, hasta } = rangoDeMes(r.periodo);
  const ps = db.partidas.filter((p) => p.fecha >= desde && p.fecha <= hasta);
  const t = totalesPartidas(db, desde, hasta);
  return [
    { nombre: 'Resumen', titulo: `${r.nombre} · ${nombreMes(r.periodo)} · Tiendas Urbano`, encabezados: ['Concepto', 'Monto'], filas: [['Ingresos', t.ingresos], ['Egresos', t.egresos], ['Margen operacional', t.margen], ['Margen %', Number(t.margenPct.toFixed(1))], ...Object.entries(t.porCat).map(([k, v]) => [`  ${k}`, v])] as (string | number)[][] },
    { nombre: 'Partidas', encabezados: ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Conciliada'], filas: ps.map((p) => [fecha(p.fecha), p.tipo, p.categoria, p.descripcion, p.monto, p.conciliada ? 'Sí' : 'No']) },
  ];
}

export function Reportes() {
  const db = useDB();
  const [tab, setTab] = useState<'mensuales' | 'consolidados'>('mensuales');
  const [verArch, setVerArch] = useState(false);
  const [gen, setGen] = useState(false);
  const meses = mesesDisponibles(db).reverse();
  const [per, setPer] = useState(meses[0]);
  const [nombre, setNombre] = useState('Estado de resultados');
  const [ver, setVer] = useState<ReporteFinanciero | null>(null);
  const filas = db.reportes.filter((r) => r.archivado === verArch).sort((a, b) => b.periodo.localeCompare(a.periodo) || b.creado.localeCompare(a.creado));
  // Consolidados trimestrales y semestrales (RF66)
  const consolidado = (nMeses: number) => {
    const out: { label: string; ventas: number; compras: number; costo: number; margenBruto: number; egresos: number; resultado: number }[] = [];
    const hoy = new Date();
    for (let k = 0; k < 2; k++) {
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() - k * nMeses + 1, 0, 23, 59, 59);
      const ini = new Date(fin.getFullYear(), fin.getMonth() - nMeses + 1, 1);
      const vs = ventasEnRango(db, ini.toISOString(), fin.toISOString());
      const ventas = vs.reduce((a, v) => a + v.total, 0);
      const costo = vs.reduce((a, v) => a + v.items.reduce((b, i) => b + i.costoUnit * i.cantidad, 0), 0);
      const t = totalesPartidas(db, ini.toISOString(), fin.toISOString());
      out.push({ label: `${nombreMesCorto(claveMes(dia(ini)))} – ${nombreMesCorto(claveMes(dia(fin)))}`, ventas, compras: t.porCat['Proveedores'] ?? 0, costo, margenBruto: ventas - costo, egresos: t.egresos, resultado: t.margen });
    }
    return out;
  };
  const tri = consolidado(3), sem = consolidado(6);
  return (
    <Pagina titulo="Reportes financieros" descripcion={<>Exportables en PDF y Excel. Ningún reporte se puede eliminar: solo se archiva con su fecha de cierre. Al cerrar cada mes se genera el resumen mensual solo. <RF ids="RF56 · RF57 · RF59 · RF66" /></>}
      acciones={tab === 'mensuales' && <Boton variante="primario" icono="plus" onClick={() => setGen(true)}>Generar reporte</Boton>}>
      <Pestanas valor={tab} onChange={setTab} opciones={[{ id: 'mensuales', label: 'Reportes por período' }, { id: 'consolidados', label: 'Consolidados trimestral y semestral' }]} />
      {tab === 'mensuales' ? (
        <Panel className="panel-plano" acciones={<Boton chico variante="fantasma" onClick={() => setVerArch(!verArch)}>{verArch ? 'Ver vigentes' : 'Ver archivados'}</Boton>} titulo={verArch ? 'Archivados' : 'Vigentes'}>
          <Tabla clave={(r) => r.id} filas={filas} vacio={verArch ? 'No hay reportes archivados.' : 'No hay reportes vigentes.'}
            columnas={[
              { titulo: 'Reporte', render: (r) => <><strong>{r.nombre}</strong><span className="celda-sub">{r.tipo === 'resumen_mensual' ? 'Generado automáticamente al cierre del mes' : `Generado por ${nombreUsuario(db, r.creadoPor)}`}</span></> },
              { titulo: 'Período', render: (r) => nombreMes(r.periodo) },
              { titulo: 'Ingresos', render: (r) => clp(r.ingresos), alinear: 'der' },
              { titulo: 'Egresos', render: (r) => clp(r.egresos), alinear: 'der' },
              { titulo: 'Margen', render: (r) => <strong className={r.margen < 0 ? 'texto-peligro' : ''}>{clp(r.margen)}</strong>, alinear: 'der' },
              { titulo: verArch ? 'Archivado el' : 'Creado', render: (r) => fecha(verArch ? r.fechaCierre : r.creado) },
              { titulo: '', render: (r) => (
                <div className="fila-acciones">
                  <Boton chico icono="eye" variante="fantasma" onClick={() => setVer(r)}>Ver</Boton>
                  <Boton chico icono="download" variante="fantasma" onClick={() => descargarExcel(`${r.nombre}-${r.periodo}`, hojasReporte(db, r))}>Excel</Boton>
                  {!r.archivado && <Boton chico variante="fantasma" onClick={() => { archivarReporte(r.id); toast('Reporte archivado con fecha de cierre'); }}>Archivar</Boton>}
                </div>
              ) },
            ]} />
        </Panel>
      ) : (
        <>
          {[['Trimestral', tri], ['Semestral', sem]].map(([titulo, datos]) => (
            <Panel key={titulo as string} titulo={`Consolidado ${String(titulo).toLowerCase()}`} className="panel-plano" acciones={<Boton chico icono="download" onClick={() => descargarExcel(`consolidado-${String(titulo).toLowerCase()}`, [{ nombre: titulo as string, titulo: `Consolidado ${titulo} de ventas, compras y rentabilidad`, encabezados: ['Período', 'Ventas', 'Compras a proveedores', 'Costo de lo vendido', 'Margen bruto', 'Egresos totales', 'Resultado operacional'], filas: (datos as typeof tri).map((d) => [d.label, d.ventas, d.compras, d.costo, d.margenBruto, d.egresos, d.resultado]) }])}>Excel</Boton>}>
              <Tabla clave={(d) => d.label} filas={datos as typeof tri}
                columnas={[
                  { titulo: 'Período', render: (d) => <strong>{d.label}</strong> },
                  { titulo: 'Ventas', render: (d) => clp(d.ventas), alinear: 'der' },
                  { titulo: 'Compras a proveedores', render: (d) => clp(d.compras), alinear: 'der' },
                  { titulo: 'Costo de lo vendido', render: (d) => clp(d.costo), alinear: 'der' },
                  { titulo: 'Margen bruto', render: (d) => <>{clp(d.margenBruto)}<span className="celda-sub">{d.ventas ? pct((d.margenBruto / d.ventas) * 100, 1) : '—'}</span></>, alinear: 'der' },
                  { titulo: 'Resultado operacional', render: (d) => <strong className={d.resultado < 0 ? 'texto-peligro' : ''}>{clp(d.resultado)}</strong>, alinear: 'der' },
                ]} />
            </Panel>
          ))}
        </>
      )}
      <Modal titulo="Generar reporte financiero" abierto={gen} onCerrar={() => setGen(false)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setGen(false)}>Cancelar</Boton><Boton variante="primario" onClick={() => { const r = generarReporte(nombre, per); toast('Reporte generado'); setGen(false); setVer(r); }}>Generar</Boton></>}>
        <div className="pila" style={{ gap: 12 }}>
          <Campo label="Nombre"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo>
          <Campo label="Período"><Select value={per} onChange={(e) => setPer(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</Select></Campo>
        </div>
      </Modal>
      <Modal titulo={ver ? `${ver.nombre} · ${nombreMes(ver.periodo)}` : ''} abierto={!!ver} onCerrar={() => setVer(null)} ancho="grande"
        pie={ver && <><Boton icono="download" onClick={() => descargarExcel(`${ver.nombre}-${ver.periodo}`, hojasReporte(db, ver))}>Excel</Boton><Boton variante="primario" icono="printer" onClick={() => exportarPDF(`${ver.nombre} ${ver.periodo}`)}>PDF</Boton></>}>
        {ver && (() => {
          const h = hojasReporte(db, ver)[0];
          return (
            <div>
              <p className="texto-2 chico">Tiendas Urbano · Comercializadora Urbano SpA · Formato de presentación para revisión contable y auditoría tributaria (RNF38).</p>
              <table className="tabla mt" style={{ maxWidth: 520 }}>
                <tbody>{h.filas.map((f, i) => <tr key={i}><td style={{ paddingLeft: 0 }}>{f[0]}</td><td className="al-der">{i === 3 ? `${f[1]}%` : clp(Number(f[1]))}</td></tr>)}</tbody>
              </table>
            </div>
          );
        })()}
      </Modal>
    </Pagina>
  );
}

export function Comparar() {
  const db = useDB();
  const meses = mesesDisponibles(db).reverse();
  const [a, setA] = useState(meses[1] ?? meses[0]);
  const [b, setB] = useState(meses[0]);
  const ta = totalesPartidas(db, rangoDeMes(a).desde, rangoDeMes(a).hasta);
  const tb = totalesPartidas(db, rangoDeMes(b).desde, rangoDeMes(b).hasta);
  const va = ventasEnRango(db, rangoDeMes(a).desde, rangoDeMes(a).hasta);
  const vb = ventasEnRango(db, rangoDeMes(b).desde, rangoDeMes(b).hasta);
  const filas: { concepto: string; a: number; b: number; moneda?: boolean }[] = [
    { concepto: 'Ingresos', a: ta.ingresos, b: tb.ingresos, moneda: true },
    { concepto: 'Egresos', a: ta.egresos, b: tb.egresos, moneda: true },
    { concepto: 'Margen operacional', a: ta.margen, b: tb.margen, moneda: true },
    ...CATS_EGRESO.map((c) => ({ concepto: `Egresos: ${c}`, a: ta.porCat[c] ?? 0, b: tb.porCat[c] ?? 0, moneda: true })),
    { concepto: 'Cantidad de ventas', a: va.length, b: vb.length },
    { concepto: 'Ticket promedio', a: va.length ? va.reduce((x, v) => x + v.total, 0) / va.length : 0, b: vb.length ? vb.reduce((x, v) => x + v.total, 0) / vb.length : 0, moneda: true },
  ];
  return (
    <Pagina titulo="Comparar períodos" descripcion={<>Resultados financieros de dos meses lado a lado. <RF ids="RF60" /></>}>
      <Filtros>
        <Campo label="Período A"><Select value={a} onChange={(e) => setA(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</Select></Campo>
        <Campo label="Período B"><Select value={b} onChange={(e) => setB(e.target.value)}>{meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</Select></Campo>
      </Filtros>
      <Panel className="panel-plano">
        <Tabla clave={(f) => f.concepto} filas={filas} porPagina={50}
          columnas={[
            { titulo: 'Concepto', render: (f) => <strong>{f.concepto}</strong> },
            { titulo: nombreMes(a), render: (f) => (f.moneda ? clp(f.a) : num(f.a)), alinear: 'der' },
            { titulo: nombreMes(b), render: (f) => (f.moneda ? clp(f.b) : num(f.b)), alinear: 'der' },
            { titulo: 'Diferencia', render: (f) => (f.moneda ? clp(f.b - f.a) : num(f.b - f.a)), alinear: 'der' },
            { titulo: 'Variación', render: (f) => { const v = f.a ? ((f.b - f.a) / Math.abs(f.a)) * 100 : 0; const bueno = f.concepto.startsWith('Egresos') ? v <= 0 : v >= 0; return <span className={bueno ? 'texto-bien' : 'texto-peligro'}>{v >= 0 ? '+' : ''}{pct(v, 1)}</span>; }, alinear: 'der' },
          ]} />
      </Panel>
      <Panel titulo="Ingresos y egresos">
        <Barras etiqueta="Ingresos, egresos y margen de ambos períodos" datos={[
          { label: `Ingresos ${nombreMesCorto(a)}`, valor: ta.ingresos }, { label: `Ingresos ${nombreMesCorto(b)}`, valor: tb.ingresos },
          { label: `Egresos ${nombreMesCorto(a)}`, valor: ta.egresos }, { label: `Egresos ${nombreMesCorto(b)}`, valor: tb.egresos },
          { label: `Margen ${nombreMesCorto(a)}`, valor: ta.margen }, { label: `Margen ${nombreMesCorto(b)}`, valor: tb.margen },
        ]} formatoTip={clp} alto={220} />
      </Panel>
    </Pagina>
  );
}

export function Rentabilidad() {
  const db = useDB();
  const [desde, setDesde] = useState(dia(addDays(new Date(), -90)));
  const [hasta, setHasta] = useState(dia());
  const [vista, setVista] = useState<'linea' | 'producto'>('linea');
  const vs = ventasEnRango(db, new Date(desde + 'T00:00').toISOString(), new Date(hasta + 'T23:59:59').toISOString());
  const por = ventasPorProducto(vs);
  const productos = Object.entries(por).map(([id, x]) => ({ p: db.productos.find((y) => y.id === id)!, ...x, margen: x.monto - x.costo })).filter((x) => x.p);
  const lineas = LINEAS.map((l) => { const ps = productos.filter((x) => x.p.linea === l); const monto = ps.reduce((a, x) => a + x.monto, 0); const costo = ps.reduce((a, x) => a + x.costo, 0); return { l, unidades: ps.reduce((a, x) => a + x.unidades, 0), monto, costo, margen: monto - costo }; }).sort((a, b) => b.margen - a.margen);
  return (
    <Pagina titulo="Rentabilidad" descripcion={<>Margen bruto (precio de venta menos costo de importación) por línea de producto o por producto en el período. <RF ids="RF65" /></>}
      acciones={<Boton icono="download" onClick={() => descargarExcel(`rentabilidad-${desde}-${hasta}`, [{ nombre: 'Por línea', titulo: `Rentabilidad del ${fecha(desde)} al ${fecha(hasta)}`, encabezados: ['Línea', 'Unidades', 'Ventas', 'Costo', 'Margen', 'Margen %'], filas: lineas.map((x) => [x.l, x.unidades, x.monto, x.costo, x.margen, x.monto ? Number(((x.margen / x.monto) * 100).toFixed(1)) : 0]) }, { nombre: 'Por producto', encabezados: ['Código', 'Producto', 'Línea', 'Unidades', 'Ventas', 'Costo', 'Margen'], filas: productos.map((x) => [x.p.sku, x.p.nombre, x.p.linea, x.unidades, x.monto, x.costo, x.margen]) }])}>Exportar Excel</Boton>}>
      <Filtros>
        <Campo label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Pestanas valor={vista} onChange={setVista} opciones={[{ id: 'linea', label: 'Por línea' }, { id: 'producto', label: 'Por producto' }]} />
      </Filtros>
      {vista === 'linea' ? (
        <div className="grid-2">
          <Panel titulo="Margen bruto por línea">
            <Barras etiqueta="Margen bruto por línea de producto" datos={lineas.map((x) => ({ label: x.l === 'Trajes de baño' ? 'Trajes baño' : x.l, valor: x.margen, detalle: x.monto ? `${pct((x.margen / x.monto) * 100, 1)} de margen` : '' }))} formatoTip={clp} alto={240} />
          </Panel>
          <Panel className="panel-plano" titulo="Detalle">
            <Tabla clave={(x) => x.l} filas={lineas}
              columnas={[
                { titulo: 'Línea', render: (x) => <strong>{x.l}</strong> },
                { titulo: 'Ventas', render: (x) => clp(x.monto), alinear: 'der' },
                { titulo: 'Margen', render: (x) => clp(x.margen), alinear: 'der' },
                { titulo: '%', render: (x) => (x.monto ? pct((x.margen / x.monto) * 100, 1) : '—'), alinear: 'der' },
              ]} />
          </Panel>
        </div>
      ) : (
        <Panel className="panel-plano">
          <Tabla clave={(x) => x.p.id} filas={productos.sort((a, b) => b.margen - a.margen)} porPagina={20}
            columnas={[
              { titulo: 'Producto', render: (x) => <><strong>{x.p.nombre}</strong><span className="celda-sub">{x.p.sku} · {x.p.color}</span></> },
              { titulo: 'Línea', render: (x) => x.p.linea },
              { titulo: 'Unidades', render: (x) => num(x.unidades), alinear: 'der', ordenar: (x) => x.unidades },
              { titulo: 'Ventas', render: (x) => clp(x.monto), alinear: 'der', ordenar: (x) => x.monto },
              { titulo: 'Costo', render: (x) => clp(x.costo), alinear: 'der' },
              { titulo: 'Margen', render: (x) => <strong>{clp(x.margen)}</strong>, alinear: 'der', ordenar: (x) => x.margen },
              { titulo: '%', render: (x) => pct((x.margen / x.monto) * 100, 1), alinear: 'der', ordenar: (x) => x.margen / x.monto },
            ]} />
        </Panel>
      )}
    </Pagina>
  );
}

export function Conciliacion() {
  const db = useDB();
  const [selP, setSelP] = useState<string | null>(null);
  const [selB, setSelB] = useState<string | null>(null);
  const [verConc, setVerConc] = useState(false);
  const mes = claveMes(dia());
  const { desde, hasta } = rangoDeMes(mes);
  const partidas = db.partidas.filter((p) => p.fecha >= desde && p.fecha <= hasta && p.conciliada === verConc).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const banco = db.banco.filter((b) => !b.partidaId).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pSel = db.partidas.find((p) => p.id === selP);
  const montoSel = pSel ? (pSel.tipo === 'ingreso' ? pSel.monto : -pSel.monto) : null;
  const sugeridos = montoSel !== null ? banco.filter((b) => Math.abs(b.monto - montoSel) <= 1) : [];
  const total = db.partidas.filter((p) => p.fecha >= desde && p.fecha <= hasta);
  return (
    <Pagina titulo="Conciliación bancaria" descripcion={<>Cruza a mano cada partida del sistema con su movimiento en la cartola del banco. <RF ids="RF64" /></>}
      acciones={<Boton variante="primario" icono="check" disabled={!selP || !selB} onClick={() => { if (selP && selB && resultado(intentar(() => conciliar(selP, selB)), 'Partida conciliada')) { setSelP(null); setSelB(null); } }}>Conciliar selección</Boton>}>
      <div className="kpis">
        <Kpi label={`Partidas de ${nombreMes(mes)}`} valor={num(total.length)} />
        <Kpi label="Conciliadas" valor={num(total.filter((p) => p.conciliada).length)} tono="bien" />
        <Kpi label="Por conciliar" valor={num(total.filter((p) => !p.conciliada).length)} tono="alerta" />
        <Kpi label="Movimientos del banco sin cruzar" valor={num(banco.length)} />
      </div>
      <div className="grid-2 mt">
        <Panel titulo="Sistema" className="panel-plano" acciones={<Boton chico variante="fantasma" onClick={() => { setVerConc(!verConc); setSelP(null); }}>{verConc ? 'Ver pendientes' : 'Ver conciliadas'}</Boton>}>
          <Tabla clave={(p) => p.id} filas={partidas} porPagina={12} onFila={verConc ? undefined : (p) => { setSelP(p.id); setSelB(null); }}
            columnas={[
              { titulo: '', render: (p) => (verConc ? null : <input type="radio" checked={selP === p.id} onChange={() => setSelP(p.id)} aria-label={p.descripcion} />), ancho: '36px' },
              { titulo: 'Fecha', render: (p) => fecha(p.fecha) },
              { titulo: 'Descripción', render: (p) => <span className="chico">{p.descripcion}</span> },
              { titulo: 'Monto', render: (p) => <strong className={p.tipo === 'egreso' ? 'texto-peligro' : ''}>{clp(p.tipo === 'ingreso' ? p.monto : -p.monto)}</strong>, alinear: 'der' },
              ...(verConc ? [{ titulo: '', render: (p: Partida) => <Boton chico variante="fantasma" onClick={() => { deshacerConciliacion(p.id); toast('Conciliación deshecha'); }}>Deshacer</Boton> }] : []),
            ]} />
        </Panel>
        <Panel titulo="Cartola del banco" className="panel-plano">
          {sugeridos.length > 0 && <div style={{ padding: '0 20px 10px' }}><Aviso tipo="info">{sugeridos.length} movimiento{sugeridos.length > 1 ? 's' : ''} del banco tiene{sugeridos.length > 1 ? 'n' : ''} el mismo monto.</Aviso></div>}
          <Tabla clave={(b) => b.id} filas={selP ? [...sugeridos, ...banco.filter((b) => !sugeridos.includes(b))] : banco} porPagina={12} onFila={(b) => setSelB(b.id)}
            columnas={[
              { titulo: '', render: (b) => <input type="radio" checked={selB === b.id} onChange={() => setSelB(b.id)} aria-label={b.descripcion} />, ancho: '36px' },
              { titulo: 'Fecha', render: (b) => fecha(b.fecha) },
              { titulo: 'Glosa', render: (b) => <span className="chico">{b.descripcion}{sugeridos.includes(b) && <> <Etiqueta tono="bien">Coincide</Etiqueta></>}</span> },
              { titulo: 'Monto', render: (b) => <strong className={b.monto < 0 ? 'texto-peligro' : ''}>{clp(b.monto)}</strong>, alinear: 'der' },
            ]} />
        </Panel>
      </div>
    </Pagina>
  );
}
