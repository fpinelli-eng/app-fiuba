// Tema: se guarda en localStorage con la clave "tema" ("claro" | "oscuro" | "sistema").
// El valor por defecto es "claro". El script corre antes de pintar la página para evitar el parpadeo.
// Además pinta la barra del navegador del celular (<meta name="theme-color">) con el color de la
// barra superior (--header de globals.css), y la repinta cada vez que cambia el tema.
export const THEME_KEY = "tema";

export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"claro";var d=t==="oscuro"||(t==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}try{var r=document.documentElement;var m=function(){var e=document.querySelector('meta[name="theme-color"]');var c=getComputedStyle(r).getPropertyValue("--header").trim();if(e&&c)e.setAttribute("content",c)};new MutationObserver(m).observe(r,{attributes:true,attributeFilter:["data-theme"]});document.addEventListener("DOMContentLoaded",m);window.addEventListener("load",m)}catch(e){}})()`;
