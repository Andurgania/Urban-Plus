import { useMemo, useState } from 'react';
import { Prenda } from '../../components/Prenda';
import { Boton, CategoriaTag, Etiqueta, toast, Vacio, Buscador } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { agregarAlCarrito, useDB, useSesion } from '../../lib/store';
import { navegar } from '../../lib/router';
import { clp, fecha } from '../../lib/format';
import { descuentoCampana, estadoCampana, motivoSugerencia, stockTotal, sugerenciasPara, ventasValidas } from '../../lib/logica';
import { LINEAS } from '../../lib/types';
import type { LineaProducto, Producto } from '../../lib/types';
import { NoEncontrado } from '../general/Varios';

function Tarjeta({ p, pctDesc, motivo }: { p: Producto; pctDesc: number; motivo?: string }) {
  const s = stockTotal(p);
  const conDesc = Math.round(p.precio * (1 - pctDesc / 100));
  return (
    <a className="tarjeta-prod" href={`#/tienda/producto/${p.id}`} onClick={(e) => { e.preventDefault(); navegar(`/tienda/producto/${p.id}`); }}>
      <div className="marco-prenda">
        <Prenda linea={p.linea} color={p.colorHex} etiqueta={`${p.nombre} color ${p.color}`} />
        {s === 0 ? <Etiqueta tono="neutro">Agotado</Etiqueta> : s < 6 ? <Etiqueta tono="alerta">Últimas {s}</Etiqueta> : null}
      </div>
      <div>
        {motivo && <span className="motivo-sug">{motivo}</span>}
        <h3>{p.nombre}</h3>
        <div className="meta">
          <small>{p.color}</small>
          <span className="precio">
            {pctDesc > 0 && <span className="precio-antes">{clp(p.precio)}</span>}
            {clp(conDesc)}
          </span>
        </div>
      </div>
    </a>
  );
}

export function Catalogo() {
  const db = useDB();
  const { usuario } = useSesion();
  const [linea, setLinea] = useState<LineaProducto | 'Todo'>('Todo');
  const [q, setQ] = useState('');
  const clienteId = usuario?.rol === 'cliente' ? usuario.clienteId : undefined;
  const desc = clienteId ? descuentoCampana(db, clienteId) : null;
  const pctDesc = desc?.porcentaje ?? 0;
  const activa = db.campanas.find((c) => estadoCampana(c) === 'activa' && c.tipo === 'categoria');
  const sugeridos = sugerenciasPara(db, clienteId, 4);
  const masVendidos = useMemo(() => {
    const m: Record<string, number> = {};
    ventasValidas(db).forEach((v) => v.items.forEach((i) => (m[i.productoId] = (m[i.productoId] ?? 0) + i.cantidad)));
    return m;
  }, [db]);
  const lista = db.productos
    .filter((p) => p.activo && (linea === 'Todo' || p.linea === linea))
    .filter((p) => !q || `${p.nombre} ${p.color} ${p.linea}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (stockTotal(b) > 0 ? 1 : 0) - (stockTotal(a) > 0 ? 1 : 0) || (masVendidos[b.id] ?? 0) - (masVendidos[a.id] ?? 0));
  const destacados = [db.productos[7], db.productos[21], db.productos[30]].filter(Boolean);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Ropa para la ciudad, despachada a todo Chile.</h1>
          <p>Poleras, blazers, parkas y trajes de baño seleccionados por nosotras. Sabes en todo momento dónde va tu pedido, desde la bodega hasta tu puerta.</p>
          <div className="hero-acciones">
            <Boton variante="primario" onClick={() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })}>Ver catálogo</Boton>
            <Boton onClick={() => navegar('/seguimiento')} icono="truck">Seguir mi pedido</Boton>
          </div>
        </div>
        <div className="perchero" aria-label="Productos destacados">
          {destacados.map((p) => (
            <a key={p.id} className="perchero-item" href={`#/tienda/producto/${p.id}`} onClick={(e) => { e.preventDefault(); navegar(`/tienda/producto/${p.id}`); }}>
              <Prenda linea={p.linea} color={p.colorHex} etiqueta={p.nombre} />
              <span>{p.nombre} · {clp(p.precio)}</span>
            </a>
          ))}
        </div>
      </section>

      {activa && (
        <div className="cinta-campana">
          <Icono n="sparkle" size={22} />
          <strong>{activa.nombre}</strong>
          {desc && clienteId ? (
            <>
              <p>Tu categoría es {desc.categoria}. Tienes {desc.porcentaje}% de descuento en el total de tu compra hasta el {fecha(activa.hasta)}. Se aplica solo al pagar.</p>
              <CategoriaTag c={desc.categoria} />
            </>
          ) : (
            <p>Descuentos de {Math.min(...Object.values(activa.descuentos))}% a {Math.max(...Object.values(activa.descuentos))}% según tu categoría de cliente (Bronce, Plata, Diamante o Premium) hasta el {fecha(activa.hasta)}. Inicia sesión para ver el tuyo.</p>
          )}
        </div>
      )}

      {sugeridos.length > 0 && (
        <section className="seccion-tienda">
          <header>
            <div>
              <h2>{clienteId ? 'Elegidos para ti' : 'Lo más vendido'}</h2>
              <p>{clienteId ? 'Según lo que has comprado antes.' : 'Lo que más se llevan nuestras clientas este mes.'}</p>
            </div>
          </header>
          <div className="grilla-productos">
            {sugeridos.map((p) => <Tarjeta key={p.id} p={p} pctDesc={pctDesc} motivo={motivoSugerencia(db, clienteId, p)} />)}
          </div>
        </section>
      )}

      <section className="seccion-tienda" id="catalogo">
        <header>
          <div>
            <h2>Catálogo</h2>
            <p>{lista.length} productos</p>
          </div>
          <Buscador valor={q} onChange={setQ} placeholder="Buscar prenda o color" />
        </header>
        <div className="chips" style={{ marginBottom: 18 }}>
          {(['Todo', ...LINEAS] as const).map((l) => (
            <button key={l} className={`chip ${linea === l ? 'activo' : ''}`} onClick={() => setLinea(l)}>{l}</button>
          ))}
        </div>
        {lista.length ? (
          <div className="grilla-productos">{lista.map((p) => <Tarjeta key={p.id} p={p} pctDesc={pctDesc} />)}</div>
        ) : (
          <Vacio icono="search" titulo="No encontramos prendas con esa búsqueda" texto="Prueba con otra palabra o elige otra línea." />
        )}
      </section>
    </>
  );
}

