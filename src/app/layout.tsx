import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "./globals.css";
import { Header } from "@/components/Header";
import { APP_NAME } from "@/lib/app";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Tu carrera de FIUBA en un solo lugar",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
