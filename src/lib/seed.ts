// Datos de ejemplo (ficticios) para la demo. Se generan relativos a la fecha actual,
// así la demo siempre muestra actividad reciente sin importar cuándo se presente.
import type {
  AlertaStock, Asistencia, AsignacionTurno, Campana, Categoria, CierreCaja, Cliente, Cotizacion, DB, Devolucion,
  EstadoPedido, ItemVenta, LineaProducto, LogEntry, MedioPago, MovBanco, Movimiento, Notificacion, OrdenReposicion,
  Partida, Pedido, Producto, Promocion, Proveedor, ReporteFinanciero, SolicitudClave, Turno, Ubicacion, Usuario, Venta, Zona,
} from './types';
import { addDays, claveMes, dia, hashClave, rutDesdeNumero } from './format';

export const CLAVE_DEMO = 'urbano123';
export const DB_VERSION = 4;

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crearSeed(): DB {
  const r = prng(20261019);
  const rint = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const hoy = new Date();
  const en = (diasAtras: number, h = rint(9, 21), m = rint(0, 59)) => {
    const d = addDays(hoy, -diasAtras);
    d.setHours(h, m, rint(0, 59), 0);
    return d;
  };
  let n = 0;
  const id = (p: string) => `${p}_${(++n).toString(36)}`;

  // ---------- Zonas ----------
  const zonas: Zona[] = [
    { id: 'z1', nombre: 'Santiago Centro', region: 'Metropolitana', comunas: ['Santiago', 'Providencia', 'Ñuñoa', 'Recoleta', 'Independencia', 'Estación Central'], tarifa: 2990, diasMin: 1, diasMax: 2, activa: true },
    { id: 'z2', nombre: 'Santiago Oriente', region: 'Metropolitana', comunas: ['Las Condes', 'Vitacura', 'Lo Barnechea', 'La Reina', 'Peñalolén', 'Macul'], tarifa: 3490, diasMin: 1, diasMax: 2, activa: true },
    { id: 'z3', nombre: 'Santiago Sur y Poniente', region: 'Metropolitana', comunas: ['Maipú', 'La Florida', 'Puente Alto', 'San Bernardo', 'Pudahuel', 'Quilicura', 'San Miguel'], tarifa: 3990, diasMin: 2, diasMax: 3, activa: true },
    { id: 'z4', nombre: 'Valparaíso', region: 'Valparaíso', comunas: ['Valparaíso', 'Viña del Mar', 'Quilpué', 'Villa Alemana', 'Concón'], tarifa: 4990, diasMin: 2, diasMax: 4, activa: true },
    { id: 'z5', nombre: 'Zona centro sur', region: "O'Higgins, Maule, Ñuble y Biobío", comunas: ['Rancagua', 'Talca', 'Chillán', 'Concepción', 'Talcahuano'], tarifa: 5990, diasMin: 3, diasMax: 5, activa: true },
    { id: 'z6', nombre: 'Zona norte', region: 'Coquimbo, Antofagasta y Tarapacá', comunas: ['La Serena', 'Coquimbo', 'Antofagasta', 'Iquique', 'Calama'], tarifa: 6990, diasMin: 4, diasMax: 6, activa: true },
    { id: 'z7', nombre: 'Zona sur', region: 'Araucanía, Los Ríos y Los Lagos', comunas: ['Temuco', 'Valdivia', 'Osorno', 'Puerto Montt'], tarifa: 6990, diasMin: 4, diasMax: 6, activa: true },
  ];

  const ubicaciones: Ubicacion[] = [
    { id: 'u1', nombre: 'Pasillo A', descripcion: 'Bodega central · temporada actual' },
    { id: 'u2', nombre: 'Pasillo B', descripcion: 'Bodega central · reposición' },
    { id: 'u3', nombre: 'Mezzanine', descripcion: 'Bodega central · próxima temporada y liquidación' },
  ];

  const proveedores: Proveedor[] = [
    { id: 'pv1', nombre: 'Guangzhou Lihua Garments Co.', pais: 'China', ciudad: 'Guangzhou', contacto: 'Wendy Chen', email: 'wendy.chen@lihuagarments.cn', telefono: '+86 20 8765 4321' },
    { id: 'pv2', nombre: 'Yiwu Bright Textile Ltd.', pais: 'China', ciudad: 'Yiwu', contacto: 'Kevin Zhang', email: 'sales@yiwubright.cn', telefono: '+86 579 8521 3344' },
    { id: 'pv3', nombre: 'Shenzhen Ocean Swimwear', pais: 'China', ciudad: 'Shenzhen', contacto: 'Lily Wu', email: 'lily@oceanswim.cn', telefono: '+86 755 2233 8899' },
    { id: 'pv4', nombre: 'Hangzhou Winter Coats Factory', pais: 'China', ciudad: 'Hangzhou', contacto: 'Jason Li', email: 'jason@hzwinter.cn', telefono: '+86 571 8890 1122' },
  ];

  // ---------- Productos ----------
  type Def = [string, string, string, number];
  const catalogo: Record<LineaProducto, { prov: string; items: Def[] }> = {
    Poleras: { prov: 'pv2', items: [
      ['Polera básica de algodón', 'Blanco', '#F4F4F2', 9990], ['Polera oversize estampada', 'Negro', '#26232B', 12990],
      ['Polera manga larga rib', 'Rosa palo', '#E4B7BE', 13990], ['Polera cuello V', 'Verde oliva', '#7A7F4E', 10990],
      ['Polera crop', 'Celeste', '#A9CBE3', 11990], ['Polera de lino', 'Beige', '#D9C6A5', 14990]] },
    Blazers: { prov: 'pv1', items: [
      ['Blazer clásico', 'Negro', '#24212A', 39990], ['Blazer oversize', 'Camel', '#B9865A', 44990],
      ['Blazer cuadrillé', 'Gris', '#8C8C93', 42990], ['Blazer de lino', 'Crudo', '#E8DFCC', 37990],
      ['Blazer cruzado', 'Burdeo', '#7A2335', 47990], ['Blazer entallado', 'Azul marino', '#26324F', 41990]] },
    Pantalones: { prov: 'pv1', items: [
      ['Pantalón wide leg', 'Negro', '#25222A', 24990], ['Jeans mom', 'Azul', '#5B7DB1', 26990],
      ['Pantalón cargo', 'Verde militar', '#5D6247', 23990], ['Pantalón sastre', 'Gris', '#7F8087', 27990],
      ['Jeans skinny', 'Azul oscuro', '#2F4568', 22990], ['Pantalón de lino', 'Blanco', '#F1EFEA', 21990]] },
    Parkas: { prov: 'pv4', items: [
      ['Parka acolchada', 'Negro', '#222027', 59990], ['Parka larga con capucha', 'Verde musgo', '#56603F', 74990],
      ['Parka impermeable', 'Azul', '#3E5E8E', 54990], ['Parka puffer corta', 'Lila', '#B7A3D4', 52990],
      ['Parka de plumón liviana', 'Beige', '#CDBB9C', 69990], ['Parka reversible', 'Burdeo', '#6E2234', 64990]] },
    Chaquetas: { prov: 'pv1', items: [
      ['Chaqueta de mezclilla', 'Azul', '#5E7FAE', 32990], ['Chaqueta de cuero sintético', 'Negro', '#1F1D24', 44990],
      ['Chaqueta bomber', 'Verde oliva', '#6C7046', 36990], ['Chaqueta de corderoy', 'Café', '#7B5534', 34990],
      ['Chaqueta tweed', 'Rosa', '#D9A0AE', 49990], ['Cortaviento', 'Amarillo', '#E6C14A', 29990]] },
    'Trajes de baño': { prov: 'pv3', items: [
      ['Bikini triángulo', 'Coral', '#EE7F6B', 19990], ['Traje de baño entero escotado', 'Negro', '#211F26', 24990],
      ['Bikini tiro alto', 'Floral', '#D86C8E', 21990], ['Trikini', 'Turquesa', '#3FB6B2', 22990],
      ['Bikini deportivo', 'Lila', '#A88BCB', 18990], ['Traje de baño entero manga larga', 'Azul marino', '#27304D', 27990]] },
  };
  const productos: Producto[] = [];
  const prefijo: Record<LineaProducto, string> = { Poleras: 'POL', Blazers: 'BLZ', Pantalones: 'PAN', Parkas: 'PRK', Chaquetas: 'CHQ', 'Trajes de baño': 'TDB' };
  let k = 0;
  (Object.keys(catalogo) as LineaProducto[]).forEach((linea) => {
    catalogo[linea].items.forEach(([nombre, color, hex, precio], i) => {
      k++;
      const umbral = linea === 'Poleras' ? 20 : linea === 'Parkas' || linea === 'Blazers' ? 8 : 12;
      productos.push({
        id: `p${k}`,
        sku: `${prefijo[linea]}-${String(100 + i + 1)}`,
        nombre,
        linea,
        color,
        colorHex: hex,
        tallas: ['XS', 'S', 'M', 'L', 'XL'],
        precio,
        costo: Math.round((precio * (0.4 + r() * 0.08)) / 10) * 10,
        stock: { u1: rint(umbral, umbral * 3), u2: rint(0, umbral), u3: linea === 'Trajes de baño' ? rint(10, 30) : rint(0, 6) },
        umbralMin: umbral,
        umbralCritico: Math.ceil(umbral / 2),
        proveedorId: catalogo[linea].prov,
        activo: true,
      });
    });
  });
  // Algunos productos con stock bajo, crítico o en cero para mostrar alertas
  const setStock = (pid: string, a: number, b: number, c: number) => { const p = productos.find((x) => x.id === pid)!; p.stock = { u1: a, u2: b, u3: c }; };
  setStock('p8', 3, 0, 0); // Blazer oversize crítico
  setStock('p20', 0, 0, 0); // Parka larga sin stock
  setStock('p14', 6, 2, 0); // Jeans mom bajo
  setStock('p25', 2, 1, 0); // Chaqueta mezclilla crítica
  setStock('p3', 9, 4, 0); // Polera rib bajo
  setStock('p11', 0, 0, 0); // Blazer cruzado sin stock

  // ---------- Clientes ----------
  const nombres: string[] = ['Javiera Morales', 'Antonia Silva', 'Catalina Muñoz', 'Fernanda Rojas', 'Valentina Soto', 'Constanza Díaz', 'Francisca Contreras', 'Isidora Sepúlveda', 'Martina Pérez', 'Daniela González', 'Camila Fuentes', 'Josefa Castillo', 'Sofía Vargas', 'Florencia Reyes', 'Trinidad Espinoza', 'Paula Herrera', 'Macarena Torres', 'Bárbara Núñez', 'Carolina Araya', 'María José Tapia', 'Ignacia Gutiérrez', 'Renata Figueroa', 'Agustina Lagos', 'Amanda Salazar', 'Emilia Cortés', 'Pía Valenzuela', 'Rocío Jara', 'Natalia Bravo', 'Gabriela Vera', 'Andrea Riquelme', 'Loreto Cáceres', 'Claudia Orellana', 'Victoria Zúñiga', 'Elena Saavedra'];
  const nombresF = ['Alejandra', 'Belén', 'Cecilia', 'Dominga', 'Esperanza', 'Fabiola', 'Gloria', 'Hilda', 'Irene', 'Jimena', 'Karina', 'Laura', 'Mónica', 'Nicole', 'Olga', 'Patricia', 'Romina', 'Susana', 'Tamara', 'Verónica', 'Ximena', 'Yasna', 'Zoe', 'Antonella', 'Colomba', 'Denisse', 'Fernanda', 'Javiera', 'Maite', 'Sara'];
  const apellidos = ['Aguilera', 'Barrera', 'Campos', 'Donoso', 'Escobar', 'Farías', 'Gallardo', 'Henríquez', 'Ibarra', 'Jiménez', 'Lillo', 'Maldonado', 'Navarro', 'Ojeda', 'Poblete', 'Quiroz', 'Rivera', 'Sandoval', 'Toledo', 'Urrutia', 'Venegas', 'Yáñez', 'Zamora', 'Alarcón', 'Bustos', 'Carrasco', 'Medina', 'Olivares', 'Parra', 'Soto'];
  const usados = new Set(nombres);
  while (nombres.length < 130) {
    const nm = `${pick(nombresF)} ${pick(apellidos)}`;
    if (!usados.has(nm)) { usados.add(nm); nombres.push(nm); }
  }
  const empresas: [string, string, string][] = [
    ['Boutique Lirio', 'Boutique Lirio SpA', 'Venta de vestuario femenino'], ['Amapola Store', 'Comercial Amapola Ltda.', 'Comercio al por menor de prendas'],
    ['Moda Austral', 'Moda Austral SpA', 'Tienda de ropa'], ['Closet Norte', 'Inversiones Closet Norte Ltda.', 'Venta de ropa y accesorios'],
    ['La Percha', 'Comercializadora La Percha SpA', 'Venta de vestuario'], ['Atelier Brisa', 'Atelier Brisa Ltda.', 'Diseño y venta de ropa'],
    ['Eventos Magnolia', 'Producciones Magnolia SpA', 'Uniformes para eventos'], ['Showroom Valpo', 'Showroom Valparaíso Ltda.', 'Tienda multimarca'],
  ];
  const calles = ['Av. Providencia', 'Los Leones', 'Irarrázaval', 'Av. Grecia', 'Pedro de Valdivia', 'Av. Matta', 'Gran Avenida', 'Av. Pajaritos', 'Av. Libertad', 'Errázuriz', 'Colo Colo', 'Av. Alemania', 'Baquedano', 'Av. Brasil'];
  const todasComunas = zonas.flatMap((z) => z.comunas.map((c) => ({ c, z: z.id, peso: z.region === 'Metropolitana' ? 3 : 1 })));
  const comunaPonderada = () => {
    const tot = todasComunas.reduce((a, x) => a + x.peso, 0);
    let t = r() * tot;
    for (const x of todasComunas) { t -= x.peso; if (t <= 0) return x; }
    return todasComunas[0];
  };
  const clientes: Cliente[] = [];
  nombres.forEach((nom, i) => {
    const loc = i === 0 ? { c: 'Ñuñoa', z: 'z1' } : i === 1 ? { c: 'Maipú', z: 'z3' } : comunaPonderada();
    const [pn, ap] = nom.split(' ');
    clientes.push({
      id: `c${i + 1}`, tipo: 'natural', nombre: nom, rut: rutDesdeNumero(15000000 + rint(0, 9000000)),
      email: `${pn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${(ap ?? 'x').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@correo.cl`,
      telefono: `+56 9 ${rint(5000, 9999)} ${rint(1000, 9999)}`, direccion: `${pick(calles)} ${rint(100, 4999)}${r() < 0.4 ? `, depto ${rint(101, 1504)}` : ''}`,
      comuna: loc.c, zonaId: loc.z, creado: en(rint(200, 900)).toISOString(),
    });
  });
  empresas.forEach(([fant, razon, giro], i) => {
    const loc = i === 7 ? { c: 'Valparaíso', z: 'z4' } : i === 3 ? { c: 'Antofagasta', z: 'z6' } : i === 2 ? { c: 'Puerto Montt', z: 'z7' } : comunaPonderada();
    clientes.push({
      id: `c${nombres.length + i + 1}`, tipo: 'empresa', nombre: fant, razonSocial: razon, giro, rut: rutDesdeNumero(76000000 + rint(0, 999999)),
      email: `contacto@${fant.toLowerCase().replace(/[^a-z]/g, '')}.cl`, telefono: `+56 2 2${rint(100, 999)} ${rint(1000, 9999)}`,
      direccion: `${pick(calles)} ${rint(100, 2999)}, local ${rint(1, 40)}`, comuna: loc.c, zonaId: loc.z, creado: en(rint(300, 1500)).toISOString(),
    });
  });
  // perfil de compra: frecuencia (compras en 180 días) y tamaño
  const perfil: Record<string, { freq: number; grande: boolean; corteDias?: number }> = {};
  clientes.forEach((c, i) => {
    if (c.tipo === 'empresa') perfil[c.id] = { freq: rint(4, 9), grande: true };
    else if (i < 6) perfil[c.id] = { freq: rint(8, 11), grande: false };
    else if (i < 26) perfil[c.id] = { freq: rint(3, 6), grande: false };
    else perfil[c.id] = { freq: rint(1, 3), grande: false };
  });
  perfil['c1'] = { freq: 11, grande: false };
  perfil['c2'] = { freq: 2, grande: false };
  // clientes que dejaron de comprar (inactivos > 60 días)
  ['c22', 'c25', 'c28', 'c31', 'c33', 'c40'].forEach((cid) => { if (perfil[cid]) perfil[cid].corteDias = rint(70, 130); });

  // ---------- Usuarios ----------
  const ph = hashClave(CLAVE_DEMO);
  const u = (o: Partial<Usuario> & Pick<Usuario, 'id' | 'nombre' | 'usuario' | 'rol' | 'area'>): Usuario => ({
    rut: rutDesdeNumero(12000000 + rint(0, 9000000)), email: `${o.usuario}@tiendasurbano.cl`, passHash: ph, nivelAcceso: 'Intermedio',
    activo: true, bloqueado: false, intentosFallidos: 0, ultimoAcceso: en(rint(0, 2)).toISOString(), ...o,
  });
  const usuarios: Usuario[] = [
    u({ id: 'u_ven1', nombre: 'Camila Rojas', usuario: 'crojas', rol: 'vendedor', area: 'Ventas', nivelAcceso: 'Básico' }),
    u({ id: 'u_ven2', nombre: 'Diego Fuentes', usuario: 'dfuentes', rol: 'vendedor', area: 'Ventas', nivelAcceso: 'Básico' }),
    u({ id: 'u_ven3', nombre: 'Tomás Reyes', usuario: 'treyes', rol: 'vendedor', area: 'Ventas', nivelAcceso: 'Básico', ultimoAcceso: en(41).toISOString() }),
    u({ id: 'u_bod', nombre: 'Marcela Soto', usuario: 'msoto', rol: 'bodega', area: 'Bodega' }),
    u({ id: 'u_area', nombre: 'Andrés Muñoz', usuario: 'amunoz', rol: 'area', area: 'Operaciones' }),
    u({ id: 'u_area2', nombre: 'Paula Contreras', usuario: 'pcontreras', rol: 'area', area: 'Comercial' }),
    u({ id: 'u_eje', nombre: 'Valentina Díaz', usuario: 'vdiaz', rol: 'ejecutivo', area: 'Atención al cliente', nivelAcceso: 'Básico' }),
    u({ id: 'u_cont', nombre: 'Jorge Pizarro', usuario: 'jpizarro', rol: 'contador', area: 'Finanzas' }),
    u({ id: 'u_aud', nombre: 'Rosa Herrera', usuario: 'rherrera', rol: 'contador', area: 'Auditoría externa' }),
    u({ id: 'u_ger', nombre: 'Patricia Lagos', usuario: 'plagos', rol: 'gerente', area: 'Gerencia', nivelAcceso: 'Total' }),
    u({ id: 'u_ti', nombre: 'Felipe Araya', usuario: 'faraya', rol: 'ti', area: 'Tecnología', nivelAcceso: 'Total' }),
    u({ id: 'u_rep1', nombre: 'Luis Carrasco', usuario: 'lcarrasco', rol: 'repartidor', area: 'Reparto', nivelAcceso: 'Básico', empresaReparto: 'RutaSur Express', zonas: ['z1', 'z2'], disponible: true }),
    u({ id: 'u_rep2', nombre: 'Carlos Vera', usuario: 'cvera', rol: 'repartidor', area: 'Reparto', nivelAcceso: 'Básico', empresaReparto: 'RutaSur Express', zonas: ['z3', 'z1'], disponible: true }),
    u({ id: 'u_rep3', nombre: 'Fernanda Ortiz', usuario: 'fortiz', rol: 'repartidor', area: 'Reparto', nivelAcceso: 'Básico', empresaReparto: 'Envíos Costa', zonas: ['z4'], disponible: true }),
    u({ id: 'u_rep4', nombre: 'Ricardo Toro', usuario: 'rtoro', rol: 'repartidor', area: 'Reparto', nivelAcceso: 'Básico', empresaReparto: 'Cargo Andes', zonas: ['z5', 'z6', 'z7'], disponible: true }),
    u({ id: 'u_cli1', nombre: 'Javiera Morales', usuario: 'jmorales', email: clientes[0].email, rol: 'cliente', area: 'Clientes', nivelAcceso: 'Básico', clienteId: 'c1' }),
    u({ id: 'u_cli2', nombre: 'Antonia Silva', usuario: 'asilva', email: clientes[1].email, rol: 'cliente', area: 'Clientes', nivelAcceso: 'Básico', clienteId: 'c2' }),
    u({ id: 'u_cli3', nombre: 'Boutique Lirio', usuario: 'lirio', email: clientes[130].email, rol: 'cliente', area: 'Clientes', nivelAcceso: 'Básico', clienteId: 'c131' }),
  ];
  const vendedores = ['u_ven1', 'u_ven2'];
  const repPorZona = (z: string) => usuarios.filter((x) => x.rol === 'repartidor' && x.zonas?.includes(z))[0]?.id ?? 'u_rep1';

  // ---------- Campañas ----------
  const descEstandar: Record<Categoria, number> = { Bronce: 5, Plata: 8, Diamante: 12, Premium: 15 };
  const campanas: Campana[] = [
    { id: 'cp1', nombre: 'Cyber de invierno', tipo: 'categoria', desde: en(120, 0, 0).toISOString(), hasta: en(114, 23, 59).toISOString(), descuentos: { ...descEstandar }, creadaPor: 'u_area2', aprobadaPor: 'u_ger', estadoAprobacion: 'aprobada' },
    { id: 'cp2', nombre: 'Fiestas Patrias', tipo: 'categoria', desde: en(36, 0, 0).toISOString(), hasta: en(31, 23, 59).toISOString(), descuentos: { Bronce: 6, Plata: 10, Diamante: 14, Premium: 18 }, creadaPor: 'u_area2', aprobadaPor: 'u_ger', estadoAprobacion: 'aprobada' },
    { id: 'cp3', nombre: 'Primavera Urbano', tipo: 'categoria', desde: en(5, 0, 0).toISOString(), hasta: addDays(hoy, 9).toISOString(), descuentos: { Bronce: 5, Plata: 7, Diamante: 10, Premium: 12 }, creadaPor: 'u_area2', aprobadaPor: 'u_ger', estadoAprobacion: 'aprobada' },
    { id: 'cp4', nombre: 'Verano anticipado', tipo: 'categoria', desde: addDays(hoy, 30).toISOString(), hasta: addDays(hoy, 40).toISOString(), descuentos: { Bronce: 8, Plata: 10, Diamante: 15, Premium: 20 }, creadaPor: 'u_area2', estadoAprobacion: 'pendiente' },
  ];
  const campanaEn = (iso: string) => campanas.find((c) => c.estadoAprobacion === 'aprobada' && c.desde <= iso && c.hasta >= iso);
  const catEstimada = (cid: string): Categoria => {
    const p = perfil[cid];
    if (p.grande && p.freq >= 8) return 'Premium';
    if (p.grande || p.freq >= 8) return 'Diamante';
    if (p.freq >= 4) return 'Plata';
    return 'Bronce';
  };

  // ---------- Ventas, pedidos, movimientos y partidas ----------
  const ventas: Venta[] = [];
  const pedidos: Pedido[] = [];
  const movimientos: Movimiento[] = [];
  const partidas: Partida[] = [];
  let folio = 10230, boleta = 58400, nroPed = 104100;
  const DIAS = Math.floor((hoy.getTime() - new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getTime()) / 86400000);
  type Plan = { cid: string; d: number };
  const plan: Plan[] = [];
  for (const c of clientes) {
    const p = perfil[c.id];
    for (let i = 0; i < p.freq; i++) {
      let d = p.freq <= 2 && !p.corteDias && r() < 0.7 ? rint(0, 75) : rint(0, DIAS);
      if (p.corteDias && d < p.corteDias) d = rint(p.corteDias, DIAS);
      plan.push({ cid: c.id, d });
    }
  }
  // tráfico extra: compras sueltas que llegan por redes sociales
  for (let i = 0; i < 50; i++) {
    const c = pick(clientes.filter((x) => x.tipo === 'natural' && !perfil[x.id].corteDias && perfil[x.id].freq <= 3));
    plan.push({ cid: c.id, d: rint(0, DIAS) });
  }
  // asegurar movimiento hoy y ayer
  for (let i = 0; i < 19; i++) plan.push({ cid: pick(clientes.slice(0, 60)).id, d: i < 8 ? 0 : i < 14 ? 1 : 2 });
  plan.sort((a, b) => b.d - a.d);

  const lineaTemporada = (d: number): LineaProducto[] => (d > 60 ? ['Parkas', 'Chaquetas', 'Pantalones', 'Blazers', 'Poleras'] : ['Poleras', 'Blazers', 'Pantalones', 'Trajes de baño', 'Chaquetas', 'Poleras']);

  for (const { cid, d } of plan) {
    const cl = clientes.find((c) => c.id === cid)!;
    const pf = perfil[cid];
    const fechaD = en(d, d === 0 ? rint(9, Math.max(9, hoy.getHours() - 1)) : rint(9, 21));
    if (fechaD > hoy) fechaD.setTime(hoy.getTime() - rint(10, 120) * 60000);
    const iso = fechaD.toISOString();
    const nItems = pf.grande ? rint(2, 4) : r() < 0.6 ? 1 : 2;
    const items: ItemVenta[] = [];
    for (let j = 0; j < nItems; j++) {
      const linea = pick(lineaTemporada(d));
      const prod = pick(productos.filter((p) => p.linea === linea));
      if (items.some((i) => i.productoId === prod.id)) continue;
      items.push({ productoId: prod.id, nombre: prod.nombre, talla: pick(['S', 'M', 'M', 'L', 'XS', 'XL']), cantidad: pf.grande ? rint(2, 3) : r() < 0.9 ? 1 : 2, precioUnit: prod.precio, costoUnit: prod.costo });
    }
    const subtotal = items.reduce((a, i) => a + i.precioUnit * i.cantidad, 0);
    const camp = campanaEn(iso);
    const pctC = camp ? camp.descuentos[catEstimada(cid)] : 0;
    const descCampana = Math.round((subtotal * pctC) / 100);
    const zona = zonas.find((z) => z.id === cl.zonaId)!;
    const envio = subtotal - descCampana >= 50000 ? 0 : zona.tarifa;
    const total = subtotal - descCampana + envio;
    const porVendedor = r() < 0.35;
    const medio: MedioPago = porVendedor ? pick(['tarjeta', 'transferencia', 'efectivo', 'tarjeta', 'transferencia']) : pick(['tarjeta', 'tarjeta', 'tarjeta', 'transferencia']);
    const vId = id('v');
    const pId = id('pd');
    const ef = medio === 'efectivo' ? Math.ceil(total / 10000) * 10000 : undefined;
    const venta: Venta = {
      id: vId, folio: folio++, boleta: boleta++, fecha: iso, canal: r() < 0.62 ? 'web' : 'movil', origen: porVendedor ? 'vendedor' : 'tienda_web',
      vendedorId: porVendedor ? pick(vendedores) : undefined, clienteId: cid, items, subtotal, descCampana, campanaId: camp && pctC ? camp.id : undefined,
      descPromo: 0, envio, total,
      pago: { medio, estado: 'aprobado', montoRecibido: ef, vuelto: ef ? ef - total : undefined, nroOperacion: medio === 'transferencia' ? String(rint(10000000, 99999999)) : undefined, tarjeta: medio === 'tarjeta' ? String(rint(1000, 9999)) : undefined },
      estado: 'confirmada', pedidoId: pId,
    };
    ventas.push(venta);

    // pedido y su historia
    const desde = addDays(fechaD, zona.diasMin);
    const hasta = addDays(fechaD, zona.diasMax);
    const repId = repPorZona(zona.id);
    const historial: Pedido['historial'] = [{ estado: 'pendiente', fecha: iso, usuarioId: 'sistema' }];
    let estado: EstadoPedido = 'pendiente';
    let entrega: Pedido['entrega'];
    const incidencias: Pedido['incidencias'] = [];
    const t = (horas: number) => new Date(fechaD.getTime() + horas * 3600000).toISOString();
    const diasDesde = d;
    const avanzar = (est: EstadoPedido, h: number, nota?: string) => { historial.push({ estado: est, fecha: t(h), usuarioId: est === 'preparacion' ? 'u_bod' : repId, nota }); estado = est; };
    const aEntregar = (() => {
      if (diasDesde === 0) { if (r() < 0.45) avanzar('preparacion', 1); return false; }
      if (diasDesde === 1) { avanzar('preparacion', rint(2, 5)); if (r() < 0.7) avanzar('en_ruta', 18 + rint(0, 3)); return false; }
      avanzar('preparacion', rint(2, 6));
      avanzar('en_ruta', 20 + rint(0, 6));
      if (diasDesde === 2) return r() < 0.4;
      return diasDesde > zona.diasMax || r() < 0.85;
    })();
    if (aEntregar) {
      const conProblema = r() < 0.06;
      if (conProblema) {
        const tipo = pick(['ausente', 'direccion'] as const);
        incidencias.push({ id: id('inc'), tipo, comentario: tipo === 'ausente' ? 'Nadie en el domicilio, se deja aviso.' : 'Número de casa no existe, se contacta a la clienta.', fecha: t(30), usuarioId: repId, resuelta: true });
        avanzar('incidencia', 30, 'Incidencia registrada');
        avanzar('en_ruta', 50, 'Segundo intento de entrega');
      }
      const hEnt = conProblema ? 54 : 24 + rint(2, 30);
      avanzar('entregado', hEnt);
      entrega = { fecha: t(hEnt), receptor: r() < 0.8 ? cl.nombre.split(' ')[0] : 'Conserje', evidencia: r() < 0.6 ? 'firma' : r() < 0.5 ? 'foto' : undefined };
    }
    // ningún evento puede quedar en el futuro
    const ahoraMs = hoy.getTime();
    historial.forEach((h, i) => { if (new Date(h.fecha).getTime() > ahoraMs) h.fecha = new Date(ahoraMs - (historial.length - i) * 9 * 60000).toISOString(); });
    for (let i = 1; i < historial.length; i++) if (historial[i].fecha < historial[i - 1].fecha) historial[i].fecha = historial[i - 1].fecha;
    if (entrega && new Date(entrega.fecha).getTime() > ahoraMs) entrega.fecha = historial[historial.length - 1].fecha;
    pedidos.push({
      id: pId, nro: `UP-${nroPed++}`, ventaId: vId, clienteId: cid, direccion: cl.direccion, comuna: cl.comuna, zonaId: zona.id, estado,
      repartidorId: estado === 'pendiente' ? undefined : repId, historial, estimadoDesde: desde.toISOString(), estimadoHasta: hasta.toISOString(), entrega, incidencias,
    });

    // movimientos de stock por venta (últimos 30 días para no sobrecargar)
    if (d <= 30) for (const it of items) movimientos.push({ id: id('mv'), fecha: iso, productoId: it.productoId, ubicacionId: 'u1', tipo: 'venta', cantidad: -it.cantidad, motivo: `Venta folio ${venta.folio}`, usuarioId: venta.vendedorId ?? 'sistema' });

    // ingreso automático en finanzas (RF63)
    partidas.push({ id: id('pt'), fecha: iso, tipo: 'ingreso', categoria: 'Ventas', descripcion: `Venta folio ${venta.folio} (${medio})`, monto: total, ventaId: vId, usuarioId: 'sistema', conciliada: d > 25, notas: [] });
  }

  // Dos incidencias activas y estados recientes variados
  const recientes = pedidos.filter((p) => p.estado === 'en_ruta').slice(-6);
  recientes.slice(0, 2).forEach((p, i) => {
    const repId = p.repartidorId!;
    const f = new Date(Math.min(Date.now() - 3600000, new Date(p.historial[p.historial.length - 1].fecha).getTime() + 5 * 3600000)).toISOString();
    p.incidencias.push({ id: id('inc'), tipo: i === 0 ? 'direccion' : 'danado', comentario: i === 0 ? 'La dirección no coincide con el número indicado. Clienta no contesta.' : 'Caja llegó mojada desde el centro de distribución, una prenda manchada.', fecha: f, usuarioId: repId, resuelta: false });
    p.historial.push({ estado: 'incidencia', fecha: f, usuarioId: repId, nota: 'Incidencia registrada' });
    p.estado = 'incidencia';
  });

  // ---------- Stock: movimientos de ingreso por importación ----------
  for (const p of productos.slice(0, 36)) {
    if (r() < 0.45) movimientos.push({ id: id('mv'), fecha: en(rint(5, 28), 10).toISOString(), productoId: p.id, ubicacionId: 'u1', tipo: 'ingreso', cantidad: rint(10, 40), motivo: `Contenedor importación ${pick(['GZ-2209', 'YW-0815', 'HZ-1102', 'SZ-0730'])}`, usuarioId: 'u_bod' });
  }
  movimientos.push({ id: id('mv'), fecha: en(9, 12).toISOString(), productoId: 'p3', ubicacionId: 'u2', tipo: 'ajuste', cantidad: -2, motivo: 'Merma: prendas con falla de costura', usuarioId: 'u_bod' });
  movimientos.push({ id: id('mv'), fecha: en(4, 16).toISOString(), productoId: 'p26', ubicacionId: 'u1', tipo: 'ajuste', cantidad: -1, motivo: 'Merma: cierre roto en revisión de calidad', usuarioId: 'u_bod' });
  movimientos.push({ id: id('mv'), fecha: en(12, 11).toISOString(), productoId: 'p33', ubicacionId: 'u3', tipo: 'traslado', cantidad: -8, motivo: 'Traslado a Pasillo A por inicio de temporada', usuarioId: 'u_bod' });
  movimientos.push({ id: id('mv'), fecha: en(12, 11).toISOString(), productoId: 'p33', ubicacionId: 'u1', tipo: 'traslado', cantidad: 8, motivo: 'Traslado desde Mezzanine por inicio de temporada', usuarioId: 'u_bod' });
  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const alertas: AlertaStock[] = productos
    .filter((p) => Object.values(p.stock).reduce((a, b) => a + b, 0) < p.umbralMin)
    .map((p) => ({ id: id('al'), productoId: p.id, fecha: en(rint(0, 4)).toISOString(), stock: Object.values(p.stock).reduce((a, b) => a + b, 0), estado: 'activa' as const }));
  alertas.push({ id: id('al'), productoId: 'p30', fecha: en(15).toISOString(), stock: 9, estado: 'resuelta' });

  let folioRep = 3100;
  const reposiciones: OrdenReposicion[] = [
    { id: id('or'), folio: folioRep++, fecha: en(20, 10).toISOString(), productoId: 'p30', proveedorId: 'pv1', cantidad: 40, estado: 'recibida', automatica: true },
    { id: id('or'), folio: folioRep++, fecha: en(6, 10).toISOString(), productoId: 'p20', proveedorId: 'pv4', cantidad: 30, estado: 'enviada', automatica: true },
    { id: id('or'), folio: folioRep++, fecha: en(1, 18).toISOString(), productoId: 'p11', proveedorId: 'pv1', cantidad: 24, estado: 'generada', automatica: true },
    { id: id('or'), folio: folioRep++, fecha: en(0, 9).toISOString(), productoId: 'p8', proveedorId: 'pv1', cantidad: 24, estado: 'generada', automatica: true },
  ];

  // ---------- Egresos mensuales ----------
  const meses: string[] = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); meses.push(claveMes(dia(d))); }
  const ventasMes = (m: string) => ventas.filter((v) => claveMes(dia(v.fecha)) === m).reduce((a, v) => a + v.total, 0);
  const mesActual = claveMes(dia(hoy));
  for (const m of meses) {
    const [y, mm] = m.split('-').map(Number);
    const ultimoDia = m === mesActual ? hoy.getDate() : new Date(y, mm, 0).getDate();
    const f = (dd: number, h = 11) => new Date(y, mm - 1, Math.min(dd, ultimoDia), h, rint(0, 59)).toISOString();
    const vm = ventasMes(m);
    const esActual = m === mesActual;
    const esAlerta = m === meses[meses.length - 2]; // mes pasado: compra grande de temporada que dispara la alerta de egresos
    const add = (dd: number, categoria: Partida['categoria'], descripcion: string, monto: number) => {
      if (esActual && dd > hoy.getDate()) return;
      partidas.push({ id: id('pt'), fecha: f(dd), tipo: 'egreso', categoria, descripcion, monto: Math.round(monto / 10) * 10, usuarioId: 'u_cont', conciliada: !esActual, notas: [] });
    };
    const sueldos = esActual ? 0 : 1250000;
    const logistica = vm * 0.06;
    const arriendo = 480000;
    const servicios = 115000 + rint(0, 25000);
    const publicidad = 140000 + rint(0, 60000);
    const objetivo = esAlerta ? 0.935 : esActual ? 0.78 : 0.86 + r() * 0.035; // margen de utilidad mínimo, como dice el caso
    const fijos = (esActual ? 0 : sueldos) + logistica + (hoy.getDate() >= 3 || !esActual ? arriendo : 0) + servicios + publicidad;
    const proveedores = Math.max(vm * 0.3, vm * objetivo - fijos);
    add(5, 'Proveedores', `Importación ${pick(['Guangzhou Lihua', 'Yiwu Bright', 'Hangzhou Winter'])} (contenedor)`, proveedores * 0.72);
    add(18, 'Proveedores', 'Internación y agente de aduana', proveedores * 0.28);
    add(30, 'Sueldos', 'Remuneraciones del mes', sueldos);
    add(10, 'Logística', 'Empresas de reparto (RutaSur, Envíos Costa, Cargo Andes)', logistica);
    add(3, 'Servicios', 'Arriendo bodega central', arriendo);
    add(8, 'Servicios', 'Internet, telefonía y plataforma de pagos', servicios);
    add(15, 'Otros', 'Publicidad en redes sociales', publicidad);
  }
  // limpiar egreso de sueldo en 0 (mes en curso)
  for (let i = partidas.length - 1; i >= 0; i--) if (partidas[i].monto === 0) partidas.splice(i, 1);
  partidas.sort((a, b) => a.fecha.localeCompare(b.fecha));
  // notas de auditoría
  const notable = partidas.find((p) => p.tipo === 'egreso' && p.categoria === 'Proveedores' && p.fecha.startsWith(meses[meses.length - 2]));
  if (notable) notable.notas.push({ autorId: 'u_aud', fecha: en(10, 15).toISOString(), texto: 'Monto alto respecto a meses anteriores. Se solicita factura de importación y DIN para respaldo.' });

  // ---------- Banco (movimientos para conciliar del mes en curso) ----------
  const banco: MovBanco[] = [];
  for (const p of partidas.filter((x) => claveMes(dia(x.fecha)) === mesActual)) {
    if (p.tipo === 'ingreso') {
      if (r() < 0.12) continue; // algunos abonos aún no llegan al banco
      banco.push({ id: id('bk'), fecha: addDays(p.fecha, rint(0, 2)).toISOString(), descripcion: p.descripcion.includes('tarjeta') ? 'Abono Transbank' : p.descripcion.includes('transferencia') ? 'Transferencia recibida' : 'Depósito en efectivo', monto: p.monto });
    } else {
      banco.push({ id: id('bk'), fecha: addDays(p.fecha, rint(0, 1)).toISOString(), descripcion: `Cargo ${p.descripcion.split(' ').slice(0, 3).join(' ')}`, monto: -p.monto });
    }
  }
  banco.push({ id: id('bk'), fecha: en(3, 9).toISOString(), descripcion: 'Comisión mantención cuenta corriente', monto: -8900 });
  banco.sort((a, b) => a.fecha.localeCompare(b.fecha));
  // filtrar fechas futuras
  const ahoraIso = hoy.toISOString();
  for (const b of banco) if (b.fecha > ahoraIso) b.fecha = ahoraIso;

  // ---------- Reportes (resúmenes mensuales automáticos, RF59) ----------
  const reportes: ReporteFinanciero[] = meses.slice(0, -1).map((m) => {
    const [y, mm] = m.split('-').map(Number);
    const ps = partidas.filter((p) => claveMes(dia(p.fecha)) === m);
    const ing = ps.filter((p) => p.tipo === 'ingreso').reduce((a, p) => a + p.monto, 0);
    const egr = ps.filter((p) => p.tipo === 'egreso').reduce((a, p) => a + p.monto, 0);
    const cierre = new Date(y, mm, 1, 0, 5).toISOString();
    return { id: id('rp'), nombre: `Resumen financiero mensual`, tipo: 'resumen_mensual', periodo: m, creado: cierre, creadoPor: 'sistema', ingresos: ing, egresos: egr, margen: ing - egr, archivado: m === meses[0], fechaCierre: m === meses[0] ? addDays(cierre, 40).toISOString() : undefined };
  });

  // ---------- Cotizaciones, devoluciones y promociones ----------
  const prodP = (pid: string) => productos.find((p) => p.id === pid)!;
  const it = (pid: string, cant: number, talla = 'M'): ItemVenta => ({ productoId: pid, nombre: prodP(pid).nombre, talla, cantidad: cant, precioUnit: prodP(pid).precio, costoUnit: prodP(pid).costo });
  let folioCot = 880;
  const mkCot = (cid: string, items: ItemVenta[], dAtras: number, vig: number, estado: Cotizacion['estado']): Cotizacion => {
    const sub = items.reduce((a, i) => a + i.precioUnit * i.cantidad, 0);
    const z = zonas.find((x) => x.id === clientes.find((c) => c.id === cid)!.zonaId)!;
    const envio = sub >= 50000 ? 0 : z.tarifa;
    return { id: id('ct'), folio: folioCot++, fecha: en(dAtras).toISOString(), vendedorId: 'u_ven1', clienteId: cid, items, envio, total: sub + envio, vigenciaDias: vig, estado };
  };
  const cotizaciones: Cotizacion[] = [
    mkCot('c133', [it('p7', 6), it('p19', 6, 'S')], 2, 10, 'vigente'),
    mkCot('c137', [it('p31', 10), it('p34', 8)], 1, 7, 'vigente'),
    mkCot('c5', [it('p27', 1)], 20, 5, 'vigente'),
    mkCot('c132', [it('p9', 4), it('p16', 4)], 14, 10, 'anulada'),
  ];

  const ventasAnt = ventas.filter((v) => v.fecha < en(5).toISOString());
  const devoluciones: Devolucion[] = [0, 1, 2].map((i) => {
    const v = ventasAnt[ventasAnt.length - 10 - i * 7];
    const item = v.items[0];
    return { id: id('dv'), ventaId: v.id, fecha: addDays(v.fecha, 4).toISOString(), items: [{ productoId: item.productoId, nombre: item.nombre, cantidad: 1, monto: item.precioUnit }], tipo: i === 1 ? 'reembolso' : 'nota_credito', monto: item.precioUnit, motivo: ['Talla no corresponde', 'Producto con falla de fábrica', 'Color distinto al de la foto'][i], usuarioId: 'u_eje', folioNC: i === 1 ? undefined : 410 + i };
  });
  for (const dvl of devoluciones) partidas.push({ id: id('pt'), fecha: dvl.fecha, tipo: 'egreso', categoria: 'Otros', descripcion: `Devolución ${dvl.tipo === 'reembolso' ? 'reembolso' : 'nota de crédito'} venta ${ventas.find((v) => v.id === dvl.ventaId)?.folio}`, monto: dvl.monto, usuarioId: 'u_eje', conciliada: true, notas: [] });
  partidas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // una venta anulada con autorización
  const anul = ventasAnt[ventasAnt.length - 30];
  anul.estado = 'anulada';
  anul.anulacion = { motivo: 'Clienta pagó dos veces por error, se anula la venta duplicada', autorizadaPor: 'u_area', fecha: addDays(anul.fecha, 0.1).toISOString() };
  const pAnul = partidas.find((p) => p.ventaId === anul.id);
  if (pAnul) partidas.splice(partidas.indexOf(pAnul), 1);
  const pedAnul = pedidos.find((p) => p.ventaId === anul.id);
  if (pedAnul) pedidos.splice(pedidos.indexOf(pedAnul), 1);
  anul.pedidoId = undefined;

  const promociones: Promocion[] = [
    { id: 'pr1', nombre: 'Descuento seguidoras de Instagram', porcentaje: 10, autorizadaPor: 'u_area2', activa: true },
    { id: 'pr2', nombre: 'Liquidación de invierno', porcentaje: 20, autorizadaPor: 'u_ger', activa: true },
    { id: 'pr3', nombre: 'Black Friday 2025', porcentaje: 25, autorizadaPor: 'u_ger', activa: false },
  ];

  // ---------- Turnos, asistencia y cierres de caja ----------
  const turnos: Turno[] = [
    { id: 't1', nombre: 'Mañana', inicio: '08:00', fin: '15:00' },
    { id: 't2', nombre: 'Tarde', inicio: '15:00', fin: '22:00' },
    { id: 't3', nombre: 'Administrativo', inicio: '09:00', fin: '18:00' },
  ];
  const internos = usuarios.filter((x) => x.rol !== 'cliente' && x.rol !== 'repartidor' && x.id !== 'u_aud');
  const asignaciones: AsignacionTurno[] = [];
  for (const us of internos) {
    for (let dd = 0; dd < 7; dd++) {
      let t: string | null = null;
      if (us.rol === 'vendedor') t = dd === 6 ? null : us.id === 'u_ven1' ? (dd < 3 ? 't1' : 't2') : us.id === 'u_ven2' ? (dd < 3 ? 't2' : 't1') : null;
      else if (us.rol === 'bodega') t = dd === 6 ? null : 't1';
      else t = dd >= 5 ? null : 't3';
      asignaciones.push({ usuarioId: us.id, dia: dd, turnoId: t });
    }
  }
  const asistencias: Asistencia[] = [];
  for (let dAt = 14; dAt >= 1; dAt--) {
    const fd = addDays(hoy, -dAt);
    const diaSem = (fd.getDay() + 6) % 7;
    for (const us of internos) {
      if (us.id === 'u_ven3') continue;
      const a = asignaciones.find((x) => x.usuarioId === us.id && x.dia === diaSem);
      const t = turnos.find((x) => x.id === a?.turnoId);
      if (!t) continue;
      if (r() < 0.05) continue; // ausencia
      const [hi, mi] = t.inicio.split(':').map(Number);
      const [hf, mf] = t.fin.split(':').map(Number);
      const ent = new Date(fd); ent.setHours(hi, mi + rint(-8, r() < 0.15 ? 25 : 6), 0, 0);
      const sal = new Date(fd); sal.setHours(hf, mf + rint(-5, 20), 0, 0);
      asistencias.push({ id: id('as'), usuarioId: us.id, fecha: dia(fd), entrada: ent.toISOString(), salida: sal.toISOString() });
    }
  }
  // asistencia de hoy: quienes ya empezaron su turno
  {
    const diaSemHoy = (hoy.getDay() + 6) % 7;
    for (const us of internos) {
      if (us.id === 'u_ven3') continue;
      const a = asignaciones.find((x) => x.usuarioId === us.id && x.dia === diaSemHoy);
      const t = turnos.find((x) => x.id === a?.turnoId);
      if (!t) continue;
      const [hi, mi] = t.inicio.split(':').map(Number);
      const [hf, mf] = t.fin.split(':').map(Number);
      const ent = new Date(hoy); ent.setHours(hi, mi + rint(-6, 8), 0, 0);
      if (ent > hoy) continue;
      const fin = new Date(hoy); fin.setHours(hf, mf, 0, 0);
      const sal = fin < hoy ? new Date(fin.getTime() + rint(0, 15) * 60000) : undefined;
      if (us.id === 'u_ven1' || us.id === 'u_area' || us.id === 'u_ger' || us.id === 'u_ti' || us.id === 'u_cont' || us.id === 'u_eje' || us.id === 'u_bod') continue; // que ellos marquen en la demo
      asistencias.push({ id: id('as'), usuarioId: us.id, fecha: dia(hoy), entrada: ent.toISOString(), salida: sal && sal < hoy ? sal.toISOString() : undefined });
    }
  }
  const cierres: CierreCaja[] = [];
  for (let dAt = 10; dAt >= 1; dAt--) {
    const fd = addDays(hoy, -dAt);
    for (const t of ['t1', 't2']) {
      const vs = ventas.filter((v) => dia(v.fecha) === dia(fd) && v.estado === 'confirmada' && (t === 't1' ? new Date(v.fecha).getHours() < 15 : new Date(v.fecha).getHours() >= 15));
      const porMedio = { tarjeta: 0, transferencia: 0, efectivo: 0 } as Record<MedioPago, number>;
      vs.forEach((v) => (porMedio[v.pago.medio] += v.total));
      const cierreF = new Date(fd); cierreF.setHours(t === 't1' ? 15 : 22, 2, 0, 0);
      cierres.push({ id: id('cj'), fecha: cierreF.toISOString(), turnoId: t, usuarioId: t === 't1' ? 'u_ven1' : 'u_ven2', ventas: vs.length, porMedio, total: vs.reduce((a, v) => a + v.total, 0), anuladas: 0 });
    }
  }

  // ---------- Log de auditoría ----------
  const logs: LogEntry[] = [];
  const L = (dAt: number, usuarioId: string, tipo: LogEntry['tipo'], modulo: string, accion: string, detalle: string) =>
    logs.push({ id: id('lg'), fecha: en(dAt).toISOString(), usuarioId, tipo, modulo, accion, detalle });
  for (let dAt = 6; dAt >= 0; dAt--) {
    L(dAt, 'u_ven1', 'sesion', 'Sesión', 'Inicio de sesión', 'Ingreso desde navegador web');
    L(dAt, 'u_ven1', 'navegacion', 'Ventas y pagos', 'Visitó Nueva venta', '/ventas/nueva');
    L(dAt, 'u_bod', 'sesion', 'Sesión', 'Inicio de sesión', 'Ingreso desde navegador web');
    L(dAt, 'u_bod', 'navegacion', 'Despacho', 'Visitó Pedidos', '/despacho');
    L(dAt, 'u_bod', 'accion', 'Despacho', 'Asignó pedido', `Pedido UP-${104100 + rint(100, 400)} asignado a ${pick(['Luis Carrasco', 'Carlos Vera', 'Fernanda Ortiz'])}`);
    if (dAt % 2 === 0) L(dAt, 'u_cont', 'navegacion', 'Finanzas', 'Visitó Ingresos y egresos', '/finanzas/partidas');
  }
  L(9, 'u_bod', 'accion', 'Inventario', 'Ajuste de inventario', 'Polera manga larga rib: -2 (merma por falla de costura)');
  L(3, 'u_ven2', 'acceso_denegado', 'Finanzas', 'Acceso denegado', 'Intentó abrir /finanzas sin permiso para su rol');
  L(2, 'u_area', 'accion', 'Ventas y pagos', 'Autorizó anulación', `Venta folio ${anul.folio}: ${anul.anulacion.motivo}`);
  L(1, 'u_ti', 'accion', 'Personal y accesos', 'Aprobó solicitud de clave', 'Usuario: vdiaz');
  L(1, 'sistema', 'accion', 'Personal y accesos', 'Bloqueo por inactividad', 'Cuenta treyes bloqueada: más de 30 días sin ingresar');
  logs.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const vendedorBloq = usuarios.find((x) => x.id === 'u_ven3')!;
  vendedorBloq.bloqueado = true;
  vendedorBloq.motivoBloqueo = 'Inactividad mayor a 30 días';

  const solicitudes: SolicitudClave[] = [
    { id: id('sc'), usuarioId: 'u_eje', fecha: en(1, 9).toISOString(), estado: 'aprobada', resueltaPor: 'u_ti', fechaResolucion: en(1, 10).toISOString() },
    { id: id('sc'), usuarioId: 'u_ven2', fecha: en(0, 8, 40).toISOString(), estado: 'pendiente' },
  ];

  // ---------- Notificaciones ----------
  const notificaciones: Notificacion[] = [];
  const pedJav = pedidos.filter((p) => p.clienteId === 'c1').slice(-2);
  for (const p of pedJav) {
    if (p.historial.some((h) => h.estado === 'en_ruta')) notificaciones.push({ id: id('nt'), fecha: p.historial.find((h) => h.estado === 'en_ruta')!.fecha, destino: { clienteId: 'c1' }, titulo: `Tu pedido ${p.nro} va en camino`, texto: 'El repartidor ya salió con tu pedido.', leida: true });
  }
  notificaciones.push({ id: id('nt'), fecha: en(0, 8).toISOString(), destino: { rol: 'bodega' }, titulo: 'Stock bajo el umbral', texto: 'Blazer oversize (Camel) quedó en 3 unidades. Se generó la orden de reposición.', leida: false });
  notificaciones.push({ id: id('nt'), fecha: en(0, 8, 41).toISOString(), destino: { rol: 'ti' }, titulo: 'Nueva solicitud de cambio de clave', texto: 'Diego Fuentes pidió restablecer su contraseña.', leida: false });
  notificaciones.push({ id: id('nt'), fecha: en(1, 17).toISOString(), destino: { rol: 'gerente' }, titulo: 'Campaña pendiente de aprobación', texto: 'Paula Contreras creó la campaña "Verano anticipado".', leida: false });

  const db: DB = {
    version: DB_VERSION,
    creado: hoy.toISOString(),
    config: {
      envioGratisDesde: 50000,
      umbralEgresosPct: 90,
      diasClienteInactivo: 60,
      diasBloqueoCuenta: 30,
      minutosSesion: 15,
      intentosMaximos: 5,
      categorias: { Bronce: { monto: 0, compras: 0 }, Plata: { monto: 120000, compras: 3 }, Diamante: { monto: 280000, compras: 5 }, Premium: { monto: 450000, compras: 8 } },
      velocidadSprint: 40,
    },
    zonas, ubicaciones, proveedores, productos, clientes, usuarios, ventas, pedidos, cotizaciones, devoluciones, cierres, promociones, campanas,
    turnos, asignaciones, asistencias, logs, solicitudes, movimientos, alertas, reposiciones, partidas, banco, reportes, notificaciones,
    contadores: { folio, boleta, cotizacion: folioCot, reposicion: folioRep, nc: 413, pedido: nroPed },
  };
  return db;
}
