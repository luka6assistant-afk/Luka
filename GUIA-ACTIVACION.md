# Guía para activar Luka (cuentas nuevas y gratis)

Sigue los pasos en orden. Cada servicio te va a dar llaves o datos: cópialos en la tabla del final (o directo en
`.env.local` y en Vercel). Nunca los compartas por chat ni los subas a GitHub.

> Los planes gratis y sus límites son los que publican estos servicios hoy; revísalos al crear cada cuenta.

---

## Paso 0 · Un correo solo para Luka

Crea un Gmail nuevo (por ejemplo `luka.finanzas@gmail.com`) y úsalo para **todas** las cuentas de esta guía.
Así queda separado de tus proyectos anteriores y, si un día vendes o compartes el negocio, entregas un solo correo.
Activa la verificación en dos pasos en ese Gmail.

---

## Paso 1 · GitHub (guarda el código) — gratis

1. Crea la cuenta en <https://github.com/signup> con el correo nuevo.
2. **New repository** → nombre `luka` → **Private** → sin README → *Create repository*.
3. Sube el código (te ayudo con los comandos cuando llegues aquí). El archivo `.env.local` nunca se sube: está en `.gitignore`.

---

## Paso 2 · Supabase (base de datos, usuarios y fotos de recibos) — gratis

1. Crea la cuenta en <https://supabase.com/dashboard/sign-up> con el correo nuevo (o "Continue with GitHub" usando la cuenta del paso 1).
2. **New project** → nombre `luka` → genera y guarda la contraseña de la base de datos → región **South America (São Paulo)**,
   la más cercana a Colombia → plan **Free**.
3. **SQL Editor** → *New query* → pega y ejecuta, **uno por uno y en este orden**:
   1. `supabase/schema.sql`
   2. `supabase/002_planes.sql`
   3. `supabase/003_legal.sql`
   4. `supabase/004_prd.sql`

   Cada uno debe terminar en "Success". Si alguno falla, detente y mándame el error.
4. **Project Settings → API Keys**: copia
   - la URL del proyecto → `NEXT_PUBLIC_SUPABASE_URL`
   - la llave pública (*anon* o *publishable*) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - la llave secreta (*service_role* o *secret*) → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ esta da acceso total: solo va en el servidor.
5. **Authentication → Sign In / Providers → Email**: para empezar, **desactiva "Confirm email"**. El correo gratis de
   Supabase solo deja enviar unos pocos correos por hora y los registros se quedarían esperando. Más adelante puedes
   conectar un proveedor de correo (por ejemplo Resend, que tiene plan gratis) y volver a activarlo.
6. Cuando tengas la dirección de Vercel (paso 6), vuelve a **Authentication → URL Configuration** y ponla en *Site URL*.

Límites del plan gratis: 500 MB de base de datos y 1 GB de archivos (alcanza para miles de recibos). **El proyecto se
pausa si pasa 7 días sin uso**; se reactiva con un clic desde el panel de Supabase.

---

## Paso 3 · Claude API (lee los recibos) — **no es gratis**

Es el único servicio que pide pagar desde el inicio: funciona con saldo prepagado.

1. Crea la cuenta en <https://platform.claude.com> con el correo nuevo.
2. **Billing** → carga el mínimo (US$5 alcanza para unas 250 lecturas de fotos).
3. **Billing → Limits**: pon un límite mensual bajo (por ejemplo US$10) para que nunca haya sorpresas.
4. **API Keys → Create key** → nombre `luka` → copia → `ANTHROPIC_API_KEY`.

---

## Paso 4 · Deepgram (notas de voz) — crédito gratis al registrarte

Opcional: sin esta llave el bot responde que las notas de voz aún no están activas, y todo lo demás funciona.

1. Crea la cuenta en <https://console.deepgram.com/signup> con el correo nuevo.
2. **API Keys → Create a New API Key** → copia → `DEEPGRAM_API_KEY`.

---

## Paso 5 · Bot de Telegram — gratis

Los bots quedan a nombre de tu cuenta personal de Telegram (no se puede usar el correo). Si más adelante quieres
pasarlo a otra cuenta, BotFather permite transferirlo.

