// Router mínimo basado en el hash de la URL (funciona en Vercel sin configuración extra)
import { useSyncExternalStore } from 'react';

function leer() {
  const h = window.location.hash.replace(/^#/, '');
  return h || '/';
}

function suscribir(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRuta() {
  const full = useSyncExternalStore(suscribir, leer, () => '/');
  const [path, query = ''] = full.split('?');
  return { path, query: new URLSearchParams(query) };
}

export function navegar(to: string, opts?: { replace?: boolean }) {
  const url = '#' + to;
  if (opts?.replace) {
    window.location.replace(url);
  } else {
    window.location.hash = to;
  }
  window.scrollTo({ top: 0 });
}

/** Compara un patrón como /tienda/producto/:id contra un path */
export function match(patron: string, path: string): Record<string, string> | null {
  const a = patron.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
