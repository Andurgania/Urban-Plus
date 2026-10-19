import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as PE } from 'react';
import { Aviso, Boton, Campo, EstadoPedidoTag, Input, Interruptor, Modal, Pestanas, RF, Select, Textarea, Vacio, resultado } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { cambiarDisponibilidad, confirmarEntrega, intentar, NOMBRE_INCIDENCIA, registrarIncidencia, salirARuta, useDB, useSesion } from '../../lib/store';
import { dia, fecha, hora } from '../../lib/format';
import { nombreCliente } from '../../lib/logica';
import type { Pedido, TipoIncidencia } from '../../lib/types';

function Firma({ onCambio }: { onCambio: (data: string | undefined) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const trazos = useRef(0);
  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2;
    c.height = r.height * 2;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#221a2e';
  }, []);
  const pos = (e: PE) => {
    const r = ref.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  return (
    <div>
      <canvas ref={ref} className="firma" aria-label="Área para firmar"
        onPointerDown={(e) => { dibujando.current = true; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); ref.current!.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!dibujando.current) return; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); trazos.current++; }}
        onPointerUp={() => { dibujando.current = false; if (trazos.current > 5) onCambio(ref.current!.toDataURL('image/png')); }} />
      <button type="button" className="btn btn-fantasma btn-chico mt-chico" onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); trazos.current = 0; onCambio(undefined); }}>Borrar firma</button>
    </div>
  );
}

