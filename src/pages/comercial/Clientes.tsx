import { useMemo, useState } from 'react';
import { Aviso, Boton, Buscador, Campo, CategoriaTag, Definiciones, EstadoPedidoTag, Filtros, Input, Kpi, Modal, Pagina, Panel, Pestanas, RF, Select, Tabla, Etiqueta, resultado, useConfirmar, toast } from '../../components/ui';
import { Prenda } from '../../components/Prenda';
import { anonimizarCliente, guardarCliente, intentar, useDB, useSesion } from '../../lib/store';
import { navegar } from '../../lib/router';
import { clp, fecha, formatoRut, num } from '../../lib/format';
import { mapaCategorias, motivoSugerencia, resumenCliente, sugerenciasPara } from '../../lib/logica';
import { CATEGORIAS, ESTADOS_PEDIDO } from '../../lib/types';
import type { Cliente } from '../../lib/types';
import { NoEncontrado } from '../general/Varios';
import { descargarExcel } from '../../lib/exportar';

const vacio = (): Cliente => ({ id: '', tipo: 'natural', nombre: '', rut: '', email: '', telefono: '', direccion: '', comuna: 'Santiago', zonaId: '', creado: '' });

export function FormCliente({ abierto, onCerrar, inicial, onGuardado }: { abierto: boolean; onCerrar: () => void; inicial?: Cliente; onGuardado?: (c: Cliente) => void }) {
  const db = useDB();
  const [c, setC] = useState<Cliente>(inicial ?? vacio());
  const [abiertoPrev, setAbiertoPrev] = useState(false);
  if (abierto !== abiertoPrev) {
    setAbiertoPrev(abierto);
    if (abierto) setC(inicial ?? vacio());
  }
  const comunas = db.zonas.filter((z) => z.activa).flatMap((z) => z.comunas).sort((a, b) => a.localeCompare(b, 'es'));
  const set = (k: keyof Cliente, v: string) => setC({ ...c, [k]: v });
  return (
    <Modal titulo={inicial ? 'Editar cliente' : 'Nuevo cliente'} abierto={abierto} onCerrar={onCerrar}
      pie={<><Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" onClick={() => {
        const r = intentar(() => guardarCliente({ ...c, rut: formatoRut(c.rut) }));
        if (resultado(r, inicial ? 'Cliente actualizado' : 'Cliente registrado') && r.ok) { onGuardado?.(r.valor); onCerrar(); }
      }}>Guardar cliente</Boton></>}>
      <Pestanas valor={c.tipo} onChange={(v) => setC({ ...c, tipo: v })} opciones={[{ id: 'natural', label: 'Persona natural' }, { id: 'empresa', label: 'Empresa' }]} />
      <div className="form-grid">
        <Campo label={c.tipo === 'empresa' ? 'Nombre de fantasía' : 'Nombre completo'}><Input value={c.nombre} onChange={(e) => set('nombre', e.target.value)} /></Campo>
        <Campo label={c.tipo === 'empresa' ? 'RUT empresa' : 'RUT'} ayuda="Se valida el dígito verificador"><Input value={c.rut} onChange={(e) => set('rut', e.target.value)} placeholder="12.345.678-5" /></Campo>
        {c.tipo === 'empresa' && (
          <>
            <Campo label="Razón social"><Input value={c.razonSocial ?? ''} onChange={(e) => set('razonSocial', e.target.value)} /></Campo>
            <Campo label="Giro"><Input value={c.giro ?? ''} onChange={(e) => set('giro', e.target.value)} /></Campo>
          </>
        )}
        <Campo label="Correo"><Input type="email" value={c.email} onChange={(e) => set('email', e.target.value)} /></Campo>
        <Campo label="Teléfono"><Input value={c.telefono} onChange={(e) => set('telefono', e.target.value)} /></Campo>
        <Campo label="Dirección" ancho="completo"><Input value={c.direccion} onChange={(e) => set('direccion', e.target.value)} /></Campo>
        <Campo label="Comuna">
          <Select value={c.comuna} onChange={(e) => set('comuna', e.target.value)}>{comunas.map((x) => <option key={x}>{x}</option>)}</Select>
        </Campo>
      </div>
      <p className="chico texto-3 mt">Los datos personales se tratan según la Ley 19.628 y se guardan cifrados (RNF22, RNF27).</p>
    </Modal>
  );
}

