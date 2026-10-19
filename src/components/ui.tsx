// Componentes de interfaz reutilizables
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icono } from './Icono';
import type { Categoria, EstadoPedido } from '../lib/types';
import { navegar } from '../lib/router';

// ---------- Botones ----------
type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito';
export function Boton({ variante = 'secundario', icono, chico, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icono?: string; chico?: boolean }) {
  return (
    <button {...rest} className={`btn btn-${variante} ${chico ? 'btn-chico' : ''} ${className}`}>
      {icono && <Icono n={icono} size={chico ? 15 : 17} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Enlace({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={'#' + to} className={`enlace ${className}`} onClick={(e) => { e.preventDefault(); navegar(to); }}>
      {children}
    </a>
  );
}

// ---------- Formularios ----------
export function Campo({ label, ayuda, error, children, ancho }: { label: string; ayuda?: ReactNode; error?: string; children: ReactNode; ancho?: 'completo' | 'medio' }) {
  return (
    <label className={`campo ${ancho === 'completo' ? 'campo-completo' : ''}`}>
      <span className="campo-label">{label}</span>
      {children}
      {error ? <span className="campo-error">{error}</span> : ayuda ? <span className="campo-ayuda">{ayuda}</span> : null}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`input ${p.className ?? ''}`} />;
export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={`input ${p.className ?? ''}`}>
    {children}
  </select>
);
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`input ${p.className ?? ''}`} />;

export function Buscador({ valor, onChange, placeholder = 'Buscar…' }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="buscador">
      <Icono n="search" size={16} />
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {valor && (
        <button onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <Icono n="x" size={14} />
        </button>
      )}
    </div>
  );
}

export function Interruptor({ activo, onChange, label }: { activo: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} className={`switch ${activo ? 'on' : ''}`} onClick={() => onChange(!activo)}>
      <span className="switch-pista"><span className="switch-bola" /></span>
      <span>{label}</span>
    </button>
  );
}

// ---------- Estructura de página ----------
export function Pagina({ titulo, descripcion, acciones, children, volver }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode; children: ReactNode; volver?: string }) {
  return (
    <div className="pagina">
      <header className="pagina-head">
        <div>
          {volver && (
            <button className="volver" onClick={() => navegar(volver)}>
              <Icono n="left" size={16} /> Volver
            </button>
          )}
          <h1>{titulo}</h1>
          {descripcion && <p className="pagina-desc">{descripcion}</p>}
        </div>
        {acciones && <div className="pagina-acciones">{acciones}</div>}
      </header>
      {children}
    </div>
  );
}

