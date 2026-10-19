// Gráficos SVG livianos con tooltip al pasar el mouse (sin librerías externas)
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.max(260, Math.floor(e[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

function escala(max: number) {
  if (max <= 0) return { tope: 1, ticks: [0, 1] };
  const pot = Math.pow(10, Math.floor(Math.log10(max)));
  const pasos = [1, 2, 2.5, 5, 10];
  let paso = pot;
  for (const p of pasos) {
    if (max / (p * pot) <= 5) { paso = p * pot; break; }
  }
  const tope = Math.ceil(max / paso) * paso;
  const ticks: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) ticks.push(v);
  return { tope, ticks };
}

export const compacto = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} mil`;
  return String(Math.round(n));
};

interface Tip { x: number; y: number; contenido: ReactNode }
function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="viz-tip" style={{ left: tip.x, top: tip.y }}>
      {tip.contenido}
    </div>
  );
}

const M = { t: 12, r: 12, b: 28, l: 52 };

// ---------- Barras verticales (una serie) ----------
export function Barras({ datos, formato = compacto, formatoTip, alto = 220, color = 'var(--viz-1)', etiqueta }: { datos: { label: string; valor: number; detalle?: string }[]; formato?: (n: number) => string; formatoTip?: (n: number) => string; alto?: number; color?: string; etiqueta: string }) {
  const { ref, w } = useAncho<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(0, ...datos.map((d) => d.valor));
  const min = Math.min(0, ...datos.map((d) => d.valor));
  const { tope, ticks } = escala(Math.max(max, -min));
  const negativos = min < 0;
  const iw = w - M.l - M.r, ih = alto - M.t - M.b;
  const y = (v: number) => (negativos ? M.t + ih / 2 - (v / tope) * (ih / 2) : M.t + ih - (v / tope) * ih);
  const bw = iw / Math.max(1, datos.length);
  const barra = Math.min(42, bw * 0.62);
  const fT = formatoTip ?? formato;
  const todosTicks = negativos ? [...ticks.slice(1).map((t) => -t).reverse(), ...ticks] : ticks;
  return (
    <div className="viz" ref={ref} role="img" aria-label={etiqueta}>
      <svg width={w} height={alto} onMouseLeave={() => setTip(null)}>
        {todosTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-base' : 'viz-grid'} />
            <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="viz-eje">{formato(t)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = M.l + i * bw + (bw - barra) / 2;
          const y0 = y(0), y1 = y(d.valor);
          const h = Math.abs(y1 - y0);
          const top = Math.min(y0, y1);
          const r = Math.min(4, h / 2, barra / 2);
          const arriba = d.valor >= 0;
          const path = arriba
            ? `M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${y0} Z`
            : `M${x},${y0} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + barra - r} Q${x + barra},${top + h} ${x + barra},${top + h - r} V${y0} Z`;
          const mostrarLabel = datos.length <= 14 || i % Math.ceil(datos.length / 12) === 0;
          return (
            <g key={i}>
              <path d={path} fill={d.valor < 0 ? 'var(--viz-neg)' : color} />
              <rect x={M.l + i * bw} y={M.t} width={bw} height={ih} fill="transparent"
                onMouseMove={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, contenido: <><strong>{d.label}</strong><span>{fT(d.valor)}</span>{d.detalle && <small>{d.detalle}</small>}</> })} />
              {mostrarLabel && <text x={M.l + i * bw + bw / 2} y={alto - 8} textAnchor="middle" className="viz-eje">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- Líneas (varias series) ----------
export interface Serie { nombre: string; color: string; valores: number[] }
export function Lineas({ etiquetas, series, formato = compacto, formatoTip, alto = 240, etiqueta }: { etiquetas: string[]; series: Serie[]; formato?: (n: number) => string; formatoTip?: (n: number) => string; alto?: number; etiqueta: string }) {
  const { ref, w } = useAncho<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const posEtiqueta = useRef<Record<number, number>>({});
  const max = Math.max(0, ...series.flatMap((s) => s.valores));
  const { tope, ticks } = escala(max);
  const iw = w - M.l - M.r - 70, ih = alto - M.t - M.b;
  const x = (i: number) => M.l + (etiquetas.length <= 1 ? iw / 2 : (i / (etiquetas.length - 1)) * iw);
  const y = (v: number) => M.t + ih - (v / tope) * ih;
  const fT = formatoTip ?? formato;
  return (
    <div className="viz" ref={ref} role="img" aria-label={etiqueta}>
      {series.length > 1 && (
        <div className="viz-leyenda">
          {series.map((s) => (
            <span key={s.nombre}><i style={{ background: s.color }} />{s.nombre}</span>
          ))}
        </div>
      )}
      <svg width={w} height={alto}
        onMouseMove={(e) => {
          const px = e.nativeEvent.offsetX;
          const i = Math.round(((px - M.l) / iw) * (etiquetas.length - 1));
          setIdx(Math.max(0, Math.min(etiquetas.length - 1, i)));
        }}
        onMouseLeave={() => setIdx(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={M.l + iw} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-base' : 'viz-grid'} />
            <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="viz-eje">{formato(t)}</text>
          </g>
        ))}
        {etiquetas.map((l, i) => (etiquetas.length <= 12 || i % Math.ceil(etiquetas.length / 10) === 0) && (
          <text key={i} x={x(i)} y={alto - 8} textAnchor="middle" className="viz-eje">{l}</text>
        ))}
        {idx !== null && <line x1={x(idx)} x2={x(idx)} y1={M.t} y2={M.t + ih} className="viz-cruz" />}
        {(() => {
          // posiciones de las etiquetas finales separadas al menos 14px
          const fin = series.map((s, i) => ({ i, y: y(s.valores[s.valores.length - 1] ?? 0) })).sort((a, b) => a.y - b.y);
          for (let k = 1; k < fin.length; k++) if (fin[k].y - fin[k - 1].y < 14) fin[k].y = fin[k - 1].y + 14;
          posEtiqueta.current = Object.fromEntries(fin.map((f) => [f.i, f.y]));
          return null;
        })()}
        {series.map((s, si) => (
          <g key={s.nombre}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
            {s.valores.length > 0 && (
              <text x={x(s.valores.length - 1) + 8} y={posEtiqueta.current[si] ?? y(s.valores[s.valores.length - 1])} dy="0.32em" className="viz-label-directo">{s.nombre}</text>
            )}
            {idx !== null && <circle cx={x(idx)} cy={y(s.valores[idx] ?? 0)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
          </g>
        ))}
      </svg>
      {idx !== null && (
        <div className="viz-tip" style={{ left: Math.min(x(idx) + 12, w - 170), top: 24 }}>
          <strong>{etiquetas[idx]}</strong>
          {series.map((s) => (
            <span key={s.nombre} className="viz-tip-fila"><i style={{ background: s.color }} />{s.nombre}: {fT(s.valores[idx] ?? 0)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Barras apiladas ----------
export function Apiladas({ etiquetas, series, alto = 240, formato = (n: number) => String(n), etiqueta, porcentaje }: { etiquetas: string[]; series: Serie[]; alto?: number; formato?: (n: number) => string; etiqueta: string; porcentaje?: boolean }) {
  const { ref, w } = useAncho<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const totales = etiquetas.map((_, i) => series.reduce((a, s) => a + (s.valores[i] ?? 0), 0));
  const { tope, ticks } = porcentaje ? { tope: 100, ticks: [0, 25, 50, 75, 100] } : escala(Math.max(...totales, 0));
  const iw = w - M.l - M.r, ih = alto - M.t - M.b;
  const bw = iw / Math.max(1, etiquetas.length);
  const barra = Math.min(48, bw * 0.6);
  const y = (v: number) => M.t + ih - (v / tope) * ih;
  return (
    <div className="viz" ref={ref} role="img" aria-label={etiqueta}>
      <div className="viz-leyenda">
        {series.map((s) => (
          <span key={s.nombre}><i style={{ background: s.color }} />{s.nombre}</span>
        ))}
      </div>
      <svg width={w} height={alto} onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'viz-base' : 'viz-grid'} />
            <text x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="viz-eje">{porcentaje ? `${t}%` : formato(t)}</text>
          </g>
        ))}
        {etiquetas.map((l, i) => {
          let acc = 0;
          const x = M.l + i * bw + (bw - barra) / 2;
          const tot = totales[i] || 1;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = s.valores[i] ?? 0;
                const val = porcentaje ? (v / tot) * 100 : v;
                const y0 = y(acc), y1 = y(acc + val);
                acc += val;
                const h = Math.max(0, y0 - y1 - (si < series.length - 1 ? 2 : 0));
                const esTope = series.slice(si + 1).every((x2) => (x2.valores[i] ?? 0) === 0);
                const r = esTope ? Math.min(4, h / 2) : 0;
                return h > 0 ? (
                  <path key={si} fill={s.color}
                    d={`M${x},${y1 + h + (si < series.length - 1 ? 0 : 0)} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barra - r} Q${x + barra},${y1} ${x + barra},${y1 + r} V${y1 + h} Z`} />
                ) : null;
              })}
              <rect x={M.l + i * bw} y={M.t} width={bw} height={ih} fill="transparent"
                onMouseMove={(e) => setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, contenido: <><strong>{l}</strong>{series.map((s) => <span key={s.nombre} className="viz-tip-fila"><i style={{ background: s.color }} />{s.nombre}: {formato(s.valores[i] ?? 0)}{porcentaje ? ` (${Math.round(((s.valores[i] ?? 0) / tot) * 100)}%)` : ''}</span>)}</> })} />
              <text x={M.l + i * bw + bw / 2} y={alto - 8} textAnchor="middle" className="viz-eje">{l}</text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- Ranking horizontal (HTML) ----------
export function Ranking({ filas, formato, color = 'var(--viz-1)' }: { filas: { label: ReactNode; valor: number; extra?: ReactNode; key: string }[]; formato: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ol className="ranking">
      {filas.map((f, i) => (
        <li key={f.key}>
          <span className="ranking-pos">{i + 1}</span>
          <div className="ranking-cuerpo">
            <div className="ranking-linea">
              <span className="ranking-label">{f.label}</span>
              <span className="ranking-valor">{formato(f.valor)}</span>
            </div>
            <div className="ranking-barra"><span style={{ width: `${(f.valor / max) * 100}%`, background: color }} /></div>
            {f.extra && <small>{f.extra}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const COLORES_TIER = { Bronce: '#C97AA0', Plata: '#A8487A', Diamante: '#8A2D5F', Premium: '#561637' };
