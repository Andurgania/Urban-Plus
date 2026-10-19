import { useState } from 'react';
import { Avatar, Aviso, Boton, Campo, Input, Modal, toast } from '../../components/ui';
import { Prenda } from '../../components/Prenda';
import { login, logout, solicitarCambioClave, useDB, useSesion } from '../../lib/store';
import { navegar, useRuta } from '../../lib/router';
import { inicioDeRol, NOMBRE_ROL, rutaPermitida } from '../../lib/permisos';
import { CLAVE_DEMO } from '../../lib/seed';

const ACCESOS = ['u_cli1', 'u_cli3', 'u_ven1', 'u_bod', 'u_rep1', 'u_area', 'u_eje', 'u_cont', 'u_ger', 'u_ti'];

export function Login() {
  const db = useDB();
  const { usuario: actual } = useSesion();
  const { query } = useRuta();
  const [id, setId] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [olvido, setOlvido] = useState(false);
  const [idOlvido, setIdOlvido] = useState('');

  const entrar = (identificador: string, pass: string) => {
    if (actual) logout('Cambio de usuario');
    const r = login(identificador, pass);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const volver = query.get('volver');
    const u = r.usuario;
    if (volver && ((u.rol === 'cliente' && volver.startsWith('/tienda')) || (u.rol !== 'cliente' && rutaPermitida(u.rol, volver)))) navegar(volver);
    else navegar(inicioDeRol(u.rol));
  };

  return (
    <div className="login">
      <section className="login-arte">
        <div>
          <div className="wordmark" style={{ color: '#fff' }}>urbano<span>.</span></div>
        </div>
        <div>
          <h1>Cada pedido, con nombre y estado.</h1>
          <p>Urban Plus reúne la tienda web, las ventas, la bodega, los despachos y las finanzas de Tiendas Urbano en un solo lugar.</p>
          <div className="login-perchero" aria-hidden>
            <Prenda linea="Blazers" color="#B9865A" />
            <Prenda linea="Parkas" color="#B7A3D4" />
            <Prenda linea="Trajes de baño" color="#EE7F6B" />
          </div>
        </div>
        <p className="login-pie">Prototipo · Ingeniería de Requisitos · Datos ficticios</p>
      </section>

      <section className="login-form">
        <h2>Iniciar sesión</h2>
        <p>Entra con tu usuario o correo. En la demo todas las cuentas usan la clave <strong>{CLAVE_DEMO}</strong>.</p>
        {query.get('expirada') && <Aviso tipo="alerta">Tu sesión se cerró por inactividad ({db.config.minutosSesion} minutos). Vuelve a ingresar.</Aviso>}
        {actual && !query.get('expirada') && <Aviso tipo="info">Tienes una sesión abierta como {actual.nombre}. Al ingresar con otra cuenta se cierra la actual.</Aviso>}
        <form onSubmit={(e) => { e.preventDefault(); setError(''); entrar(id, clave); }} style={{ marginTop: 14 }}>
          <Campo label="Usuario o correo">
            <Input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder="ej. crojas" required />
          </Campo>
          <Campo label="Clave">
            <Input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
          </Campo>
          {error && <Aviso tipo="peligro">{error}</Aviso>}
          <Boton variante="primario" type="submit">Ingresar</Boton>
          <div className="login-links">
            <button type="button" onClick={() => { setIdOlvido(id); setOlvido(true); }}>Olvidé mi clave</button>
            <span>
              <a href="#/tienda" onClick={(e) => { e.preventDefault(); navegar('/tienda'); }}>Ver la tienda</a>
              {' · '}
              <a href="#/seguimiento" onClick={(e) => { e.preventDefault(); navegar('/seguimiento'); }}>Seguir un pedido</a>
            </span>
          </div>
        </form>

        <div className="accesos">
          <h3>Accesos rápidos para la presentación</h3>
          <p>Entra directo con un usuario de cada rol para mostrar lo que ve cada uno. También puedes abrir el <a href="#/requisitos" onClick={(e) => { e.preventDefault(); navegar('/requisitos'); }}>mapa de requisitos</a> para ir directo a cada RF.</p>
          <div className="accesos-grid">
            {ACCESOS.map((uid) => {
              const u = db.usuarios.find((x) => x.id === uid);
              if (!u) return null;
              const sub = u.rol === 'cliente' ? (db.clientes.find((c) => c.id === u.clienteId)?.tipo === 'empresa' ? 'Cliente empresa' : 'Cliente persona') : NOMBRE_ROL[u.rol];
              return (
                <button key={uid} className="acceso" onClick={() => { setError(''); entrar(u.usuario, CLAVE_DEMO); }} disabled={u.bloqueado}>
                  <Avatar nombre={u.nombre} chico />
                  <div>
                    <strong>{u.nombre}</strong>
                    <small>{sub}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Modal titulo="Restablecer clave" abierto={olvido} onCerrar={() => setOlvido(false)} ancho="chico"
        pie={<>
          <Boton variante="fantasma" onClick={() => setOlvido(false)}>Cancelar</Boton>
          <Boton variante="primario" onClick={() => {
            const r = solicitarCambioClave(idOlvido);
            if (r.ok) { toast('Solicitud enviada. El administrador TI debe aprobarla.'); setOlvido(false); }
            else toast(r.error, 'peligro');
          }}>Enviar solicitud</Boton>
        </>}>
        <p className="texto-modal" style={{ marginBottom: 14 }}>Por seguridad, el cambio de clave lo aprueba el administrador TI (RF40). Cuando lo apruebe, te entregará una clave temporal.</p>
        <Campo label="Usuario o correo">
          <Input value={idOlvido} onChange={(e) => setIdOlvido(e.target.value)} />
        </Campo>
      </Modal>
    </div>
  );
}
