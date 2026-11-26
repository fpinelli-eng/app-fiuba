import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las páginas: nadie puede meter la app dentro de otra página
// (clickjacking), el navegador no adivina tipos de archivo, los enlaces a otros sitios no llevan la
// dirección completa y la web no pide cámara, micrófono ni ubicación.
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Una sección precargada al pasar el mouse o apoyar el dedo (Header.tsx) sirve por 60 s. Corto a
    // propósito: el mapa ya no refresca las otras secciones al guardar, así que una precarga vieja
    // podría mostrar datos de antes de un cambio.
    staleTimes: { static: 60 },
  },
};

export default nextConfig;
