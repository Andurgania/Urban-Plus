import { useState } from 'react';
import { Boton, Campo, Definiciones, Input, Pagina, Panel, Tabla, resultado } from '../../components/ui';
import { Icono } from '../../components/Icono';
import { cambiarMiClave, intentar, useDB, useSesion } from '../../lib/store';
import { fecha, fechaHora, hora } from '../../lib/format';
import { inicioDeRol, NOMBRE_ROL } from '../../lib/permisos';
import { navegar } from '../../lib/router';

export function Cuenta() {
  const db = useDB();
  const { usuario } = useSesion();
  const u = usuario!;
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const mias = db.asistencias.filter((a) => a.usuarioId === u.id).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);
  const turnoHoy = db.asignaciones.find((a) => a.usuarioId === u.id && a.dia === (new Date().getDay() + 6) % 7);
  return (
    <Pagina titulo="Mi cuenta" descripcion="Tus datos, tu clave y tu registro de asistencia.">
      <div className="grid-2">
        <Panel titulo="Datos">
          <Definiciones items={[
            ['Nombre', u.nombre], ['RUT', u.rut], ['Usuario', u.usuario], ['Correo', u.email], ['Rol', NOMBRE_ROL[u.rol]], ['Área', u.area],
            ['Nivel de acceso', u.nivelAcceso], ['Turno de hoy', db.turnos.find((t) => t.id === turnoHoy?.turnoId)?.nombre ?? 'Libre'],
          ]} />
        </Panel>
        <Panel titulo="Cambiar clave">
          <form className="pila" style={{ gap: 12 }} onSubmit={(e) => {
            e.preventDefault();
            if (resultado(intentar(() => cambiarMiClave(actual, nueva)), 'Clave actualizada')) { setActual(''); setNueva(''); }
          }}>
            <Campo label="Clave actual"><Input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></Campo>
            <Campo label="Nueva clave" ayuda="Mínimo 8 caracteres. Se guarda cifrada (RNF01)."><Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" /></Campo>
            <div><Boton variante="primario" type="submit">Guardar clave</Boton></div>
          </form>
        </Panel>
      </div>
      {u.rol !== 'repartidor' && (
        <Panel titulo="Mi asistencia reciente" className="panel-plano mt">
          <Tabla clave={(a) => a.id} filas={mias} vacio="Aún no registras asistencia. Usa el botón Marcar entrada de la barra superior."
            columnas={[
              { titulo: 'Fecha', render: (a) => fecha(a.fecha) },
              { titulo: 'Entrada', render: (a) => hora(a.entrada) },
              { titulo: 'Salida', render: (a) => (a.salida ? hora(a.salida) : '—') },
            ]} />
        </Panel>
      )}
      <p className="texto-3 chico mt">Último acceso: {fechaHora(u.ultimoAcceso)}</p>
    </Pagina>
  );
}

export function AccesoDenegado({ clienteSolo }: { clienteSolo?: boolean }) {
  const { usuario } = useSesion();
  return (
    <div className="denegado">
      <span className="candado"><Icono n="lock" size={28} /></span>
      <h1>No tienes acceso a esta sección</h1>
      <p>
        {clienteSolo
          ? 'Esta parte de la tienda es para clientes. Entra con una cuenta de cliente para comprar.'
          : `Tu rol (${usuario ? NOMBRE_ROL[usuario.rol] : ''}) no tiene permiso para ver este módulo. El intento quedó registrado en el log de auditoría (RF35).`}
      </p>
      <Boton variante="primario" onClick={() => navegar(usuario ? inicioDeRol(usuario.rol) : '/login')}>Volver al inicio</Boton>
    </div>
  );
}

export function NoEncontrado() {
  return (
    <div className="denegado">
      <span className="candado" style={{ background: 'var(--marca-suave)', color: 'var(--marca)' }}><Icono n="search" size={28} /></span>
      <h1>No encontramos esta página</h1>
      <p>Puede que el enlace esté mal escrito o que el registro ya no exista.</p>
      <Boton variante="primario" onClick={() => navegar('/')}>Ir al inicio</Boton>
    </div>
  );
}
