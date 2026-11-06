import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app";

// Para "Agregar a inicio" en el celular (Android). En el iPhone usa apple-icon.png.
// Los colores son los del ícono (azul noche), no de un tema: el manifiesto no lee variables CSS.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: "/",
    display: "standalone",
    background_color: "#1f2537",
    theme_color: "#1f2537",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
