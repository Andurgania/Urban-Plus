# Urban Plus · Prototipo para Tiendas Urbano

Prototipo web del sistema **Urban Plus**, hecho para el proyecto semestral de Ingeniería de Requisitos (RQY1101). Cubre los 68 requisitos funcionales del informe, lo que pide el caso de negocio (clientes personas y empresas, sugerencias de productos y las categorías Bronce, Plata, Diamante y Premium) y los requisitos no funcionales que se pueden mostrar en pantalla.

Todos los datos son ficticios. Se generan solos la primera vez que se abre la página y quedan guardados en el navegador.

## Subirlo a Vercel

1. Crea un repositorio nuevo en GitHub y sube **todo el contenido de esta carpeta** (no hace falta subir `node_modules` ni `dist`).
2. Entra a [vercel.com](https://vercel.com), elige **Add New → Project** e importa el repositorio.
3. Vercel detecta solo que es un proyecto **Vite**. No cambies nada y presiona **Deploy**.
4. En uno o dos minutos te entrega la dirección pública (algo como `urban-plus.vercel.app`).

Cada vez que subas un cambio a GitHub, Vercel vuelve a publicar la página sola.

## Probarlo en tu computador (opcional)

Necesitas [Node.js](https://nodejs.org) 18 o más nuevo.

```bash
npm install
npm run dev
```

Luego abre la dirección que aparece en la terminal (normalmente `http://localhost:5173`).

## Usuarios de la demo

Todas las cuentas usan la clave **`urbano123`**. En la pantalla de inicio de sesión también hay botones de acceso rápido.

| Usuario | Nombre | Rol |
|---|---|---|
| `jmorales` | Javiera Morales | Cliente (persona) |
| `lirio` | Boutique Lirio | Cliente (empresa) |
| `crojas` | Camila Rojas | Vendedor / Operador |
| `msoto` | Marcela Soto | Administrador de Bodega |
| `lcarrasco` | Luis Carrasco | Repartidor |
| `amunoz` | Andrés Muñoz | Administrador de Área |
| `vdiaz` | Valentina Díaz | Ejecutivo de Atención al Cliente |
| `jpizarro` | Jorge Pizarro | Contador / Auditor |
| `plagos` | Patricia Lagos | Gerente General |
| `faraya` | Felipe Araya | Administrador TI |
| `treyes` | Tomás Reyes | Vendedor bloqueado por inactividad (RF43) |

## Ideas para la presentación

- **Mapa de requisitos** (`/#/requisitos`, enlazado desde el inicio de sesión y el menú): lista cada RF con un botón *Ver* que entra con el usuario correcto y abre la pantalla donde se cumple.
- **Seguimiento en tiempo real (RF02):** abre dos pestañas. En una entra como `jmorales` y abre un pedido; en la otra entra como `lcarrasco` y presiona *Salir a ruta* o *Entregado*. La primera pestaña cambia sola. La sesión es independiente en cada pestaña, pero los datos son compartidos.
- **Flujo completo:** compra en la tienda como cliente → bodega asigna el pedido → el repartidor lo entrega con firma → el cliente recibe la notificación.
- **Control de acceso (RF35):** entra como vendedor y escribe `#/finanzas` en la barra de direcciones. Luego revisa el log de auditoría como `faraya`.
- **Bloqueo por intentos (RNF02):** equivoca la clave cinco veces con cualquier usuario y después reactívalo como `faraya`.
- **Reiniciar demo:** la franja rosada superior tiene el botón para volver a los datos originales.

## Cosas que se simulan

- **Pagos:** no hay cobros reales. La tarjeta se puede aprobar o rechazar a propósito para mostrar los dos casos.
- **Base de datos:** vive en el navegador (`localStorage`). Cada persona que abre la página tiene su propia copia de los datos.
- **PDF:** los botones *PDF* abren el diálogo de impresión del navegador. Ahí se elige *Guardar como PDF*.
- **Excel:** los botones *Excel* descargan un archivo `.xlsx` real.
- **Fotos de productos:** cada prenda se dibuja con su color real, en vez de usar fotos.

## Estructura

```
src/
  lib/          datos, reglas de negocio, permisos por rol y exportación
  components/   componentes de interfaz, gráficos e ilustraciones de prendas
  layouts/      estructura de la tienda y del sistema interno
  pages/        pantallas por módulo (tienda, ventas, despacho, comercial,
                inventario, finanzas, personal y generales)
```

Tecnología: React 19 + TypeScript + Vite, sin librerías externas de interfaz.
