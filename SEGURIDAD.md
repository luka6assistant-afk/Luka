# Revisión de seguridad — Luka

Fecha: 6 de noviembre de 2026. Alcance: base de datos (permisos), acciones del servidor, bot de Telegram, Mini App, pagos,
archivos, rutas públicas, encabezados del sitio, dependencias y configuración de servicios.

## Riesgos encontrados y corregidos

| # | Gravedad | Riesgo | Corrección |
|---|---|---|---|
| 1 | 🔴 Alta | **Códigos de familia adivinables.** Tenían 6 caracteres hexadecimales (16 millones de opciones). Con una cuenta se podían probar todos y **entrar a cualquier familia** (ver todos sus movimientos) o, con `/vincular`, **llevarse el chat de otra familia**. | Códigos nuevos de 10 caracteres (≈ 10¹⁵ opciones), máximo 10 intentos fallidos por hora por persona, y `/vincular` ya no mueve una familia que está conectada a otro chat. |
| 2 | 🔴 Alta | **Un movimiento podía apuntar a la meta de ahorro o deuda de otra familia** y sumarle o restarle plata (y atribuirse a un miembro ajeno). | La base de datos verifica que categoría, meta, deuda y miembro sean de la misma familia; nada puede cambiar de familia. |
| 3 | 🟠 Media | **Un miembro podía crear pagos con el valor que quisiera** directamente contra la base de datos (y marcarlos como precio de fundador). | Los pagos solo los crea el servidor, con el precio que calcula él. |
| 4 | 🟠 Media | **Un administrador podía apuntar su familia al chat de otra** y dejarla sin bot. | El chat vinculado, el código y el creador de la familia solo los cambia el servidor. |
| 5 | 🟠 Media | **"Soy yo" sin verificación:** cualquier miembro podía reclamar el Telegram de otro, y esa persona terminaba entrando a la cuenta equivocada desde la Mini App. | Ahora se genera un código de un solo uso (10 min) que solo ve el dueño de la cuenta y se escribe en el grupo con `/soyyo`. |
| 6 | 🟠 Media | **Borrar un movimiento no borraba la foto del recibo** (los miembros no tenían permiso de borrar archivos y fallaba en silencio). | La foto se borra con la llave del servidor, solo si es de la misma familia. |
| 7 | 🟡 Baja | **Inyección de fórmulas en los CSV:** un comercio llamado `=HIPERVINCULO(...)` se ejecutaría al abrir el archivo en Excel. | Los textos que empiezan por `= + - @` se neutralizan. |
| 8 | 🟡 Baja | El diagnóstico `/api/health` recibía el secreto en la URL (queda en registros e historial). | Ahora va en el encabezado `Authorization`. |
| 9 | 🟡 Baja | Comparación de secretos (webhook de Telegram, tareas programadas) no era de tiempo constante. | Comparación en tiempo constante. |
| 10 | 🟡 Baja | Sin encabezados de seguridad: el panel se podía incrustar en cualquier sitio (clickjacking). | `frame-ancestors` solo permite Telegram, más `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS y sin `X-Powered-By`. |
| 11 | 🟡 Baja | Contraseñas de 6 caracteres. | Mínimo 8 en el registro. |

## Lo que se revisó y está bien

- Cada tabla tiene seguridad por filas (RLS): una familia solo ve lo suyo; los miembros no pueden darse el rol de administrador.
- La llave secreta de Supabase y las de Claude, Telegram y Deepgram solo existen en el servidor (`server-only` impide usarlas en el navegador) y no están en GitHub.
- El webhook de Telegram exige su secreto; el de Wompi verifica la firma y el monto; los pagos se aplican una sola vez.
- La Mini App verifica la firma de Telegram y que no tenga más de 1 hora.
- Los botones del bot (confirmar, editar, borrar, categoría) verifican que el movimiento sea de la familia del chat.
- Redirecciones después de iniciar sesión: solo rutas internas (`safeNext`).
- El panel del creador solo abre para los correos de `ADMIN_EMAILS`.
- Fotos de recibos en almacenamiento privado, con enlaces temporales.
- `npm audit`: 0 vulnerabilidades en dependencias de producción. Sin rastreadores de terceros.

## Pendientes tuyos (no se pueden hacer desde el código)

1. **Ejecutar en Supabase, en orden: `006_crecimiento.sql` y luego `007_seguridad.sql`.** Hasta entonces, los riesgos 1 a 5 siguen abiertos. Después:
   - Los **códigos de familia cambian**: el enlace de invitación viejo deja de funcionar; compártelo de nuevo desde Familia. El grupo ya vinculado sigue funcionando.
   - Para unir tu Telegram a tu cuenta, usa **Familia → Conectar mi Telegram**.
2. **Revocar el token del bot** que salió en una captura de pantalla: @BotFather → `/revoke` → @LukaFamiliaBot. Me pasas el nuevo por el archivo `.env.local` (no por chat) y lo cargo en Vercel.
3. **Confirmación de correo:** hoy está apagada, así que cualquiera puede registrarse con un correo ajeno. Activa "Confirm email" en Supabase y conecta un proveedor de correo (por ejemplo Resend, gratis hasta 3.000 correos al mes), porque el correo incluido en Supabase solo envía unos pocos por hora.
4. **Supabase → Authentication → Policies de contraseña:** sube el mínimo a 8 caracteres (igual que la app).
5. **Verificación en dos pasos (2FA)** en todas las cuentas de Luka: Gmail, GitHub, Vercel, Supabase, Claude, Deepgram y, cuando la tengas, Wompi.
6. **Supabase → Advisors → Security Advisor:** revísalo después de ejecutar las migraciones; debe salir sin alertas críticas.
