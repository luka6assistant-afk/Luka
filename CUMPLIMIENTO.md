# Lista de verificación legal y de calidad — Luka

Revisada el 6 de noviembre de 2026. ✅ resuelto en la app · 🟡 pendiente de una decisión o trámite tuyo · ⚠️ revisar con abogado.

> Esto no reemplaza la revisión de un abogado. Antes de cobrar, haz revisar los documentos legales.

## Documentos

| Punto | Estado | Dónde |
|---|---|---|
| Política de privacidad (Ley 1581) | ✅ | `/privacidad`: responsable, datos, finalidades, derechos, plazos, menores, conservación, seguridad |
| Mencionar que usamos inteligencia artificial | ✅ | `/privacidad` § 4 (qué hace, qué se envía, que puede equivocarse, que no decide por ti, entrenamiento) y `/terminos` § 3 |
| Herramientas de terceros | ✅ | `/privacidad` § 5: tabla con proveedor, para qué, qué datos recibe y dónde (Anthropic, Deepgram, Supabase, Vercel, Telegram, Wompi) |
| Términos de servicio | ✅ | `/terminos` |
| Política de reembolsos | ✅ ⚠️ | `/reembolsos`. Revisa los compromisos que puse: reembolso total en retracto, cobro por error o plan no activado; compensación de 7 días por caídas de más de 72 h |
| Política de cookies | ✅ | `/cookies`: solo cookies necesarias (sesión), sin publicidad ni analítica |
| Banner de cookies | ✅ | Aviso informativo abajo; se cierra con "Entendido" y no bloquea. No pide aceptar porque no hay cookies opcionales |
| Datos de la empresa | 🟡 | Hoy dice **"Luka SAS"**, pero esa empresa no existe: es una afirmación falsa. Mientras no la constituyas, el responsable debe ser la persona natural (nombre, cédula, dirección, correo, teléfono). Se cambia en `NEXT_PUBLIC_LEGAL_*` en Vercel |

## Datos personales

| Punto | Estado | Dónde |
|---|---|---|
| Borrar datos cuando el usuario lo pida | ✅ | Panel → 🔒 Mis datos: borrar mi cuenta, y borrar la familia completa (administrador). Telegram: `/privacidad` lo explica y `/panel` abre Mis datos |
| Descargar datos (acceso) | ✅ | Mis datos: movimientos en CSV y datos personales en JSON |
| Consentimiento | ✅ | Registro: casilla obligatoria **sin marcar** + prueba guardada (fecha, versión, IP, navegador). Telegram: aviso antes del primer procesamiento. Los documentos cambiaron, así que cada usuario los acepta de nuevo (versión 2026-11-06) |
| Verificar consentimientos | ✅ | `/admin/cuentas`: columna "Aceptó términos" por cuenta |
| Sin datos innecesarios | ✅ | No pedimos cédula, claves de bancos, ubicación ni contactos. Las notas de voz no se guardan. Sin analítica ni publicidad |
| Comprobantes de pago | ✅ | Se conservan por obligación contable aunque se borre la familia, sin vínculo con ella (migración 005) |
| Deepgram no entrena con los audios | ✅ 🟡 | Se envía `mip_opt_out=true` en cada nota de voz. Confírmalo en tu cuenta de Deepgram |

## Prácticas comerciales

| Punto | Estado | Detalle |
|---|---|---|
| Patrones oscuros | ✅ | Sin cuentas regresivas ni urgencia falsa. Quité el "Recomendado" que empujaba al plan caro y la función "Próximamente" que se vendía sin existir. Borrar la cuenta es tan fácil como crearla. La confirmación pide escribir BORRAR solo para evitar borrados por error |
| Tarifas ocultas | ✅ | Precio final en los botones ("Pagar 1 mes · $14.900"), sin cargos adicionales, sin renovación automática y sin guardar tarjeta |
| Reseñas falsas | ✅ | No hay testimonios ni calificaciones |
| Afirmaciones sin respaldo | ✅ | Sin "el mejor", "miles de familias", "100 % seguro" ni ahorros prometidos. Quité "deudas" de la descripción del servicio porque aún no está disponible |
| Cancelar suscripción | ✅ | No hay suscripción: el pago es por periodo. Los términos lo dicen: "no hay nada que cancelar" |
| Darse de baja de correos | ✅ 🟡 | Hoy no enviamos correos promocionales, solo los de inicio de sesión. Los términos se comprometen a pedir autorización y poner enlace de baja si algún día se envían |
| Pagos sin Wompi configurado | ✅ | Los botones de pago se ocultan hasta que haya llaves reales |

## Accesibilidad

| Punto | Estado | Detalle |
|---|---|---|
| Texto alternativo | ✅ | Logo y mascota con `alt`; las imágenes decorativas, vacías. Tablas con títulos y encabezados |
| Contraste | ✅ | El texto gris claro (`slate-400`, 2,6:1) pasó a `slate-500/600` (≥ 4,5:1). Botones en verde oscuro `#037f3d` con texto blanco (5:1) |
| Navegación por teclado | ✅ | Foco visible en todo, enlace "Saltar al contenido", campos con nombre accesible (antes las etiquetas no estaban enlazadas) |
| Menos movimiento | ✅ | Se respetan las animaciones reducidas del sistema |

## SDKs y servicios de terceros (auditoría)

| Paquete / servicio | Para qué | ¿Rastrea usuarios? |
|---|---|---|
| `next`, `react`, `react-dom` | Aplicación web | No |
| `@supabase/supabase-js`, `@supabase/ssr` | Base de datos y sesión | No (solo la cookie de sesión) |
| `@anthropic-ai/sdk` | Lectura con IA (solo servidor) | No |
| `grammy` | Bot de Telegram (solo servidor) | No |
| `recharts` | Gráficos | No |
| `zod`, `server-only` | Validación | No |
| Fuente Geist (`next/font`) | Tipografía | No: se descarga al compilar y se sirve desde Luka, sin llamar a Google |
| `telegram.org/js/telegram-web-app.js` | Solo dentro de la Mini App | Es de Telegram, necesario para la Mini App |
| Deepgram, Wompi | Llamadas desde el servidor / página de pago | No hay scripts suyos en el panel |

`npm audit` (dependencias de producción): 0 vulnerabilidades. Sin Google Analytics, píxeles de Meta, Hotjar ni similares. Vercel Analytics y Speed Insights están **apagados**; si los activas, hay que actualizar la política de cookies y pedir permiso.

## Imágenes

| Punto | Estado | Detalle |
|---|---|---|
| Licencia del logo y la mascota | 🟡 | Los hiciste tú. Si los generaste con IA, revisa que las condiciones de esa herramienta te den uso comercial. Antes de registrar la marca en la SIC, confirma que no se parezcan a logos existentes |
| Íconos | ✅ | Son emojis del sistema; no hay imágenes de bancos de fotos ni de terceros |

## Pendientes tuyos

1. **Datos del responsable**: cambiar "Luka SAS" por tus datos como persona natural mientras no exista la empresa.
2. **Revisar la política de reembolsos** (los compromisos de devolución y compensación).
3. **Ejecutar `supabase/005_reportes.sql`** en Supabase (resumen mensual y borrado de familias).
4. Revisión de un abogado antes de cobrar.
5. Cuando constituyas la empresa: razón social, NIT, facturación electrónica (DIAN) y, si aplica, registro de bases de datos en la SIC.
