import type { NextConfig } from "next";

/**
 * Encabezados de seguridad para todo el sitio.
 * frame-ancestors: el panel solo se puede incrustar en Telegram Web (Mini App), en ningún otro sitio
 * (evita que otra página lo muestre escondido para engañar al usuario: clickjacking).
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; base-uri 'self'; object-src 'none'; form-action 'self' https://checkout.wompi.co" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La importación del presupuesto sube un Excel de hasta 2 MB
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
