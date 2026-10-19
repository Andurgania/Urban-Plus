// Ilustración de cada prenda dibujada con el color real del producto (reemplaza las fotos en la demo)
import type { LineaProducto } from '../lib/types';

function mezclar(hex: string, con: string, t: number) {
  const a = hex.replace('#', ''), b = con.replace('#', '');
  const c = [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
}
function luz(hex: string) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const FORMAS: Record<LineaProducto, { cuerpo: string; detalles: string[] }> = {
  Poleras: {
    cuerpo: 'M70 38 L96 30 Q120 44 144 30 L170 38 L196 70 L172 86 L162 76 L162 176 Q120 184 78 176 L78 76 L68 86 L44 70 Z',
    detalles: ['M96 30 Q120 52 144 30'],
  },
  Blazers: {
    cuerpo: 'M78 34 L100 26 L120 70 L140 26 L162 34 Q184 40 190 64 L202 156 L178 160 L170 96 L170 178 L146 182 L120 174 L94 182 L70 178 L70 96 L62 160 L38 156 L50 64 Q56 40 78 34 Z',
    detalles: ['M100 26 L108 66 L96 72 L120 112', 'M140 26 L132 66 L144 72 L120 112', 'M120 112 L120 174', 'M80 130 L100 130', 'M70 96 L70 120', 'M170 96 L170 120'],
  },
  Pantalones: {
    cuerpo: 'M82 28 L158 28 L170 186 L132 186 L120 84 L108 186 L70 186 Z',
    detalles: ['M82 42 L158 42', 'M120 42 L120 84', 'M92 52 Q100 66 112 60', 'M148 52 Q140 66 128 60'],
  },
  Parkas: {
    cuerpo: 'M84 30 Q120 10 156 30 L176 44 L198 150 L172 158 L166 100 L164 184 Q120 192 76 184 L74 100 L68 158 L42 150 L64 44 Z',
    detalles: ['M120 30 L120 186', 'M78 70 Q120 80 162 70', 'M76 100 Q120 110 164 100', 'M76 130 Q120 140 164 130', 'M76 160 Q120 170 164 160', 'M92 26 Q120 44 148 26'],
  },
  Chaquetas: {
    cuerpo: 'M78 32 L104 26 L120 40 L136 26 L162 32 L190 62 L186 160 L164 162 L162 100 L160 176 L80 176 L78 100 L76 162 L54 160 L50 62 Z',
    detalles: ['M120 40 L120 176', 'M104 26 L96 52 L120 40', 'M136 26 L144 52 L120 40', 'M88 112 L106 112', 'M134 112 L152 112', 'M80 166 L160 166'],
  },
  'Trajes de baño': {
    cuerpo: 'M92 34 Q96 30 100 34 L112 82 Q120 88 128 82 L140 34 Q144 30 148 34 L156 96 Q164 128 154 152 L138 182 Q120 190 102 182 L86 152 Q76 128 84 96 Z',
    detalles: ['M88 104 Q120 122 152 104', 'M112 82 Q120 98 128 82'],
  },
};

export function Prenda({ linea, color, tamano = 'normal', etiqueta }: { linea: LineaProducto; color: string; tamano?: 'normal' | 'chico' | 'grande'; etiqueta?: string }) {
  const f = FORMAS[linea];
  const claro = luz(color) > 0.8;
  const trazo = claro ? mezclar(color, '#3b2f45', 0.45) : mezclar(color, '#000000', 0.35);
  const fondo = mezclar(color, '#ffffff', claro ? 0 : 0.84);
  const fondoFinal = claro ? '#EFEAF1' : fondo;
  return (
    <svg viewBox="0 0 240 210" className={`prenda prenda-${tamano}`} role="img" aria-label={etiqueta ?? linea}>
      <rect width="240" height="210" fill={fondoFinal} />
      <ellipse cx="120" cy="196" rx="74" ry="7" fill={mezclar(fondoFinal, '#000000', 0.08)} />
      <path d={f.cuerpo} fill={color} stroke={trazo} strokeWidth="2.2" strokeLinejoin="round" />
      {f.detalles.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={trazo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
      ))}
      {linea === 'Blazers' && (
        <>
          <circle cx="117" cy="128" r="3" fill={trazo} />
          <circle cx="117" cy="146" r="3" fill={trazo} />
        </>
      )}
    </svg>
  );
}
