// Mapa de requisitos: dónde se ve cada requisito del informe y con qué usuario mostrarlo en la presentación
import { Fragment, useState } from 'react';
import { Boton, Buscador, toast } from '../../components/ui';
import { BannerDemo } from '../../layouts/AppShell';
import { getDB, login, logout, useSesion } from '../../lib/store';
import { navegar } from '../../lib/router';
import { CLAVE_DEMO } from '../../lib/seed';
import { NOMBRE_ROL } from '../../lib/permisos';

type Fila = [id: string, texto: string, usuario: string | null, ruta: string, nota?: string];

const GRUPOS: { titulo: string; filas: Fila[] }[] = [
  { titulo: 'Seguimiento y despacho (OE1)', filas: [
    ['RF01', 'Calcular el costo de envío según la zona y la tabla de tarifas', 'crojas', '/ventas/nueva', 'Elige un cliente y agrega productos'],
    ['RF01-B', 'No cobrar el envío sobre el monto mínimo configurado', 'amunoz', '/despacho/zonas'],
    ['RF02', 'Mostrar en tiempo real el estado del pedido', 'jmorales', '/tienda/compras', 'Abre otra pestaña como repartidor y cambia el estado'],
    ['RF03', 'El repartidor actualiza el estado desde el celular, sin panel administrativo', 'lcarrasco', '/repartidor'],
    ['RF04', 'Confirmar la entrega con fecha, hora y foto o firma opcional', 'lcarrasco', '/repartidor', 'Pestaña En ruta → Entregado'],
    ['RF05', 'Notificar al cliente cuando sale el pedido o hay una incidencia', 'jmorales', '/tienda', 'Campana de notificaciones'],
    ['RF06', 'Registrar incidencias de despacho', 'lcarrasco', '/repartidor', 'Botón Problema'],
    ['RF07', 'Estimar un rango de fecha de entrega', 'msoto', '/despacho', 'También al pagar en la tienda'],
    ['RF08', 'Asignar pedidos por carga de trabajo y zona', 'msoto', '/despacho', 'Pestaña Por asignar → Asignar'],
    ['RF09', 'Reasignar un pedido a otro repartidor', 'amunoz', '/despacho'],
    ['RF10', 'Historial de pedidos por cliente con filtros', 'vdiaz', '/clientes', 'Abre un cliente'],
    ['RF11', 'Reporte diario de despacho por repartidor y zona', 'amunoz', '/despacho/reporte'],
    ['RF12', 'Consultar el pedido con el número de orden, sin iniciar sesión', null, '/seguimiento'],
  ] },
  { titulo: 'Ventas y pagos (OE2)', filas: [
    ['RF13', 'Registrar ventas desde web y móvil', 'crojas', '/ventas/nueva'],
    ['RF14', 'Tarjeta, transferencia y efectivo', 'crojas', '/ventas/nueva'],
    ['RF15', 'Cada transacción con fecha, hora, monto, medio y responsable', 'crojas', '/ventas'],
    ['RF16', 'Boleta digital al confirmar la venta', 'jmorales', '/tienda/compras', 'Botón Boleta'],
    ['RF17', 'Anular solo con autorización de un administrador y con motivo', 'amunoz', '/ventas', 'Abre una venta de hoy'],
    ['RF18', 'Alerta al vender con stock insuficiente', 'crojas', '/ventas/nueva'],
    ['RF19', 'Aplicar descuentos o promociones autorizadas', 'amunoz', '/ventas/promociones'],
    ['RF20', 'El cliente revisa su historial de compras', 'jmorales', '/tienda/compras'],
    ['RF21', 'Calcular el vuelto en efectivo', 'crojas', '/ventas/nueva'],
    ['RF22', 'Devoluciones con nota de crédito o reembolso', 'vdiaz', '/ventas/devoluciones'],
    ['RF23', 'Cierre de caja al terminar el turno', 'crojas', '/ventas/caja'],
    ['RF24', 'Cotizaciones con vigencia configurable', 'crojas', '/ventas/cotizaciones'],
  ] },
  { titulo: 'Inteligencia comercial (OE3)', filas: [
    ['RF25', 'Segmentar clientes por frecuencia y monto', 'plagos', '/comercial/segmentacion'],
    ['RF26', 'Campañas por categoría: Bronce, Plata, Diamante y Premium', 'amunoz', '/comercial/campanas'],
    ['RF27', 'Ejecutar las campañas solas durante su vigencia', 'jmorales', '/tienda', 'El descuento ya aparece aplicado'],
    ['RF28', 'Reporte de efectividad al terminar la campaña', 'amunoz', '/comercial/campanas/cp2'],
    ['RF29', 'Productos más vendidos por período y línea', 'plagos', '/comercial/productos'],
    ['RF30', 'Detectar clientes inactivos y activar reactivación', 'amunoz', '/comercial/inactivos'],
    ['RF31', 'Ranking mensual de los 10 más vendidos por línea', 'plagos', '/comercial/productos', 'Pestaña Ranking mensual'],
    ['RF32', 'Panel con la distribución y evolución de categorías', 'plagos', '/comercial/panel'],
    ['RF33', 'Exportar segmentación y campañas a Excel', 'amunoz', '/comercial/segmentacion'],
  ] },
  { titulo: 'Personal y accesos (OE4)', filas: [
    ['RF34', 'Registrar empleados con rol, área y nivel de acceso', 'faraya', '/personal/empleados'],
    ['RF35', 'Restringir cada módulo según el rol', 'faraya', '/personal/permisos', 'Prueba entrar a #/finanzas como vendedor'],
    ['RF36', 'Registrar entrada y salida de cada empleado', 'amunoz', '/personal/asistencia', 'Botón Marcar entrada arriba'],
    ['RF37', 'Definir y asignar turnos', 'amunoz', '/personal/turnos'],
    ['RF38', 'Log de auditoría de cada acción', 'faraya', '/personal/auditoria'],
    ['RF39', 'Registrar las secciones visitadas', 'faraya', '/personal/auditoria', 'Filtra por tipo Navegación'],
    ['RF40', 'Restablecer claves con aprobación del administrador TI', 'faraya', '/personal/claves'],
    ['RF41', 'Reporte de asistencia y actividad por período', 'amunoz', '/personal/asistencia'],
    ['RF42', 'Panel de carga de trabajo por área', 'plagos', '/personal/carga'],
    ['RF43', 'Bloquear cuentas inactivas por más de 30 días', 'faraya', '/personal/empleados', 'Tomás Reyes aparece bloqueado'],
  ] },
  { titulo: 'Inventario (OE5)', filas: [
    ['RF44', 'Ingresos y salidas en tiempo real con responsable', 'msoto', '/inventario/movimientos'],
    ['RF45', 'Alerta automática bajo el umbral mínimo', 'msoto', '/inventario/alertas'],
    ['RF46', 'Configurar el umbral de cada producto', 'msoto', '/inventario', 'Editar un producto'],
    ['RF47', 'Reporte de inventario en PDF y Excel', 'msoto', '/inventario/reporte'],
    ['RF48', 'Proveedor de cada producto con su contacto', 'msoto', '/inventario/proveedores'],
    ['RF49', 'Ajustes por mermas y devoluciones con justificación', 'msoto', '/inventario/movimientos'],
    ['RF50', 'Historial de movimientos por código o nombre', 'msoto', '/inventario/movimientos'],
    ['RF51', 'Bloquear la venta de productos con stock cero', 'crojas', '/ventas/nueva', 'Prueba con el Blazer cruzado'],
    ['RF52', 'Varias ubicaciones de bodega', 'msoto', '/inventario/ubicaciones'],
    ['RF53', 'Orden de reposición automática en el umbral crítico', 'msoto', '/inventario/reposicion'],
  ] },
  { titulo: 'Finanzas (OE6)', filas: [
    ['RF54', 'Registrar ingresos y egresos', 'jpizarro', '/finanzas/partidas'],
    ['RF55', 'Margen operacional diario, semanal o mensual', 'jpizarro', '/finanzas'],
    ['RF56', 'Reportes financieros en PDF y Excel', 'jpizarro', '/finanzas/reportes'],
    ['RF57', 'Los reportes no se eliminan, solo se archivan', 'jpizarro', '/finanzas/reportes'],
    ['RF58', 'Clasificar egresos por categoría', 'jpizarro', '/finanzas/partidas'],
    ['RF59', 'Resumen financiero automático al cierre de cada mes', 'jpizarro', '/finanzas/reportes'],
    ['RF60', 'Comparar dos períodos', 'plagos', '/finanzas/comparar'],
    ['RF61', 'Alerta cuando los egresos superan el umbral', 'plagos', '/finanzas'],
    ['RF62', 'Notas del auditor en las partidas', 'jpizarro', '/finanzas/partidas', 'Botón Anotar'],
    ['RF63', 'Cada venta entra sola como ingreso', 'jpizarro', '/finanzas/partidas'],
    ['RF64', 'Conciliación manual con el banco', 'jpizarro', '/finanzas/conciliacion'],
    ['RF65', 'Rentabilidad por línea o producto', 'plagos', '/finanzas/rentabilidad'],
    ['RF66', 'Consolidados trimestrales y semestrales', 'jpizarro', '/finanzas/reportes', 'Pestaña Consolidados'],
    ['RF67', 'Reporte diario de ventas con productos y montos', 'amunoz', '/ventas/reporte-diario'],
  ] },
  { titulo: 'Pedidos del caso de negocio', filas: [
    ['Caso', 'Clientes personas naturales y empresas', 'crojas', '/clientes'],
    ['Caso', 'Sugerir productos según el comportamiento de compra', 'jmorales', '/tienda', 'Sección Elegidos para ti'],
    ['Caso', 'Compras desde el sitio web', 'jmorales', '/tienda'],
  ] },
  { titulo: 'Requisitos no funcionales que se pueden mostrar', filas: [
    ['RNF01', 'Claves guardadas con hash, nunca en texto plano', 'faraya', '/personal/diagnostico'],
    ['RNF02', 'Bloqueo tras 5 intentos fallidos', null, '/login', 'Equivoca la clave 5 veces'],
    ['RNF04', 'Cierre de sesión tras 15 minutos sin actividad', null, '/login'],
    ['RNF05', 'Datos financieros solo para contador, auditor y gerente', 'crojas', '/finanzas'],
    ['RNF07', 'Funciona en celulares Android e iOS', 'lcarrasco', '/repartidor', 'Achica la ventana del navegador'],
    ['RNF08', 'Español, fechas y pesos chilenos', 'jpizarro', '/finanzas'],
    ['RNF18', 'Acciones sobre datos críticos en el log', 'faraya', '/personal/auditoria'],
    ['RNF23', 'Anonimizar los datos de un cliente a solicitud', 'vdiaz', '/clientes'],
    ['RNF24', 'Respaldo diario de la base de datos', 'faraya', '/personal/diagnostico'],
    ['RNF29', 'Confirmación antes de acciones irreversibles', 'amunoz', '/ventas'],
    ['RNF31', 'Stock en pantalla actualizado sin recargar', 'msoto', '/inventario'],
    ['RNF35', 'Panel de diagnóstico solo para TI', 'faraya', '/personal/diagnostico'],
    ['RNF36', 'Validación de datos (RUT, correo, montos)', 'crojas', '/clientes'],
  ] },
];

