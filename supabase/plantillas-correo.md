# Plantillas de correo de Luka (Supabase → Authentication → Emails → Templates)

Los enlaces apuntan a `/auth/confirm` de la app, que abre la sesión y lleva a la página correcta.
Copia cada asunto y cuerpo en su plantilla y guarda.

## Confirm signup (confirmar cuenta)

**Asunto:** `Confirma tu cuenta de Luka`

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0a3254">
  <h2>¡Hola! Bienvenido a Luka 👋</h2>
  <p>Confirma tu correo para empezar a llevar las cuentas de la casa desde el chat.</p>
  <p style="margin:28px 0">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/bienvenida"
       style="background:#037f3d;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
      Confirmar mi correo
    </a>
  </p>
  <p style="color:#475569;font-size:13px">Si no creaste una cuenta en Luka, ignora este correo.</p>
</div>
```

## Reset password (recuperar contraseña)

**Asunto:** `Crea una contraseña nueva para Luka`

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0a3254">
  <h2>Recupera tu acceso a Luka</h2>
  <p>Pediste crear una contraseña nueva. El enlace vence en 1 hora.</p>
  <p style="margin:28px 0">
    <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nueva-clave"
       style="background:#037f3d;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">
      Crear contraseña nueva
    </a>
  </p>
  <p style="color:#475569;font-size:13px">Si no lo pediste, ignora este correo: tu contraseña no cambia.</p>
</div>
```
