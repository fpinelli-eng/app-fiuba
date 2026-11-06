// Colores y sedes del calendario de la cursada del Inicio (columnas por día en la computadora, lista
// en el celular). Misma paleta y orden que el calendario del plan.

export const PALETTE = [
  "bg-lavender text-lavender-ink border-lavender-ink/25",
  "bg-mint text-mint-ink border-mint-ink/25",
  "bg-butter text-butter-ink border-butter-ink/25",
  "bg-sky text-sky-ink border-sky-ink/25",
  "bg-peach text-peach-ink border-peach-ink/25",
  "bg-pink text-pink-ink border-pink-ink/25",
  "bg-teal text-teal-ink border-teal-ink/25",
];

/** Punto de color de cada materia en la lista del celular (mismo orden que PALETTE, tono más vivo). */
export const DOT = [
  "bg-cat-required",
  "bg-cat-final",
  "bg-cat-cbc",
  "bg-sky-ink",
  "bg-cat-elective",
  "bg-pink-ink",
  "bg-teal-ink",
];

export const CAMPUS_NAME = { PC: "Paseo Colón", LH: "Las Heras", CU: "Ciudad Universitaria" } as const;
