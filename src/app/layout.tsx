import type { Metadata, Viewport } from "next";
// Onest para el texto y Unbounded para títulos y números grandes, servidas desde el proyecto.
import "@fontsource-variable/onest";
import "@fontsource-variable/unbounded";
import "./globals.css";
import { APP_NAME } from "@/lib/app";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: APP_NAME, locale: "es_AR" },
  twitter: { card: "summary_large_image" },
};

// Celular: ancho del dispositivo y "cover" para que la barra de pestañas use env(safe-area-inset-bottom)
// en los iPhone con barra de gestos. El color de la barra del navegador (theme-color) lo pone el
// script del tema con el color de la barra superior de globals.css, así sigue al tema elegido.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <meta name="theme-color" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
