# 🧾 Luka

*Las cuentas de la casa, desde el chat.*

Bot de Telegram + panel web para llevar las finanzas de la familia. En el chat familiar envían
fotos o capturas de **recibos, facturas DIAN, comprobantes de Nequi/Daviplata/bancos o PDF**, o escriben
mensajes como *"mercado 185.000 en el D1"*, y Claude extrae el movimiento, lo categoriza y lo registra.

**Qué hace**

- 📸 Lee recibos e imágenes con Claude (monto, comercio, fecha, categoría, medio de pago, quién pagó).
- ✅ Si la lectura es confiable lo registra de una vez; si no, lo deja *por confirmar*. Cada registro
  trae botones para confirmar, cambiar la categoría o borrar.
- 🎯 Presupuesto mensual por categoría, con avisos en el chat al llegar al 80 % o al pasarse.
- 📈 Proyección del gasto al cierre del mes y de los próximos 3 meses.
- 💳 Deudas con tasa E.A., fecha estimada de pago e intereses; plan avalancha vs. bola de nieve.
- 🐷 Metas de ahorro con aporte mensual necesario y fecha estimada.
- Comandos: `/resumen`, `/pendientes`, `/deudas`, `/ahorros`, `/panel`, `/vincular`, `/ayuda`.

**Stack:** Next.js 16 · Supabase (Postgres, Auth, Storage) · Claude API (`claude-opus-5-5`) · grammY · Recharts.

---

## Configuración (una sola vez)

### 1. Supabase
1. Crea un proyecto en <https://supabase.com>.
2. En **SQL Editor** pega y ejecuta todo [`supabase/schema.sql`](supabase/schema.sql)
   (tablas, seguridad por familia, categorías por defecto y el bucket privado `recibos`).
3. En **Project Settings → API** copia la URL, la `anon key` y la `service_role key`.
4. (Opcional) En **Authentication → Providers → Email** puedes desactivar "Confirm email" para pruebas.

### 2. Claude API
Crea una API key en <https://platform.claude.com/settings/keys>.