1. Abre [@BotFather](https://t.me/BotFather) → `/newbot` → nombre visible `Luka` → usuario terminado en `bot`
   (prueba `LukaFamiliaBot`, `LukaCasaBot`, `MiLukaBot`…).
2. Copia el token → `TELEGRAM_BOT_TOKEN`. El usuario sin @ → `TELEGRAM_BOT_USERNAME`.
3. `/setprivacy` → elige el bot → **Disable** (si no, el bot no ve las fotos del grupo).
4. `/setdescription` y `/setuserpic` si quieres (descripción y logo).
5. La Mini App (`/newapp`) se crea en el paso 7, cuando ya tengas la dirección de la app.

---

## Paso 6 · Vercel (publica la app en internet) — gratis para empezar

1. Crea la cuenta en <https://vercel.com/signup> con **"Continue with GitHub"** (la cuenta del paso 1) → plan **Hobby**.
2. **Add New → Project** → importa el repositorio `luka`.
3. Antes de *Deploy*, abre **Environment Variables** y pega todas las variables de la tabla del final.
   Para `NEXT_PUBLIC_APP_URL` pon por ahora `https://luka.vercel.app` (lo corriges en el punto 5).
4. **Deploy**.
5. Copia la dirección que te asignó (ej. `https://luka-xyz.vercel.app`), corrige `NEXT_PUBLIC_APP_URL` en
   **Settings → Environment Variables** y haz **Redeploy**.
6. **Settings → Functions → Region**: elige **São Paulo (gru1)**, la misma región de la base de datos, para que el bot responda más rápido.
7. El recordatorio diario de vencimiento de planes se activa solo (`vercel.json`); solo necesita `CRON_SECRET`.

⚠️ El plan Hobby de Vercel es **solo para uso no comercial**. Mientras la usen tú y tu familia está bien; **cuando
empieces a cobrar** debes pasar a Vercel Pro (unos US$20 al mes).

---

## Paso 7 · Conectar Telegram con la app

1. En tu computador crea `.env.local` copiando `.env.example` y llénalo con los mismos valores de Vercel.
2. Ejecuta en la carpeta del proyecto:
   ```bash
   node --env-file=.env.local scripts/set-webhook.mjs https://TU-DIRECCION.vercel.app
   ```
   Debe mostrar `"ok":true` tres veces (webhook, comandos y botón de menú).
3. En @BotFather → `/newapp` → elige el bot → título `Luka` → descripción → foto (640×360) → GIF: `/empty` →
   URL `https://TU-DIRECCION.vercel.app/tg` → nombre corto `panel`.
   Ese nombre corto va en `TELEGRAM_MINIAPP_NAME` (si usas otro, cámbialo en Vercel y haz *Redeploy*).

---

## Paso 8 · Wompi (cobrar a los clientes) — sin mensualidad, comisión por pago

Puedes dejarlo para después: mientras no lo configures, todos los clientes quedan en la prueba gratis de 14 días.

1. Crea la cuenta de comercio en <https://comercios.wompi.co> con el correo nuevo.
2. Empieza en **modo pruebas (sandbox)**: en **Desarrolladores** copia la llave pública `pub_test_…`, el secreto de
   integridad y el secreto de eventos.
3. En **URL de eventos** pon `https://TU-DIRECCION.vercel.app/api/wompi`.
4. Para cobrar de verdad Wompi te pide los documentos del negocio (RUT, cédula del representante, certificado bancario).
   Cuando te aprueben, cambias las tres llaves por las de producción.

---

## Paso 9 · Primer uso

1. Abre `https://TU-DIRECCION.vercel.app`, crea tu cuenta (con el correo que pusiste en `ADMIN_EMAILS`) y crea la familia.
2. Crea un grupo de Telegram con tu familia y agrega al bot.
3. En el panel → **Familia** aparece `/vincular CÓDIGO`: escríbelo en el grupo.
4. Prueba: envía la foto de un recibo o escribe "mercado 85.000 en el D1".
5. Escribe `/panel` en el grupo y toca **📊 Abrir panel**.
6. Configura el presupuesto por categoría y crea una meta de ahorro.
7. Revisa las métricas en `https://TU-DIRECCION.vercel.app/admin/metricas`.

---

## Antes de vender

- Completa los datos legales (`NEXT_PUBLIC_LEGAL_*`): razón social o tu nombre, NIT o cédula, dirección, correo y teléfono.
  Mientras falten, los términos muestran `[…]`.
- Haz revisar los términos y la política de datos por un abogado.
- Registra la marca "Luka" en la SIC y compra el dominio.
- Pasa Vercel a Pro y Wompi a producción.

---

## Tabla de variables

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → llave pública (anon / publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → llave secreta (service_role / secret) |
| `ANTHROPIC_API_KEY` | platform.claude.com → API Keys |
| `TELEGRAM_BOT_TOKEN` | @BotFather → /newbot |
| `TELEGRAM_BOT_USERNAME` | El usuario del bot, sin @ |
| `TELEGRAM_MINIAPP_NAME` | Nombre corto de /newapp (ej. `panel`) |
| `TELEGRAM_WEBHOOK_SECRET` | Inventado: texto aleatorio (comando abajo) |
| `CRON_SECRET` | Inventado: texto aleatorio (comando abajo) |
| `NEXT_PUBLIC_APP_URL` | La dirección de Vercel, con https y sin `/` al final |
| `DEEPGRAM_API_KEY` | console.deepgram.com → API Keys (opcional) |
| `ADMIN_EMAILS` | Tu correo, para ver `/admin/metricas` |
| `NEXT_PUBLIC_FEATURE_DEBTS` | `false` (deudas llegan en la v2) |
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` | Wompi → Desarrolladores (opcional al inicio) |
| `NEXT_PUBLIC_LEGAL_*` | Tus datos como responsable |

Para inventar los dos secretos, ejecuta este comando dos veces y usa un resultado en cada uno:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
