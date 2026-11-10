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
    // Las secciones del menú se precargan enteras (prefetch del Header) y se reusan hasta 10 min.
    // No llegan a vencer: el Header las renueva cada 4 min, y guardar algo las refresca al
    // instante (router.refresh / revalidatePath).
    staleTimes: { static: 600 },
  },
};

export default nextConfig;