### 3. Bot de Telegram
1. Habla con [@BotFather](https://t.me/BotFather) → `/newbot` → copia el token.
2. **Importante:** `/setprivacy` → elige el bot → **Disable**. Sin esto el bot no ve las fotos del grupo.
3. Agrega el bot al grupo familiar.

### 4. Variables de entorno
```bash
cp .env.example .env.local
```
Completa los valores. `TELEGRAM_WEBHOOK_SECRET` es cualquier texto aleatorio (letras, números, `_`, `-`).
Opcional: `TELEGRAM_BOT_USERNAME` (sin @) para mostrarlo en el panel.

### 5. Correr y conectar el webhook
Telegram necesita una URL pública. En desarrollo usa un túnel:
```bash
npm run dev
```
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Con la URL `https://….trycloudflare.com` que aparece:
```bash
node --env-file=.env.local scripts/set-webhook.mjs https://xxxx.trycloudflare.com
```
En producción (Vercel) pon las mismas variables en el proyecto, despliega y corre el script con la URL final.

### 6. Primer uso
1. Abre la app, crea tu cuenta y la familia.
2. En **Familia** aparece el comando, ej. `/vincular A1B2C3`. Escríbelo en el grupo de Telegram.
3. Los demás miembros pueden crear su cuenta web y unirse con el mismo código.
4. Configura el presupuesto, las deudas y las metas de ahorro en el panel.

---

## Planes y cobro con Wompi

| Plan | Precio | Lecturas con IA/mes | Deudas y ahorros |
|---|---|---|---|
| Prueba gratis | 30 días | 100 | Sí |
| Familia | 14.900 COP/mes · 149.000/año | 100 | No |
| Familia Plus | 24.900 COP/mes · 249.000/año | 1.000 | Sí |

Los precios y límites se cambian en [`lib/plans.ts`](lib/plans.ts). El pago es **por periodo** (1 mes o 1 año):
no se renueva solo. El bot avisa en el chat 3 días antes de que venza y cuando vence. Al vencer, el panel sigue
abierto y se pueden registrar movimientos a mano, pero el bot deja de leer recibos.

**Configuración**
1. Ejecuta [`supabase/002_planes.sql`](supabase/002_planes.sql) en el SQL Editor (después de `schema.sql`).
2. Crea la cuenta de comercio en <https://comercios.wompi.co>. En **Desarrolladores** copia la llave pública,
   el secreto de **integridad** y el secreto de **eventos** a `.env.local`. Empieza con las llaves de pruebas (`pub_test_…`).
3. En el mismo panel, en **URL de eventos**, pon `https://TU-DOMINIO/api/wompi` (una para pruebas y otra para producción).
4. Recordatorios: en Vercel define `CRON_SECRET`. [`vercel.json`](vercel.json) llama `/api/cron/recordatorios`
   todos los días a las 8:00 a. m. hora Colombia.

**Cómo funciona un pago:** el panel crea el pago pendiente y redirige al checkout de Wompi con la firma de
integridad. Wompi notifica al webhook (firma verificada) y la página de resultado vuelve a consultar la transacción
directamente a Wompi. El pago se aplica una sola vez y solo si el monto coincide. El tiempo pagado se suma al
vencimiento actual.

Para probar en el sandbox usa los datos de prueba de Wompi: <https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/>.

---

## Aspectos legales (Colombia)

> Plantillas preparadas con base en la Ley 1581 de 2012 (datos personales), el Decreto 1377 de 2013 y la
> Ley 1480 de 2011 (consumidor). **No reemplazan la revisión de un abogado** antes de lanzar.

- Páginas públicas: [`/terminos`](app/(legal)/terminos/page.tsx) y [`/privacidad`](app/(legal)/privacidad/page.tsx).
- **Antes de publicar** completa los datos del responsable (razón social, NIT, dirección, correo y teléfono) en
  `.env.local` / Vercel (`NEXT_PUBLIC_LEGAL_*`) o en [`lib/legal.ts`](lib/legal.ts). Mientras falten, se ven como `[…]`.
- Ejecuta [`supabase/003_legal.sql`](supabase/003_legal.sql) en el SQL Editor (después de `002_planes.sql`).
- **Registro web:** casilla obligatoria y sin marcar. Se guarda la prueba de la autorización en `legal_consents`
  (usuario, documento, versión, fecha, IP y navegador).
- **Nueva versión:** si cambias los documentos, sube la versión en `lib/legal.ts`. Cada usuario tendrá que aceptarla
  en `/aceptar` antes de volver a entrar al panel.
- **Telegram:** cada miembro recibe un aviso de privacidad antes de que se procese su primer envío, y el bot le pide
  reenviarlo. Seguir enviando información después del aviso es autorización por conducta inequívoca. `/privacidad`
  muestra los enlaces y cómo pedir el borrado.
- Incluye: no es asesoría financiera, derecho de retracto de 5 días hábiles, reversión del pago, transmisión
  internacional a los proveedores (Supabase, Vercel, Anthropic, Telegram, Wompi), plazos de consultas y reclamos,
  conservación y menores de edad.
- Pendiente fuera del código: el Registro Nacional de Bases de Datos (RNBD) de la SIC solo es obligatorio para
  sociedades y entidades con activos totales mayores a 100.000 UVT. Confírmalo con tu contador, junto con la
  facturación electrónica de las suscripciones.

---

## Ajustes del PRD (v1)

Ejecuta [`supabase/004_prd.sql`](supabase/004_prd.sql) después de `003_legal.sql`.

- **Roles:** el administrador gestiona la familia, las categorías, los presupuestos y las metas. Los miembros registran
  movimientos y aportes y consultan. Se aplica en la base de datos (RLS) y en el panel. Se cierra además un hueco: antes
  cualquier usuario podía agregarse a otra familia si conocía su id.
- **Invitación por enlace:** `/unirse/CÓDIGO` (Familia → Invitar). Lleva al registro y vuelve a la invitación.
- **✏️ Editar en Telegram:** el bot pide el cambio y entiende lenguaje natural («son 125.000», «fue ayer»).
- **Notas de voz:** se transcriben con Deepgram (`DEEPGRAM_API_KEY`) y se procesan como texto. Máximo 90 s.
- **Deudas fuera del MVP:** el módulo queda oculto (`NEXT_PUBLIC_FEATURE_DEBTS=false`). Los abonos se registran como gasto
  en la categoría «Deudas».
- **Categorías iniciales:** Mercado, Hogar, Servicios, Transporte, Salud, Educación, Entretenimiento, Deudas y Otros
  (gastos); Salario y Otros ingresos. «Ahorro» no es categoría: es un tipo de movimiento.
- **Panel:** tarjetas Ingresos / Gastos / Balance / Ahorro acumulado, gráfico de gastos por categoría, filtros por
  categoría y persona.
- **Métricas del MVP:** `/admin/metricas` (solo correos en `ADMIN_EMAILS`): familias activas, movimientos por familia,
  retención semana 4, familias con meta y tiempo de registro (mediana y percentil 90 frente a la meta de 10 s).

---

## Panel dentro de Telegram (Mini App)

El panel se abre dentro del chat, sin correo ni contraseña: Telegram firma los datos de la persona y el servidor
(`/api/tg/auth`) los verifica con el token del bot. Solo entra quien ya escribió en un grupo vinculado.

1. En [@BotFather](https://t.me/BotFather): `/newapp` → elige el bot → nombre, descripción y foto → URL
   `https://TU-DOMINIO/tg` → nombre corto (ej. `panel`). Pon ese nombre en `TELEGRAM_MINIAPP_NAME` y el usuario del bot
   en `TELEGRAM_BOT_USERNAME`.
2. Corre otra vez `scripts/set-webhook.mjs`: además del webhook, pone el botón **Panel** en el chat privado con el bot.
3. En el grupo, `/panel` y `/resumen` muestran el botón **📊 Abrir panel**.

Cómo se crea la cuenta: si la persona ya vinculó su cuenta web ("Soy yo" en Familia) entra con esa; si no, se le crea
una cuenta interna (`tg-ID@telegram.invalid`, nunca recibe correos). La primera vez acepta los términos con la casilla.

Notas: necesita https (en desarrollo, el túnel de cloudflared). En Telegram Web la sesión depende de cookies de
terceros, que algunos navegadores bloquean; en las apps de celular y escritorio funciona normal.

---

## Estructura
```
app/api/telegram/route.ts  Webhook (responde 200 y procesa en segundo plano con after())
lib/bot.ts                 Comandos, lectura de fotos/PDF/texto, botones
lib/extract.ts             Extracción estructurada con Claude (salida validada con Zod)
lib/finance.ts             Resúmenes, proyecciones, amortización y planes de deuda
app/(panel)/…              Resumen, Movimientos, Presupuesto, Deudas, Ahorros, Familia
supabase/schema.sql        Base de datos, RLS y triggers (abonos y aportes actualizan saldos)
```

## Notas
- Costos: cada foto o mensaje con un monto hace una llamada a Claude con esfuerzo bajo. Los mensajes
  del grupo sin números no se envían a Claude.
- Las fotos de los recibos quedan en el bucket privado `recibos`; el panel las muestra con enlaces temporales.
- WhatsApp: toda la lógica (`extract.ts`, `finance.ts`) es independiente de Telegram, así que se puede
  agregar un webhook de WhatsApp Business Cloud API reutilizándola.
