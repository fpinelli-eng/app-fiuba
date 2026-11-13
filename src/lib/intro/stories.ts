// Content of the welcome stories (src/components/WelcomeStories.tsx): a welcome, one story per
// section of the app and a last one with where to start. Pure data, so it is easy to edit.
import type { NavIcon as NavIconName } from "@/lib/app";

/** Icon of a story: the one of its section (the same as in the menu) or one drawn for the stories. */
export type StoryIcon = NavIconName | "phone" | "monitor" | "check";

export interface Story {
  id: string;
  /** Icon next to the title, or null for the welcome (it shows the six sections instead). */
  icon: StoryIcon | null;
  title: string;
  text: string;
  /** Two or three short things it is useful for. */
  points: string[];
  /** The points are steps to follow in order: they are numbered. */
  numbered?: boolean;
  /** Step by step to add the app to the phone home screen, instead of the points. */
  steps?: Record<Platform, string[]>;
  /** Palette of the story: one of the pastel tokens of globals.css. */
  tone: "butter" | "sky" | "mint" | "lavender" | "peach" | "pink" | "teal";
}

export type Platform = "ios" | "android";

/** Seconds each story stays before going to the next one. */
export const STORY_SECONDS = 7;

/**
 * The stories, in order. needsOffer: the student's plan has no course offer for the current term,
 * so one extra story asks them to upload it from the SIU (only to them).
 */
export function welcomeStories(firstName: string, opts: { needsOffer?: boolean; term?: string | null } = {}): Story[] {
  const sections: Story[] = [
    {
      id: "inicio",
      icon: "home",
      title: "Inicio",
      text: "Cómo venís en la carrera, de un vistazo.",
      points: ["Tus créditos y cuánto te falta", "Tu promedio", "Tu cursada y tus finales pendientes"],
      tone: "sky",
    },
    {
      id: "mapa",
      icon: "map",
      title: "Mapa",
      text: "Todas las materias de tu plan y cómo se encadenan.",
      points: ["Tocá una materia", "Marcá cómo la tenés y tu nota", "Cambia de color y se habilitan las que siguen"],
      tone: "mint",
    },
    {
      id: "plan",
      icon: "calendar",
      title: "Plan",
      text: "Armá tu cuatrimestre con la oferta del SIU.",
      points: ["Elegí los cursos que te interesan", "Mirá cómo queda tu semana", "Si dos cursos se pisan, te avisa"],
      tone: "butter",
    },
    {
      id: "resenas",
      icon: "star",
      title: "Reseñas",
      text: "Lo que opinan otros alumnos de cada curso. Sumá las tuyas: ayudan al que viene.",
      points: ["El puntaje de cada curso", "Los comentarios de quienes lo cursaron", "Dejá la tuya: es anónima y lleva un minuto"],
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
      text: "Lo que pasa en la facultad. En el celular, en la campanita de arriba.",
      points: ["Avisos importantes", "El calendario académico: lo de ahora y lo que viene", "Noticias de la FIUBA"],
      tone: "teal",
    },
  ];
  return [
    {
      id: "bienvenida",
      icon: null,
      title: firstName ? `¡Hola, ${firstName}!` : "¡Hola!",
      text: "Te damos la bienvenida a FIUBI: tu carrera en la FIUBA, en un solo lugar.",
      points: ["En un minuto te mostramos cada sección"],
      tone: "pink",
    },
    ...sections,
    {
      id: "resenar",
      icon: "star",
      title: "Reseñá tus materias",
      text: "Es lo que más ayuda al que viene atrás. Contá cómo fue cada curso: con un par de líneas alcanza.",
      points: ["Entrá a Reseñas, buscá la materia y elegí el curso", "Poné las estrellas y, si querés, un comentario", "Es anónima: nadie ve quién la escribió"],
      tone: "peach",
    },
    ...(opts.needsOffer
      ? [
          {
            id: "oferta",
            icon: "calendar" as const,
            title: "Subí la oferta de tu carrera",
            text: `Todavía no tenemos los cursos de tu carrera${opts.term ? ` para el ${opts.term}` : ""}. Si los subís, el Plan funciona para vos y para toda tu carrera.`,
            points: [
              "En la compu, abrí la oferta de comisiones de tu carrera en el SIU Guaraní",
              "Seleccioná toda la página y copiala (Ctrl+A y Ctrl+C)",
              "En FIUBI, pegala en Plan y tocá Enviar: la revisamos y la publicamos",
            ],
            numbered: true,
            tone: "butter" as const,
          },
        ]
      : []),
    {
      id: "instalar",
      icon: "phone",
      title: "Tenela como app",
      text: "Agregá FIUBI a la pantalla de inicio y abrila como cualquier app, sin pasar por el navegador.",
      points: [],
      steps: {
        ios: ["Abrí FIUBI en Safari", "Tocá Compartir: el cuadrado con la flecha para arriba", "Elegí “Agregar a inicio” y tocá “Agregar”"],
        android: ["Abrí FIUBI en Chrome", "Tocá los tres puntitos de arriba a la derecha", "Elegí “Agregar a la pantalla principal” o “Instalar app” y confirmá"],
      },
      tone: "sky",
    },
    {
      id: "web",
      icon: "monitor",
      title: "Mejor en la compu",
      text: "FIUBI también es una web. En pantalla grande, el Mapa y el Plan se ven mucho mejor, sobre todo para armar el cuatrimestre.",
      points: ["Entrá a fiubi.com.ar desde cualquier navegador", "Con tu misma cuenta @fi.uba.ar", "Lo que cargás en uno aparece en el otro"],
      tone: "lavender",
    },
    {
      id: "listo",
      icon: "check",
      title: "¡A usarla!",
      text: "Desde el Inicio, entrá al Mapa y marcá las materias que ya aprobaste: lo demás se acomoda solo.",
      points: ["Reseñá lo que ya cursaste: ayuda a todos", "Esta bienvenida queda en Perfil, por si querés volver a verla"],
      tone: "mint",
    },
  ];
}