export function Panel({ titulo, acciones, children, className = '', id }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`panel ${className}`} id={id}>
      {(titulo || acciones) && (
        <div className="panel-head">
          {titulo && <h2>{titulo}</h2>}
          {acciones && <div className="panel-acciones">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ valor, label, detalle, tono }: { valor: ReactNode; label: string; detalle?: ReactNode; tono?: 'alerta' | 'bien' | 'peligro' }) {
  return (
    <div className={`kpi ${tono ? 'kpi-' + tono : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-valor">{valor}</strong>
      {detalle && <span className="kpi-detalle">{detalle}</span>}
    </div>
  );
}

export function Vacio({ icono = 'box', titulo, texto, accion }: { icono?: string; titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="vacio">
      <Icono n={icono} size={28} />
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'info' | 'alerta' | 'peligro' | 'bien'; children: ReactNode }) {
  const ic = tipo === 'bien' ? 'check' : tipo === 'info' ? 'info' : 'alert';
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'peligro' ? 'alert' : 'status'}>
      <Icono n={ic} size={18} />
      <div>{children}</div>
    </div>
  );
}

// ---------- Etiquetas ----------
export function Etiqueta({ tono = 'neutro', children }: { tono?: 'neutro' | 'bien' | 'alerta' | 'peligro' | 'info' | 'marca'; children: ReactNode }) {
  return <span className={`etq etq-${tono}`}>{children}</span>;
}

const TONO_ESTADO: Record<EstadoPedido, 'neutro' | 'info' | 'marca' | 'bien' | 'peligro'> = { pendiente: 'neutro', preparacion: 'info', en_ruta: 'marca', entregado: 'bien', incidencia: 'peligro' };
const NOMBRE_ESTADO: Record<EstadoPedido, string> = { pendiente: 'Pendiente', preparacion: 'En preparación', en_ruta: 'En ruta', entregado: 'Entregado', incidencia: 'Con incidencia' };
export const EstadoPedidoTag = ({ e }: { e: EstadoPedido }) => <Etiqueta tono={TONO_ESTADO[e]}>{NOMBRE_ESTADO[e]}</Etiqueta>;

export function CategoriaTag({ c }: { c: Categoria }) {
  return (
    <span className={`cat cat-${c.toLowerCase()}`}>
      <span className="cat-gema" aria-hidden />
      {c}
    </span>
  );
}

// ---------- Tabla ----------
export interface Columna<T> {
  titulo: string;
  render: (fila: T) => ReactNode;
  alinear?: 'der' | 'centro';
  ordenar?: (fila: T) => string | number;
  ancho?: string;
}
export function Tabla<T>({ columnas, filas, vacio = 'No hay datos para mostrar.', porPagina = 15, onFila, clave }: { columnas: Columna<T>[]; filas: T[]; vacio?: string; porPagina?: number; onFila?: (f: T) => void; clave: (f: T) => string }) {
  const [pag, setPag] = useState(0);
  const [orden, setOrden] = useState<{ col: number; asc: boolean } | null>(null);
  const ordenadas = useMemo(() => {
    if (!orden || !columnas[orden.col]?.ordenar) return filas;
    const f = columnas[orden.col].ordenar!;
    return [...filas].sort((a, b) => {
      const x = f(a), y = f(b);
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
      return orden.asc ? r : -r;
    });
  }, [filas, orden, columnas]);
  const total = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const p = Math.min(pag, total - 1);
  const vis = ordenadas.slice(p * porPagina, (p + 1) * porPagina);
  useEffect(() => setPag(0), [filas.length]);
  return (
    <div className="tabla-wrap">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={i} className={c.alinear ? 'al-' + c.alinear : ''} style={c.ancho ? { width: c.ancho } : undefined}>
                {c.ordenar ? (
                  <button className="th-orden" onClick={() => setOrden((o) => (o?.col === i ? { col: i, asc: !o.asc } : { col: i, asc: false }))}>
                    {c.titulo}
                    {orden?.col === i && <Icono n={orden.asc ? 'arrowUp' : 'arrowDown'} size={12} />}
                  </button>
                ) : (
                  c.titulo
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vis.map((f) => (
            <tr key={clave(f)} onClick={onFila ? () => onFila(f) : undefined} className={onFila ? 'fila-click' : ''} tabIndex={onFila ? 0 : undefined} onKeyDown={onFila ? (e) => e.key === 'Enter' && onFila(f) : undefined}>
              {columnas.map((c, i) => (
                <td key={i} className={c.alinear ? 'al-' + c.alinear : ''} data-label={c.titulo}>
                  {c.render(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!filas.length && <div className="tabla-vacia">{vacio}</div>}
      {total > 1 && (
        <div className="paginacion">
          <span>
            {p * porPagina + 1}–{Math.min((p + 1) * porPagina, ordenadas.length)} de {ordenadas.length}
          </span>
          <div>
            <button disabled={p === 0} onClick={() => setPag(p - 1)} aria-label="Página anterior"><Icono n="left" size={16} /></button>
            <button disabled={p >= total - 1} onClick={() => setPag(p + 1)} aria-label="Página siguiente"><Icono n="right" size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Pestañas ----------
export function Pestanas<T extends string>({ opciones, valor, onChange }: { opciones: { id: T; label: ReactNode }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="pestanas" role="tablist">
      {opciones.map((o) => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} className={valor === o.id ? 'activa' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({ titulo, abierto, onCerrar, children, pie, ancho }: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: 'grande' | 'chico' }) {
  const ref = useRef<HTMLDivElement>(null);
  const tid = useId();
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', k);
    const foco = ref.current?.querySelector<HTMLElement>('input, select, textarea, button.btn-primario');
    foco?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={`modal ${ancho ? 'modal-' + ancho : ''}`} role="dialog" aria-modal="true" aria-labelledby={tid} ref={ref}>
        <div className="modal-head">
          <h2 id={tid}>{titulo}</h2>
          <button className="icono-btn" onClick={onCerrar} aria-label="Cerrar"><Icono n="x" /></button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}

// ---------- Toasts ----------
type Toast = { id: number; texto: string; tipo: 'bien' | 'peligro' | 'info' };
let toasts: Toast[] = [];
const oyT = new Set<() => void>();
export function toast(texto: string, tipo: Toast['tipo'] = 'bien') {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, texto, tipo }];
  oyT.forEach((f) => f());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    oyT.forEach((f) => f());
  }, tipo === 'peligro' ? 6000 : 3800);
}
export function Toasts() {
  const lista = useSyncExternalStore((cb) => { oyT.add(cb); return () => oyT.delete(cb); }, () => toasts);
  return (
    <div className="toasts" aria-live="polite">
      {lista.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipo}`}>
          <Icono n={t.tipo === 'bien' ? 'check' : t.tipo === 'peligro' ? 'alert' : 'info'} size={18} />
          {t.texto}
        </div>
      ))}
    </div>
  );
}

/** Muestra el resultado de una acción del store */
export function resultado(r: { ok: true } | { ok: false; error: string }, exito?: string) {
  if (r.ok) {
    if (exito) toast(exito, 'bien');
    return true;
  }
  toast(r.error, 'peligro');
  return false;
}

// ---------- Confirmación ----------
export function useConfirmar() {
  const [estado, setEstado] = useState<{ titulo: string; texto: ReactNode; accion: string; peligro?: boolean; resolver: (v: boolean) => void } | null>(null);
  const confirmar = (titulo: string, texto: ReactNode, accion = 'Confirmar', peligro = false) =>
    new Promise<boolean>((resolver) => setEstado({ titulo, texto, accion, peligro, resolver }));
  const cerrar = (v: boolean) => {
    estado?.resolver(v);
    setEstado(null);
  };
  const dialogo = (
    <Modal titulo={estado?.titulo ?? ''} abierto={!!estado} onCerrar={() => cerrar(false)} ancho="chico"
      pie={<><Boton variante="fantasma" onClick={() => cerrar(false)}>Cancelar</Boton><Boton variante={estado?.peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)}>{estado?.accion}</Boton></>}>
      <div className="texto-modal">{estado?.texto}</div>
    </Modal>
  );
  return { confirmar, dialogo };
}

export function Avatar({ nombre, chico }: { nombre: string; chico?: boolean }) {
  const ini = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  let h = 0;
  for (const ch of nombre) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className={`avatar ${chico ? 'avatar-chico' : ''}`} style={{ background: `hsl(${h} 35% 88%)`, color: `hsl(${h} 45% 28%)` }} aria-hidden>
      {ini}
    </span>
  );
}

export function Filtros({ children }: { children: ReactNode }) {
  return <div className="filtros">{children}</div>;
}

export function Definiciones({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="defs">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RF({ ids }: { ids: string }) {
  return <span className="rf" title="Requisitos que cubre esta pantalla">{ids}</span>;
}
