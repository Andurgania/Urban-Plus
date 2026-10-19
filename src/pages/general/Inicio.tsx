import type { ReactNode } from 'react';
import { useDB, useSesion } from '../../lib/store';
import { Aviso, EstadoPedidoTag, Kpi, Panel, Tabla, Etiqueta } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { Barras } from '../../components/Graficos';
import { navegar } from '../../lib/router';
import { addDays, claveMes, clp, dia, fecha, fechaLarga, haceTiempo, num, pct } from '../../lib/format';
import { alertaEgresos, clientesInactivos, estadoCampana, nombreCliente, stockTotal, totalesPartidas, ventasValidas, rangoDeMes, mapaCategorias } from '../../lib/logica';
import { NOMBRE_ROL } from '../../lib/permisos';
import type { DB } from '../../lib/types';

function Rapido({ icono, titulo, sub, to }: { icono: string; titulo: string; sub: string; to: string }) {
  return (
    <button className="acceso-rapido" onClick={() => navegar(to)}>
      <span className="ic"><Icono n={icono} size={18} /></span>
      <span>{titulo}<small>{sub}</small></span>
    </button>
  );
}

function ventasDias(db: DB, dias: number, filtro?: (v: DB['ventas'][number]) => boolean) {
  const out: { label: string; valor: number; detalle: string }[] = [];
  const vs = ventasValidas(db).filter((v) => !filtro || filtro(v));
  for (let i = dias - 1; i >= 0; i--) {
    const d = dia(addDays(new Date(), -i));
    const del = vs.filter((v) => dia(v.fecha) === d);
    const f = addDays(new Date(), -i);
    out.push({ label: `${f.getDate()}/${f.getMonth() + 1}`, valor: del.reduce((a, v) => a + v.total, 0), detalle: `${del.length} ventas` });
  }
  return out;
}