function reducirImagen(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const max = 640;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

export function Repartidor() {
  const db = useDB();
  const { usuario } = useSesion();
  const yo = usuario!;
  const [tab, setTab] = useState<'salir' | 'ruta' | 'incidencia' | 'hechos'>('salir');
  const [entrega, setEntrega] = useState<Pedido | null>(null);
  const [incid, setIncid] = useState<Pedido | null>(null);
  const [receptor, setReceptor] = useState('');
  const [tipoEv, setTipoEv] = useState<'ninguna' | 'firma' | 'foto'>('ninguna');
  const [evData, setEvData] = useState<string | undefined>();
  const [tipoInc, setTipoInc] = useState<TipoIncidencia>('ausente');
  const [coment, setComent] = useState('');
  const mios = db.pedidos.filter((p) => p.repartidorId === yo.id);
  const listas = {
    salir: mios.filter((p) => p.estado === 'preparacion'),
    ruta: mios.filter((p) => p.estado === 'en_ruta'),
    incidencia: mios.filter((p) => p.estado === 'incidencia'),
    hechos: mios.filter((p) => p.estado === 'entregado' && p.entrega && dia(p.entrega.fecha) === dia()),
  };
  const lista = listas[tab];

  return (
    <div className="movil">
      <div className="flex-entre" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Mis entregas</h1>
          <p className="texto-2 chico">{yo.empresaReparto} · {fecha(new Date().toISOString())} <RF ids="RF03 · RF04 · RF06" /></p>
        </div>
        <Interruptor activo={yo.disponible !== false} onChange={(v) => cambiarDisponibilidad(yo.id, v)} label={yo.disponible !== false ? 'Disponible' : 'No disponible'} />
      </div>
      <Pestanas valor={tab} onChange={setTab} opciones={[
        { id: 'salir', label: `Por salir (${listas.salir.length})` }, { id: 'ruta', label: `En ruta (${listas.ruta.length})` },
        { id: 'incidencia', label: `Problemas (${listas.incidencia.length})` }, { id: 'hechos', label: `Entregados hoy (${listas.hechos.length})` },
      ]} />
      {!lista.length && <Vacio icono="truck" titulo={tab === 'salir' ? 'No tienes pedidos por retirar' : tab === 'ruta' ? 'No tienes pedidos en ruta' : tab === 'incidencia' ? 'Sin problemas reportados' : 'Aún no entregas pedidos hoy'} texto={tab === 'salir' ? 'Cuando bodega te asigne un pedido aparecerá aquí.' : undefined} />}
      {lista.map((p) => {
        const v = db.ventas.find((x) => x.id === p.ventaId);
        const c = db.clientes.find((x) => x.id === p.clienteId);
        return (
          <article key={p.id} className="tarjeta-entrega">
            <header><h3>{p.nro}</h3><EstadoPedidoTag e={p.estado} /></header>
            <div>
              <strong>{nombreCliente(db, p.clienteId)}</strong>
              <p className="texto-2"><Icono n="pin" size={14} /> {p.direccion}, {p.comuna}</p>
              {c && <p className="texto-2"><Icono n="phone" size={14} /> <a href={`tel:${c.telefono.replace(/\s/g, '')}`}>{c.telefono}</a></p>}
              <p className="chico texto-3">{v?.items.reduce((a, i) => a + i.cantidad, 0)} prendas · entregar antes del {fecha(p.estimadoHasta)}</p>
            </div>
            {p.incidencias.filter((i) => !i.resuelta).map((i) => <Aviso key={i.id} tipo="alerta">{NOMBRE_INCIDENCIA[i.tipo]}: {i.comentario}</Aviso>)}
            {p.entrega && <Aviso tipo="bien">Entregado a las {hora(p.entrega.fecha)} · recibió {p.entrega.receptor}</Aviso>}
            {p.estado === 'preparacion' && (
              <div className="acciones">
                <Boton variante="primario" icono="truck" onClick={() => resultado(intentar(() => salirARuta(p.id)), `Pedido ${p.nro} en ruta. Se avisó a la clienta.`)}>Salir a ruta</Boton>
                <Boton icono="alert" onClick={() => setIncid(p)}>Problema</Boton>
              </div>
            )}
            {p.estado === 'en_ruta' && (
              <div className="acciones">
                <Boton variante="exito" icono="check" onClick={() => { setEntrega(p); setReceptor(''); setTipoEv('ninguna'); setEvData(undefined); }}>Entregado</Boton>
                <Boton icono="alert" onClick={() => setIncid(p)}>Problema</Boton>
              </div>
            )}
            {p.estado === 'incidencia' && (
              <div className="acciones">
                <Boton variante="primario" icono="truck" onClick={() => resultado(intentar(() => salirARuta(p.id)), 'Nuevo intento de entrega en curso')}>Reintentar</Boton>
              </div>
            )}
          </article>
        );
      })}
      <p className="chico texto-3 mt">Esta vista no tiene acceso al panel administrativo (RF03, HU04-B).</p>

      <Modal titulo={`Confirmar entrega ${entrega?.nro ?? ''}`} abierto={!!entrega} onCerrar={() => setEntrega(null)}
        pie={<><Boton variante="fantasma" onClick={() => setEntrega(null)}>Cancelar</Boton><Boton variante="exito" onClick={() => {
          if (!entrega) return;
          const ev = tipoEv === 'ninguna' ? undefined : tipoEv;
          if (resultado(intentar(() => confirmarEntrega(entrega.id, receptor, ev && evData ? ev : undefined, ev ? evData : undefined)), 'Entrega confirmada. Quedó registrada la fecha y hora.')) setEntrega(null);
        }}>Confirmar entrega</Boton></>}>
        <div className="pila" style={{ gap: 12 }}>
          <Campo label="¿Quién recibe?"><Input value={receptor} onChange={(e) => setReceptor(e.target.value)} placeholder="Nombre de quien recibe" /></Campo>
          <Campo label="Evidencia (opcional)">
            <Select value={tipoEv} onChange={(e) => { setTipoEv(e.target.value as typeof tipoEv); setEvData(undefined); }}>
              <option value="ninguna">Sin evidencia</option><option value="firma">Firma digital</option><option value="foto">Foto</option>
            </Select>
          </Campo>
          {tipoEv === 'firma' && <Firma onCambio={setEvData} />}
          {tipoEv === 'foto' && (
            <div>
              <input type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setEvData(await reducirImagen(f)); }} />
              {evData && <img src={evData} alt="Vista previa" style={{ width: '100%', marginTop: 10, borderRadius: 8 }} />}
            </div>
          )}
          <p className="chico texto-3">La fecha y hora se guardan automáticamente al confirmar.</p>
        </div>
      </Modal>

      <Modal titulo={`Problema con ${incid?.nro ?? ''}`} abierto={!!incid} onCerrar={() => setIncid(null)} ancho="chico"
        pie={<><Boton variante="fantasma" onClick={() => setIncid(null)}>Cancelar</Boton><Boton variante="peligro" onClick={() => {
          if (incid && resultado(intentar(() => registrarIncidencia(incid.id, tipoInc, coment)), 'Incidencia registrada. Atención al cliente ya fue avisada.')) { setIncid(null); setComent(''); }
        }}>Registrar</Boton></>}>
        <div className="pila" style={{ gap: 12 }}>
          <Campo label="¿Qué pasó?">
            <Select value={tipoInc} onChange={(e) => setTipoInc(e.target.value as TipoIncidencia)}>
              {(Object.keys(NOMBRE_INCIDENCIA) as TipoIncidencia[]).map((k) => <option key={k} value={k}>{NOMBRE_INCIDENCIA[k]}</option>)}
            </Select>
          </Campo>
          <Campo label="Comentario"><Textarea value={coment} onChange={(e) => setComent(e.target.value)} placeholder="ej. Toqué el timbre dos veces y dejé aviso" /></Campo>
        </div>
      </Modal>
    </div>
  );
}