export function SelectorCliente({ valor, onChange }: { valor: string; onChange: (id: string) => void }) {
  const db = useDB();
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const sel = db.clientes.find((c) => c.id === valor);
  const res = q.length >= 2 ? db.clientes.filter((c) => !c.anonimizado && `${c.nombre} ${c.rut} ${c.razonSocial ?? ''} ${c.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div>
      {sel ? (
        <div className="flex-entre">
          <div>
            <strong>{sel.nombre}</strong>
            <span className="celda-sub">{sel.tipo === 'empresa' ? sel.razonSocial + ' · ' : ''}RUT {sel.rut} · {sel.email}</span>
          </div>
          <Boton chico variante="fantasma" onClick={() => onChange('')}>Cambiar</Boton>
        </div>
      ) : (
        <>
          <div className="flex">
            <div style={{ flex: 1, minWidth: 220 }}><Buscador valor={q} onChange={setQ} placeholder="Buscar por nombre, RUT o correo" /></div>
            <Boton chico icono="plus" onClick={() => setNuevo(true)}>Nuevo cliente</Boton>
          </div>
          {res.length > 0 && (
            <ul className="lista-simple mt-chico">
              {res.map((c) => (
                <li key={c.id}>
                  <span>{c.nombre} <span className="texto-3 chico">{c.tipo === 'empresa' ? 'Empresa · ' : ''}{c.rut}</span></span>
                  <Boton chico onClick={() => { onChange(c.id); setQ(''); }}>Elegir</Boton>
                </li>
              ))}
            </ul>
          )}
          {q.length >= 2 && !res.length && <p className="chico texto-3 mt-chico">No hay clientes con esa búsqueda. Puedes registrarlo como nuevo.</p>}
        </>
      )}
      <FormCliente abierto={nuevo} onCerrar={() => setNuevo(false)} onGuardado={(c) => onChange(c.id)} />
    </div>
  );
}

export function Clientes() {
  const db = useDB();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [cat, setCat] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const mapa = useMemo(() => mapaCategorias(db), [db]);
  const filas = db.clientes
    .filter((c) => !tipo || c.tipo === tipo)
    .filter((c) => !cat || mapa[c.id].categoria === cat)
    .filter((c) => !q || `${c.nombre} ${c.rut} ${c.email} ${c.razonSocial ?? ''} ${c.comuna}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Pagina titulo="Clientes" descripcion={<>Personas naturales y empresas, con su categoría y su historial. <RF ids="Caso · RF10 · RF25" /></>}
      acciones={<Boton variante="primario" icono="plus" onClick={() => setNuevo(true)}>Nuevo cliente</Boton>}>
      <div className="kpis">
        <Kpi label="Clientes" valor={num(db.clientes.length)} />
        <Kpi label="Personas naturales" valor={num(db.clientes.filter((c) => c.tipo === 'natural').length)} />
        <Kpi label="Empresas" valor={num(db.clientes.filter((c) => c.tipo === 'empresa').length)} />
        <Kpi label="Compraron este año" valor={num(Object.values(mapa).filter((r) => r.compras > 0).length)} />
      </div>
      <Panel className="panel-plano mt">
        <div style={{ padding: '16px 20px 0' }}>
          <Filtros>
            <Buscador valor={q} onChange={setQ} placeholder="Nombre, RUT, correo o comuna" />
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de cliente" style={{ width: 180 }}>
              <option value="">Todos los tipos</option><option value="natural">Personas naturales</option><option value="empresa">Empresas</option>
            </Select>
            <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría" style={{ width: 180 }}>
              <option value="">Todas las categorías</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Filtros>
        </div>
        <Tabla clave={(c) => c.id} filas={filas} onFila={(c) => navegar('/clientes/' + c.id)}
          columnas={[
            { titulo: 'Cliente', render: (c) => <><strong>{c.nombre}</strong><span className="celda-sub">{c.tipo === 'empresa' ? c.razonSocial : c.email}</span></>, ordenar: (c) => c.nombre },
            { titulo: 'Tipo', render: (c) => <Etiqueta tono={c.tipo === 'empresa' ? 'info' : 'neutro'}>{c.tipo === 'empresa' ? 'Empresa' : 'Persona'}</Etiqueta> },
            { titulo: 'RUT', render: (c) => <span className="mono">{c.rut}</span> },
            { titulo: 'Comuna', render: (c) => c.comuna, ordenar: (c) => c.comuna },
            { titulo: 'Categoría', render: (c) => <CategoriaTag c={mapa[c.id].categoria} />, ordenar: (c) => CATEGORIAS.indexOf(mapa[c.id].categoria) },
            { titulo: 'Compras (12 meses)', render: (c) => num(mapa[c.id].compras), alinear: 'der', ordenar: (c) => mapa[c.id].compras },
            { titulo: 'Monto (12 meses)', render: (c) => clp(mapa[c.id].monto), alinear: 'der', ordenar: (c) => mapa[c.id].monto },
            { titulo: 'Última compra', render: (c) => fecha(mapa[c.id].ultima), ordenar: (c) => mapa[c.id].ultima ?? '' },
          ]} />
      </Panel>
      <FormCliente abierto={nuevo} onCerrar={() => setNuevo(false)} onGuardado={(c) => navegar('/clientes/' + c.id)} />
    </Pagina>
  );
}