export function Inicio() {
  const db = useDB();
  const { usuario } = useSesion();
  const u = usuario!;
  const hoy = dia();
  const ventasHoy = ventasValidas(db).filter((v) => dia(v.fecha) === hoy);
  const mes = claveMes(hoy);
  const { desde, hasta } = rangoDeMes(mes);
  const tMes = totalesPartidas(db, desde, hasta);
  const pendientes = db.pedidos.filter((p) => p.estado === 'pendiente');
  const incidencias = db.pedidos.filter((p) => p.estado === 'incidencia');
  const atrasados = db.pedidos.filter((p) => p.estado !== 'entregado' && p.estimadoHasta < new Date().toISOString());
  const alertas = db.alertas.filter((a) => a.estado === 'activa');

  let kpis: ReactNode = null;
  let rapidos: ReactNode = null;
  let extra: ReactNode = null;

  if (u.rol === 'vendedor') {
    const mias = ventasHoy.filter((v) => v.vendedorId === u.id);
    kpis = (<>
      <Kpi label="Mis ventas de hoy" valor={num(mias.length)} detalle={clp(mias.reduce((a, v) => a + v.total, 0))} />
      <Kpi label="Ventas de la tienda hoy" valor={num(ventasHoy.length)} detalle={`${ventasHoy.filter((v) => v.origen === 'tienda_web').length} desde la tienda web`} />
      <Kpi label="Cotizaciones vigentes" valor={num(db.cotizaciones.filter((c) => c.estado === 'vigente' && addDays(c.fecha, c.vigenciaDias).toISOString() > new Date().toISOString()).length)} />
      <Kpi label="Productos sin stock" valor={num(db.productos.filter((p) => stockTotal(p) === 0).length)} tono="alerta" detalle="No se pueden vender" />
    </>);
    rapidos = (<>
      <Rapido icono="plus" titulo="Nueva venta" sub="Web o celular" to="/ventas/nueva" />
      <Rapido icono="quote" titulo="Cotizaciones" sub="Emitir o convertir" to="/ventas/cotizaciones" />
      <Rapido icono="cash" titulo="Cierre de caja" sub="Al terminar el turno" to="/ventas/caja" />
      <Rapido icono="users" titulo="Clientes" sub="Personas y empresas" to="/clientes" />
    </>);
  } else if (u.rol === 'bodega') {
    kpis = (<>
      <Kpi label="Pedidos por asignar" valor={num(pendientes.length)} tono={pendientes.length ? 'alerta' : undefined} />
      <Kpi label="En preparación" valor={num(db.pedidos.filter((p) => p.estado === 'preparacion').length)} />
      <Kpi label="Alertas de stock" valor={num(alertas.length)} tono={alertas.length ? 'peligro' : undefined} />
      <Kpi label="Órdenes de reposición por enviar" valor={num(db.reposiciones.filter((o) => o.estado === 'generada').length)} />
    </>);
    rapidos = (<>
      <Rapido icono="box" titulo="Asignar pedidos" sub="Por carga y zona" to="/despacho" />
      <Rapido icono="swap" titulo="Registrar movimiento" sub="Ingresos, salidas y ajustes" to="/inventario/movimientos" />
      <Rapido icono="bell" titulo="Alertas de stock" sub="Bajo el umbral" to="/inventario/alertas" />
      <Rapido icono="refresh" titulo="Reposición" sub="Órdenes a proveedores" to="/inventario/reposicion" />
    </>);
    extra = (
      <Panel titulo="Pedidos esperando repartidor" acciones={<button className="enlace" onClick={() => navegar('/despacho')}>Ver todos</button>} className="panel-plano">
        <Tabla clave={(p) => p.id} filas={pendientes.slice(0, 8)} vacio="No hay pedidos pendientes."
          onFila={(p) => navegar('/despacho/pedido/' + p.id)}
          columnas={[
            { titulo: 'Pedido', render: (p) => <strong>{p.nro}</strong> },
            { titulo: 'Cliente', render: (p) => nombreCliente(db, p.clienteId) },
            { titulo: 'Comuna', render: (p) => p.comuna },
            { titulo: 'Ingresó', render: (p) => haceTiempo(p.historial[0].fecha) },
          ]} />
      </Panel>
    );
  } else if (u.rol === 'area') {
    kpis = (<>
      <Kpi label="Ventas de hoy" valor={clp(ventasHoy.reduce((a, v) => a + v.total, 0))} detalle={`${ventasHoy.length} ventas`} />
      <Kpi label="Pedidos con incidencia" valor={num(incidencias.length)} tono={incidencias.length ? 'peligro' : undefined} />
      <Kpi label="Pedidos atrasados" valor={num(atrasados.length)} tono={atrasados.length ? 'alerta' : undefined} detalle="Pasaron la fecha estimada" />
      <Kpi label="Personal presente hoy" valor={num(db.asistencias.filter((a) => a.fecha === hoy).length)} />
    </>);
    rapidos = (<>
      <Rapido icono="box" titulo="Pedidos" sub="Reasignar e incidencias" to="/despacho" />
      <Rapido icono="megaphone" titulo="Campañas" sub="Descuentos por categoría" to="/comercial/campanas" />
      <Rapido icono="calendar" titulo="Turnos" sub="Asignar al personal" to="/personal/turnos" />
      <Rapido icono="report" titulo="Reporte del día" sub="Ventas y despachos" to="/ventas/reporte-diario" />
    </>);
  } else if (u.rol === 'ejecutivo') {
    kpis = (<>
      <Kpi label="Incidencias abiertas" valor={num(incidencias.length)} tono={incidencias.length ? 'peligro' : undefined} />
      <Kpi label="Pedidos atrasados" valor={num(atrasados.length)} tono={atrasados.length ? 'alerta' : undefined} />
      <Kpi label="Devoluciones este mes" valor={num(db.devoluciones.filter((d) => claveMes(d.fecha) === mes).length)} />
      <Kpi label="Pedidos en ruta" valor={num(db.pedidos.filter((p) => p.estado === 'en_ruta').length)} />
    </>);
    rapidos = (<>
      <Rapido icono="users" titulo="Buscar cliente" sub="Historial de pedidos" to="/clientes" />
      <Rapido icono="box" titulo="Pedidos" sub="Estado en tiempo real" to="/despacho" />
      <Rapido icono="undo" titulo="Devoluciones" sub="Nota de crédito o reembolso" to="/ventas/devoluciones" />
    </>);
    extra = (
      <Panel titulo="Pedidos con incidencia" className="panel-plano">
        <Tabla clave={(p) => p.id} filas={incidencias} vacio="Sin incidencias abiertas." onFila={(p) => navegar('/despacho/pedido/' + p.id)}
          columnas={[
            { titulo: 'Pedido', render: (p) => <strong>{p.nro}</strong> },
            { titulo: 'Cliente', render: (p) => nombreCliente(db, p.clienteId) },
            { titulo: 'Problema', render: (p) => p.incidencias.filter((i) => !i.resuelta).map((i) => i.comentario).join(' · ') },
            { titulo: 'Estado', render: (p) => <EstadoPedidoTag e={p.estado} /> },
          ]} />
      </Panel>
    );
  } else if (u.rol === 'contador') {
    const al = alertaEgresos(db, mes);
    kpis = (<>
      <Kpi label="Ingresos del mes" valor={clp(tMes.ingresos)} />
      <Kpi label="Egresos del mes" valor={clp(tMes.egresos)} tono={al.supera ? 'peligro' : undefined} detalle={`${pct(al.pctEgresos)} de los ingresos`} />
      <Kpi label="Margen operacional" valor={clp(tMes.margen)} detalle={pct(tMes.margenPct, 1)} tono={tMes.margen < 0 ? 'peligro' : 'bien'} />
      <Kpi label="Partidas sin conciliar" valor={num(db.partidas.filter((p) => !p.conciliada).length)} />
    </>);
    rapidos = (<>
      <Rapido icono="ledger" titulo="Ingresos y egresos" sub="Registrar y anotar" to="/finanzas/partidas" />
      <Rapido icono="bank" titulo="Conciliación" sub="Contra la cartola" to="/finanzas/conciliacion" />
      <Rapido icono="report" titulo="Reportes" sub="PDF y Excel" to="/finanzas/reportes" />
    </>);
  } else if (u.rol === 'gerente') {
    const mesAnt = claveMes(dia(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)));
    const ventasMes = ventasValidas(db).filter((v) => claveMes(v.fecha) === mes);
    const diaN = new Date().getDate();
    const ventasMesAntMismoDia = ventasValidas(db).filter((v) => claveMes(v.fecha) === mesAnt && new Date(v.fecha).getDate() <= diaN);
    const a = ventasMes.reduce((x, v) => x + v.total, 0), b = ventasMesAntMismoDia.reduce((x, v) => x + v.total, 0);
    const cats = mapaCategorias(db);
    const premium = Object.values(cats).filter((c) => c.categoria === 'Premium' || c.categoria === 'Diamante').length;
    const pendCamp = db.campanas.filter((c) => estadoCampana(c) === 'pendiente');
    kpis = (<>
      <Kpi label="Ventas del mes" valor={clp(a)} detalle={b ? `${a >= b ? '+' : ''}${pct(((a - b) / b) * 100)} vs. mismo período del mes pasado` : undefined} tono={a >= b ? 'bien' : 'alerta'} />
      <Kpi label="Margen operacional del mes" valor={pct(tMes.margenPct, 1)} detalle={clp(tMes.margen)} />
      <Kpi label="Clientes Diamante y Premium" valor={num(premium)} detalle={`de ${db.clientes.length} clientes`} />
      <Kpi label="Clientes inactivos" valor={num(clientesInactivos(db).length)} detalle={`Sin compras en ${db.config.diasClienteInactivo} días`} tono="alerta" />
    </>);
    rapidos = (<>
      <Rapido icono="chart" titulo="Panel de clientes" sub="Categorías por mes" to="/comercial/panel" />
      <Rapido icono="trophy" titulo="Más vendidos" sub="Ranking mensual" to="/comercial/productos" />
      <Rapido icono="compare" titulo="Comparar períodos" sub="Resultados financieros" to="/finanzas/comparar" />
      <Rapido icono="users" titulo="Carga por área" sub="Trabajo asignado" to="/personal/carga" />
    </>);
    extra = pendCamp.length ? (
      <Aviso tipo="alerta">
        <strong>Tienes {pendCamp.length} campaña{pendCamp.length > 1 ? 's' : ''} esperando tu aprobación:</strong> {pendCamp.map((c) => c.nombre).join(', ')}.{' '}
        <button className="enlace" style={{ background: 'none', border: 0, padding: 0 }} onClick={() => navegar('/comercial/campanas')}>Revisar</button>
      </Aviso>
    ) : null;
  } else if (u.rol === 'ti') {
    const internos = db.usuarios.filter((x) => x.rol !== 'cliente');
    const denegados = db.logs.filter((l) => l.tipo === 'acceso_denegado' && l.fecha > addDays(new Date(), -7).toISOString());
    kpis = (<>
      <Kpi label="Cuentas activas" valor={num(internos.filter((x) => x.activo && !x.bloqueado).length)} detalle={`de ${internos.length} cuentas internas`} />
      <Kpi label="Cuentas bloqueadas" valor={num(internos.filter((x) => x.bloqueado).length)} tono={internos.some((x) => x.bloqueado) ? 'alerta' : undefined} />
      <Kpi label="Solicitudes de clave" valor={num(db.solicitudes.filter((s) => s.estado === 'pendiente').length)} detalle="Pendientes de aprobar" />
      <Kpi label="Accesos denegados (7 días)" valor={num(denegados.length)} tono={denegados.length ? 'peligro' : undefined} />
    </>);
    rapidos = (<>
      <Rapido icono="users" titulo="Empleados" sub="Roles y accesos" to="/personal/empleados" />
      <Rapido icono="key" titulo="Solicitudes de clave" sub="Aprobar o rechazar" to="/personal/claves" />
      <Rapido icono="log" titulo="Log de auditoría" sub="Quién hizo qué" to="/personal/auditoria" />
      <Rapido icono="pulse" titulo="Diagnóstico" sub="Estado de servicios" to="/personal/diagnostico" />
    </>);
  }

  const muestraGrafico = ['vendedor', 'area', 'gerente', 'contador'].includes(u.rol);

  return (
    <div>
      <div className="saludo">
        <h1>Hola, {u.nombre.split(' ')[0]}</h1>
        <p>{fechaLarga(new Date().toISOString())} · {NOMBRE_ROL[u.rol]}</p>
      </div>
      {extra && u.rol === 'gerente' && <div style={{ marginBottom: 16 }}>{extra}</div>}
      <div className="kpis">{kpis}</div>
      {rapidos && (
        <Panel titulo="Accesos directos" className="mt">
          <div className="accesos-rapidos">{rapidos}</div>
        </Panel>
      )}
      {muestraGrafico && (
        <Panel titulo="Ventas de los últimos 14 días">
          <Barras etiqueta="Ventas diarias de los últimos 14 días" datos={ventasDias(db, 14)} formatoTip={clp} />
        </Panel>
      )}
      {extra && u.rol !== 'gerente' && <div className="mt">{extra}</div>}
      {u.rol === 'area' && incidencias.length > 0 && (
        <Panel titulo="Pedidos con incidencia" className="panel-plano">
          <Tabla clave={(p) => p.id} filas={incidencias} onFila={(p) => navegar('/despacho/pedido/' + p.id)}
            columnas={[
              { titulo: 'Pedido', render: (p) => <strong>{p.nro}</strong> },
              { titulo: 'Cliente', render: (p) => nombreCliente(db, p.clienteId) },
              { titulo: 'Problema', render: (p) => p.incidencias.filter((i) => !i.resuelta).map((i) => i.comentario).join(' · ') },
              { titulo: 'Desde', render: (p) => fecha(p.incidencias[p.incidencias.length - 1]?.fecha) },
              { titulo: '', render: () => <Etiqueta tono="peligro">Reasignar o resolver</Etiqueta> },
            ]} />
        </Panel>
      )}
    </div>
  );
}
