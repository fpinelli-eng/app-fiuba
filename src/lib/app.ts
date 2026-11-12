// Nombre de la app (decidido el 6 de noviembre de 2026). El logo dibujado está en src/components/Logo.tsx.
export const APP_NAME = "FIUBI";

// Mail de contacto (política de privacidad y SECURITY.md). ImprovMX lo reenvía a los dos
// administradores: ningún mail personal queda publicado. Se cambia solo acá.
export const CONTACT_EMAIL = "contacto@fiubi.com.ar";

// Menú principal. En la computadora va todo en la barra superior; en el celular, las secciones con
// `mobile: "tab"` van en la barra de abajo y las de `mobile: "top"` como ícono en la barra de arriba.
// `icon` es el nombre del ícono en src/components/icons.tsx.
export const NAV = [
  { href: "/", label: "Inicio", icon: "home", mobile: "tab" },
  { href: "/mapa", label: "Mapa", icon: "map", mobile: "tab" },
  { href: "/plan", label: "Plan", icon: "calendar", mobile: "tab" },
  { href: "/resenas", label: "Reseñas", icon: "star", mobile: "tab" },
  { href: "/finales", label: "Finales", icon: "exam", mobile: "tab" },
  { href: "/novedades", label: "Novedades", icon: "bell", mobile: "top" },
] as const;

export type NavIcon = (typeof NAV)[number]["icon"];