export function ProductoDetalle({ params }: { params: Record<string, string> }) {
  const db = useDB();
  const { usuario } = useSesion();
  const p = db.productos.find((x) => x.id === params.id);
  const [talla, setTalla] = useState('M');
  const [cant, setCant] = useState(1);
  if (!p) return <NoEncontrado />;
  const s = stockTotal(p);
  const clienteId = usuario?.rol === 'cliente' ? usuario.clienteId : undefined;
  const d = clienteId ? descuentoCampana(db, clienteId) : null;
  const relacionados = db.productos.filter((x) => x.linea === p.linea && x.id !== p.id && stockTotal(x) > 0).slice(0, 4);
  return (
    <>
      <button className="volver" onClick={() => navegar('/tienda')}><Icono n="left" size={16} /> Volver al catálogo</button>
      <div className="detalle-prod">
        <Prenda linea={p.linea} color={p.colorHex} tamano="grande" etiqueta={`${p.nombre} color ${p.color}`} />
        <div className="detalle-info">
          <span className="texto-3">{p.linea} · {p.sku}</span>
          <h1>{p.nombre}</h1>
          <div className="flex">
            <span className="precio">{clp(p.precio)}</span>
            {d && d.porcentaje > 0 && <Etiqueta tono="marca">−{d.porcentaje}% para ti en el total ({d.categoria})</Etiqueta>}
          </div>
          <p className="texto-2">Color {p.color.toLowerCase()}. Importado directamente desde nuestros talleres en China y revisado prenda por prenda en nuestra bodega de Santiago.</p>
          <div>
            <span className="campo-label">Talla</span>
            <div className="tallas mt-chico">
              {p.tallas.map((t) => <button key={t} className={`talla ${talla === t ? 'activo' : ''}`} onClick={() => setTalla(t)} aria-pressed={talla === t}>{t}</button>)}
            </div>
          </div>
          <div className="flex">
            <div className="cantidad">
              <button onClick={() => setCant(Math.max(1, cant - 1))} aria-label="Quitar una unidad"><Icono n="minus" size={16} /></button>
              <span>{cant}</span>
              <button onClick={() => setCant(Math.min(s, cant + 1))} aria-label="Agregar una unidad"><Icono n="plus" size={16} /></button>
            </div>
            <Boton variante="primario" icono="bag" disabled={s === 0} onClick={() => {
              const r = agregarAlCarrito(p.id, talla, cant);
              if (r.ok) toast(`${p.nombre} (talla ${talla}) agregado al carro`);
              else toast(r.error!, 'peligro');
            }}>{s === 0 ? 'Agotado' : 'Agregar al carro'}</Boton>
          </div>
          <p className="chico texto-2">{s === 0 ? 'Sin stock por ahora. Ya pedimos reposición a nuestro proveedor.' : s < 6 ? `Quedan solo ${s} unidades.` : 'Disponible para despacho inmediato.'} Despacho gratis desde {clp(db.config.envioGratisDesde)}.</p>
        </div>
      </div>
      {relacionados.length > 0 && (
        <section className="seccion-tienda">
          <header><h2>También en {p.linea.toLowerCase()}</h2></header>
          <div className="grilla-productos">{relacionados.map((x) => <Tarjeta key={x.id} p={x} pctDesc={d?.porcentaje ?? 0} />)}</div>
        </section>
      )}
    </>
  );
}
