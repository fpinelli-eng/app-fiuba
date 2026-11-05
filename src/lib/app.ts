// Nombre de la app: cuando se defina, se cambia solo acá.
export const APP_NAME = "[NOMBRE]";

// Mail de contacto de la política de privacidad (/privacidad). Cuando se defina, se cambia solo acá.
export const CONTACT_EMAIL = "[MAIL]";

// Menú principal. En la computadora va todo en la barra superior; en el celular, las secciones con
// `mobile: "tab"` van en la barra de abajo y las de `mobile: "top"` como ícono en la barra de arriba.
// `icon` es el nombre del ícono en src/components/icons.tsx.
export const NAV = [
  { href: "/", label: "Inicio", icon: "home", mobile: "tab" },
  { href: "/novedades", label: "Novedades", icon: "bell", mobile: "top" },
  { href: "/mapa", label: "Mapa", icon: "map", mobile: "tab" },
  { href: "/plan", label: "Plan", icon: "calendar", mobile: "tab" },
  { href: "/resenas", label: "Reseñas", icon: "star", mobile: "tab" },
  { href: "/finales", label: "Finales", icon: "exam", mobile: "tab" },
] as const;

export type NavIcon = (typeof NAV)[number]["icon"];
