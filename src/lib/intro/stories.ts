// Content of the welcome stories (src/components/WelcomeStories.tsx): a welcome, one story per
// section of the app and a last one with where to start. Pure data, so it is easy to edit.
import type { NavIcon as NavIconName } from "@/lib/app";

export interface Story {
  id: string;
  /** Icon of the section (the same as in the menu), or null for the welcome and the last one. */
  icon: NavIconName | null;
  /** Small label over the title ("Sección 1 de 6"). */
  kicker: string;
  title: string;
  text: string;
  /** Two or three short things it is useful for. */
  points: string[];
  /** Step by step to add the app to the phone home screen, instead of the points. */
  steps?: Record<Platform, string[]>;
  /** Palette of the story: one of the pastel tokens of globals.css. */
  tone: "butter" | "sky" | "mint" | "lavender" | "peach" | "pink" | "teal";
}

export type Platform = "ios" | "android";

/** Seconds each story stays before going to the next one. */
export const STORY_SECONDS = 7;

export function welcomeStories(firstName: string): Story[] {
  const sections: Omit<Story, "kicker">[] = [
    {
      id: "inicio",
      icon: "home",
      title: "Inicio",
      text: "Tu avance de un vistazo, cada vez que entrás.",
      points: ["Créditos aprobados y cuánto te falta", "Tu promedio", "Lo que estás cursando y los finales pendientes"],
      tone: "sky",
    },
    {
      id: "mapa",
      icon: "map",
      title: "Mapa",
      text: "Todas las materias de tu plan y cómo se encadenan.",
      points: ["Tocá una materia", "Elegí cómo la tenés (aprobada, cursando, final) y tu nota", "Se pinta de su color y se habilitan las que siguen"],
      tone: "mint",
    },
    {
      id: "plan",
      icon: "calendar",
      title: "Plan",
      text: "Armá tu cuatrimestre con la oferta del SIU.",
      points: ["Tocá los cursos que te interesan de la oferta del SIU", "Mirá cómo queda tu semana", "Si dos cursos se pisan, te avisa"],
      tone: "butter",
    },
    {
      id: "resenas",
      icon: "star",
      title: "Reseñas",
      text: "Lo que opinan otros alumnos de cada curso.",
      points: ["El puntaje de cada curso", "Lo que comentan otros alumnos", "Cuando terminás de cursar, dejá la tuya: es anónima"],
      tone: "peach",
    },
    {
      id: "finales",
      icon: "exam",
      title: "Finales",
      text: "Las fechas de examen de tus materias.",
      points: ["Día y horario de cada mesa", "Cuándo abre y cierra la inscripción", "Hasta cuándo te podés dar de baja"],
      tone: "lavender",
    },
    {
      id: "novedades",
      icon: "bell",
      title: "Novedades",
      text: "Lo que pasa en la facultad. En el celular está en la campanita de arriba.",
      points: ["Avisos importantes", "El calendario académico: lo de ahora y lo que se viene", "Noticias de la FIUBA"],
      tone: "teal",
    },
  ];
  return [
    {
      id: "bienvenida",
      icon: null,
      kicker: "",
      title: firstName ? `¡Hola, ${firstName}!` : "¡Hola!",
      text: "Te damos la bienvenida a FIUBI: tu carrera en la FIUBA, en un solo lugar.",
      points: ["En un minuto te mostramos qué hay en cada sección"],
      tone: "pink",
    },
    ...sections.map((s, i) => ({ ...s, kicker: `Sección ${i + 1} de ${sections.length}` })),
    {
      id: "instalar",
      icon: null,
      kicker: "Un truco",
      title: "Tenela como app",
      text: "Agregá FIUBI a la pantalla de inicio de tu celular y abrila como cualquier app, sin buscarla en el navegador.",
      points: [],
      steps: {
        ios: ["Abrí FIUBI en Safari", "Tocá Compartir: el cuadrado con la flecha para arriba", "Elegí \"Agregar a inicio\" y tocá \"Agregar\""],
        android: ["Abrí FIUBI en Chrome", "Tocá los tres puntitos ⋮ de arriba a la derecha", "Elegí \"Agregar a la pantalla principal\" o \"Instalar app\" y confirmá"],
      },
      tone: "sky",
    },
    {
      id: "web",
      icon: null,
      kicker: "Un consejo",
      title: "Mejor en la compu",
      text: "FIUBI también es una web. En la pantalla grande el Mapa y el Plan se ven mucho mejor: te recomendamos usarla en la compu, sobre todo para armar el cuatrimestre.",
      points: ["Entrá a app-fiuba.vercel.app desde cualquier navegador", "Con tu misma cuenta @fi.uba.ar", "Lo que cargás en uno aparece en el otro"],
      tone: "lavender",
    },
    {
      id: "listo",
      icon: null,
      kicker: "Listo",
      title: "¡A usarla!",
      text: "Desde el Inicio entrá al Mapa y marcá las materias que ya aprobaste: todo lo demás se acomoda solo.",
      points: ["Podés volver a ver esto desde Perfil"],
      tone: "mint",
    },
  ];
}
