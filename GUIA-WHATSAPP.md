# Guía: conectar Luka con WhatsApp

Luka funciona en WhatsApp como **chat privado**: cada miembro de la familia le escribe al número de Luka desde su celular.
No se necesita negocio verificado para empezar: sin verificar, Luka responde a todos los que le escriban; el único límite es
que puede **iniciar** conversaciones (como el resumen del día 1) con hasta 250 personas al día.

> Nunca pegues tokens ni claves en el chat. Van solo en `.env.local` (tu computador) y yo los cargo en Vercel.

---

## Fase 1 · Probar gratis con el número de prueba de Meta (sin documentos)

### 1. Cuenta de desarrollador
1. Entra a <https://developers.facebook.com> e inicia sesión con Facebook (Meta exige una cuenta de Facebook; puede ser la tuya).
2. Si te lo pide, regístrate como desarrolladora y verifica tu correo y celular.

### 2. Crear la app
1. **Mis apps → Crear app**.
2. Caso de uso: **Otro** → tipo **Negocios** (Business).
3. Nombre: `Luka` · correo: el Gmail de Luka.
4. Cuando te pida un portafolio comercial (Business portfolio), crea uno llamado **Luka**.

### 3. Activar WhatsApp
1. En el panel de la app, en **WhatsApp**, toca **Configurar**.
2. Ve a **WhatsApp → Configuración de la API** (API Setup). Ahí verás:
   - un **número de prueba** de Meta;
   - **Identificador del número de teléfono** (Phone number ID) → cópialo en `WHATSAPP_PHONE_NUMBER_ID`;
   - **Token de acceso temporal** → cópialo en `WHATSAPP_TOKEN` (dura 24 horas; en el paso 7 lo cambiamos por uno permanente).
3. En **Para** (To) agrega **tu número de celular** y confírmalo con el código que te llega. Con el número de prueba solo pueden
   escribirle hasta 5 números que agregues aquí.
4. Escribe el número de prueba en `NEXT_PUBLIC_WHATSAPP_NUMBER`, **solo dígitos con el código de país**, sin `+` ni espacios
   (ej. `15551234567`).

### 4. Clave secreta de la app
**Configuración de la app → Básica → Clave secreta de la app → Mostrar** → cópiala en `WHATSAPP_APP_SECRET`.
Sirve para comprobar que los mensajes vienen de verdad de Meta.

### 5. Avisarme
Guarda `.env.local` y avísame. Yo pruebo las llaves, las cargo en Vercel y publico.

### 6. Conectar el webhook (después de que yo publique)
1. **WhatsApp → Configuración** (Configuration) → **Webhook → Editar**.
2. **URL de devolución de llamada:** `https://holaluka.vercel.app/api/whatsapp`
3. **Token de verificación:** copia el valor de `WHATSAPP_VERIFY_TOKEN` de tu `.env.local` (ya lo generé).
4. **Verificar y guardar**.
5. En **Campos del webhook**, activa **messages** (Suscribirse).

### 7. Probar
1. Desde tu celular, en el panel → **Familia** → **💬 Conectar WhatsApp**: se abre WhatsApp con el mensaje listo → **Enviar**.
2. Luka responde "✅ ¡Listo! Tu WhatsApp quedó conectado".
3. Envíale la foto de un recibo, una nota de voz o escribe «mercado 85.000». Prueba los botones y escribe **resumen**, **panel**, **reporte**.

### 8. Token permanente (para que no se venza cada 24 horas)
1. <https://business.facebook.com> → **Configuración** → **Usuarios → Usuarios del sistema → Agregar**: nombre `luka-servidor`, rol **Administrador**.
2. **Asignar activos**: la app **Luka** (control total) y tu cuenta de WhatsApp (control total).
3. **Generar token**: app Luka, vencimiento **Nunca**, permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Cambia `WHATSAPP_TOKEN` en `.env.local` por este token y avísame para cargarlo.

---

## Fase 2 · Número real de Luka (cuando todo funcione)

1. Compra una **SIM prepago** para Luka. Ese número **no puede estar registrado en la app de WhatsApp** (si lo está, bórralo de la app primero).
2. En **WhatsApp → Configuración de la API → Agregar número de teléfono**: nombre visible **Luka**, categoría *Finanzas*,
   verifica el número con el código por SMS o llamada. Meta revisa el nombre (1 o 2 días).
3. Agrega un **método de pago** en el portafolio (Configuración → Pagos) para los mensajes que cobra Meta.
4. Cambia `WHATSAPP_PHONE_NUMBER_ID` y `NEXT_PUBLIC_WHATSAPP_NUMBER` por los del número nuevo y avísame.

### Plantilla del resumen del día 1
Fuera de las 24 horas siguientes al último mensaje de la persona, WhatsApp solo deja escribir con plantillas aprobadas.
En **WhatsApp → Plantillas de mensajes → Crear plantilla**:

- **Categoría:** Utilidad · **Nombre:** `resumen_mensual` · **Idioma:** Español
- **Encabezado:** Documento
- **Cuerpo:**
  > 📅 Tu resumen de {{1}} está listo. Gastos: {{2}} · Ingresos: {{3}}. En el archivo van todos los movimientos del mes. Escribe *resumen* para ver cómo va este mes.
- Ejemplos para la revisión: `octubre de 2026`, `$ 3.870.000`, `$ 5.200.000`

Cuando Meta la apruebe, pon `WHATSAPP_TEMPLATE_RESUMEN=resumen_mensual` y avísame.

---

## Fase 3 · Verificación del negocio (cuando tengas la Cámara de Comercio)

**Configuración del portafolio → Centro de seguridad → Verificación del negocio**. Quita el límite de 250 personas al día para
los mensajes que inicia Luka. Mientras tanto, todo lo demás funciona igual.

## Qué funciona hoy por WhatsApp

| Función | Estado |
|---|---|
| Fotos, PDF, notas de voz y gastos escritos | ✅ |
| Botones Confirmar / Editar / Categoría / Eliminar y lista de categorías | ✅ |
| Comandos: resumen, pendientes, metas, reporte (con archivo), plan, invitar, privacidad | ✅ |
| Entrar al panel con un enlace de un solo uso (comando **panel**) | ✅ |
| Resumen del día 1 | Con la plantilla aprobada |
| Mensajes de la prueba (día 1, 3, 10) y recordatorios de vencimiento | Pendiente: requieren plantillas (por ahora solo en Telegram) |