export function Requisitos() {
  const [q, setQ] = useState('');
  const { usuario } = useSesion();
  const ver = (u: string | null, ruta: string) => {
    if (!u) {
      if (usuario && ruta === '/login') logout('Cambio de usuario');
      navegar(ruta);
      return;
    }
    if (usuario?.usuario !== u) {
      if (usuario) logout('Cambio de usuario');
      const r = login(u, CLAVE_DEMO);
      if (!r.ok) { toast(r.error, 'peligro'); return; }
    }
    navegar(ruta);
  };
  const total = GRUPOS.reduce((a, g) => a + g.filas.filter((f) => f[0].startsWith('RF')).length, 0);
  const filtra = (f: Fila) => !q || `${f[0]} ${f[1]}`.toLowerCase().includes(q.toLowerCase());
  return (
    <div className="tienda">
      <BannerDemo />
      <header className="tienda-head">
        <div className="tienda-head-in">
          <a className="wordmark" href="#/login" onClick={(e) => { e.preventDefault(); navegar('/login'); }}>urbano<span>.</span></a>
          <div style={{ flex: 1 }} />
          <Boton chico onClick={() => navegar('/login')}>Volver al inicio de sesión</Boton>
        </div>
      </header>
      <main className="tienda-main" style={{ maxWidth: 1080 }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }}>Mapa de requisitos</h1>
        <p className="texto-2" style={{ margin: '8px 0 18px', maxWidth: '70ch' }}>
          Los {total} requisitos funcionales del informe, más lo que pide el caso y los no funcionales que se pueden ver en pantalla. El botón <strong>Ver</strong> entra con el usuario indicado y abre la pantalla donde se cumple.
        </p>
        <div style={{ marginBottom: 18, maxWidth: 360 }}><Buscador valor={q} onChange={setQ} placeholder="Buscar RF o palabra" /></div>
        <div className="panel panel-plano">
          <div className="tabla-wrap">
            <table className="tabla">
              <thead><tr><th style={{ width: 80 }}>ID</th><th>Requisito</th><th>Mostrar con</th><th></th></tr></thead>
              <tbody>
                {GRUPOS.map((g) => {
                  const fs = g.filas.filter(filtra);
                  if (!fs.length) return null;
                  return (
                    <Fragment key={g.titulo}>
                      <tr><td colSpan={4} style={{ background: 'var(--surface-2)', fontWeight: 700 }}>{g.titulo}</td></tr>
                      {fs.map((f, i) => {
                        const u = f[2] ? getDB().usuarios.find((x) => x.usuario === f[2]) : null;
                        return (
                          <tr key={g.titulo + i}>
                            <td><span className="rf" style={{ marginLeft: 0 }}>{f[0]}</span></td>
                            <td>{f[1]}{f[4] && <span className="celda-sub">{f[4]}</span>}</td>
                            <td className="chico">{u ? <>{u.nombre}<span className="celda-sub">{NOMBRE_ROL[u.rol]}</span></> : 'Sin iniciar sesión'}</td>
                            <td className="al-der"><Boton chico onClick={() => ver(f[2], f[3])}>Ver</Boton></td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