export function ClienteDetalle({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const { usuario } = useSesion();
  const c = db.clientes.find((x) => x.id === params.id);
  const [editar, setEditar] = useState(false);
  const [estado, setEstado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const { confirmar, dialogo } = useConfirmar();
  if (!c) return <NoEncontrado />;
  const r = resumenCliente(db, c.id);
  const pedidos = db.pedidos
    .filter((p) => p.clienteId === c.id)
    .filter((p) => !estado || p.estado === estado)
    .filter((p) => !desde || p.historial[0].fecha >= new Date(desde + 'T00:00').toISOString())
    .filter((p) => !hasta || p.historial[0].fecha <= new Date(hasta + 'T23:59').toISOString())
    .sort((a, b) => b.historial[0].fecha.localeCompare(a.historial[0].fecha));
  const sug = sugerenciasPara(db, c.id, 4);
  const ventas = db.ventas.filter((v) => v.clienteId === c.id);
  return (
    <Pagina titulo={c.nombre} volver="/clientes" descripcion={c.tipo === 'empresa' ? `${c.razonSocial} · ${c.giro}` : 'Persona natural'}
      acciones={<>
        {!c.anonimizado && <Boton icono="edit" onClick={() => setEditar(true)}>Editar</Boton>}
        {usuario?.rol === 'area' || usuario?.rol === 'ejecutivo' ? (!c.anonimizado && (
          <Boton variante="fantasma" onClick={async () => {
            if (await confirmar('Anonimizar datos personales', 'Se reemplazan el nombre, RUT, correo, teléfono y dirección por datos anónimos. Las ventas se conservan para la contabilidad. Esta acción no se puede deshacer.', 'Anonimizar', true)) {
              anonimizarCliente(c.id);
              toast('Datos personales anonimizados');
            }
          }}>Anonimizar datos (RNF23)</Boton>
        )) : null}
      </>}>
      {c.anonimizado && <Aviso tipo="info">Los datos personales de este cliente fueron anonimizados a solicitud formal.</Aviso>}
      <div className="kpis">
        <Kpi label="Categoría actual" valor={<CategoriaTag c={r.categoria} />} detalle="Según compras de los últimos 12 meses" />
        <Kpi label="Compras (12 meses)" valor={num(r.compras)} />
        <Kpi label="Monto acumulado" valor={clp(r.monto)} />
        <Kpi label="Última compra" valor={fecha(r.ultima)} />
      </div>
      <div className="grid-sidebar mt">
        <Panel titulo={<>Historial de pedidos <RF ids="RF10" /></>} className="panel-plano">
          <div style={{ padding: '0 20px' }}>
            <Filtros>
              <Campo label="Estado"><Select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{e === 'en_ruta' ? 'En ruta' : e === 'preparacion' ? 'En preparación' : e.charAt(0).toUpperCase() + e.slice(1)}</option>)}</Select></Campo>
              <Campo label="Desde"><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
              <Campo label="Hasta"><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            </Filtros>
          </div>
          <Tabla clave={(p) => p.id} filas={pedidos} porPagina={8} onFila={(p) => navegar('/despacho/pedido/' + p.id)} vacio="No hay pedidos con esos filtros."
            columnas={[
              { titulo: 'Pedido', render: (p) => <strong>{p.nro}</strong> },
              { titulo: 'Fecha', render: (p) => fecha(p.historial[0].fecha) },
              { titulo: 'Total', render: (p) => clp(db.ventas.find((v) => v.id === p.ventaId)?.total ?? 0), alinear: 'der' },
              { titulo: 'Estado', render: (p) => <EstadoPedidoTag e={p.estado} /> },
              { titulo: 'Entrega', render: (p) => (p.entrega ? fecha(p.entrega.fecha) : `Estimada ${fecha(p.estimadoHasta)}`) },
            ]} />
        </Panel>
        <div className="pila">
          <Panel titulo="Datos de contacto">
            <Definiciones items={[['RUT', c.rut], ['Correo', c.email], ['Teléfono', c.telefono], ['Dirección', `${c.direccion}, ${c.comuna}`], ['Zona', db.zonas.find((z) => z.id === c.zonaId)?.nombre ?? '—'], ['Cliente desde', fecha(c.creado)], ['Total de ventas', num(ventas.length)]]} />
          </Panel>
          <Panel titulo="Productos sugeridos">
            <p className="chico texto-3" style={{ marginBottom: 10 }}>Según lo que ha comprado. Útil para ofrecer en la próxima venta.</p>
            {sug.map((p) => (
              <div key={p.id} className="flex" style={{ padding: '6px 0', flexWrap: 'nowrap' }}>
                <div style={{ width: 52, flex: 'none' }}><Prenda linea={p.linea} color={p.colorHex} tamano="chico" /></div>
                <div><strong className="chico">{p.nombre}</strong><span className="celda-sub">{motivoSugerencia(db, c.id, p)} · {clp(p.precio)}</span></div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <FormCliente abierto={editar} onCerrar={() => setEditar(false)} inicial={c} />
      {dialogo}
    </Pagina>
  );
}

export function exportarClientes(db: ReturnType<typeof useDB>) {
  const mapa = mapaCategorias(db);
  descargarExcel('clientes-urbano', [{ nombre: 'Clientes', titulo: 'Clientes de Tiendas Urbano', encabezados: ['Nombre', 'Tipo', 'RUT', 'Comuna', 'Categoría', 'Compras 12m', 'Monto 12m'], filas: db.clientes.map((c) => [c.nombre, c.tipo, c.rut, c.comuna, mapa[c.id].categoria, mapa[c.id].compras, mapa[c.id].monto]) }]);
}
