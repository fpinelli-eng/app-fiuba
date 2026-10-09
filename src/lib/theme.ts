// Tema: se guarda en localStorage con la clave "tema" ("claro" | "oscuro" | "sistema").
// El valor por defecto es "claro". El script corre antes de pintar la página para evitar el parpadeo.
export const THEME_KEY = "tema";

export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"claro";var d=t==="oscuro"||(t==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
