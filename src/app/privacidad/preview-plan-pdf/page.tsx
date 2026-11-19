import type { Metadata } from "next";
import { PlanPoster } from "@/components/PlanPoster";
import { PosterScreen } from "@/components/PosterScreen";
import type { ClassBlock, WeekDay } from "@/lib/plan/options";
import type { PosterData } from "@/lib/plan/poster";
import type { Campus } from "@/lib/siu/parser";

// TEMPORAL — BORRAR ANTES DE INTEGRAR. Vista previa pública de la lámina del plan (PlanPoster) con
// datos inventados de Industrial 2023 (cursos reales de la oferta del 2C 2026), para verla sin
// iniciar sesión e imprimirla. Está en /privacidad solo porque esa ruta es pública.

export const metadata: Metadata = { title: "Mi cuatrimestre · FIUBI", robots: { index: false } };

const h = (t: string) => {
  const [hh, mm = "0"] = t.split(":");
  return Number(hh) * 60 + Number(mm);
};
const PC: Campus = "Paseo Colón";
const LH: Campus = "Las Heras";
const b = (day: WeekDay, from: string, to: string, type: string, room: string, campus: Campus): ClassBlock => ({
  day,
  start: h(from),
  end: h(to),
  type,
  room,
  campus,
  async: false,
});

const POSTER: PosterData = {
  term: "2C 2026",
  career: "Ing. Industrial · Plan 2023",
  option: "A",
  courses: [
    {
      name: "Física de los Sistemas de Partículas",
      credits: 6,
      label: "Curso 3",
      teachers: "Aguirre",
      color: "lavender",
      blocks: [b("Martes", "10", "13", "Teórico Práctica Obligatoria", "302-PC", PC), b("Jueves", "10", "13", "Teórico Práctica Obligatoria", "302-PC", PC)],
    },
    {
      name: "Electricidad y Magnetismo",
      credits: 6,
      label: "Curso 10",
      teachers: "Pagnola",
      color: "mint",
      blocks: [
        b("Miércoles", "16", "17:30", "Teórica Obligatoria", "507 - PC", PC),
        b("Miércoles", "17:30", "19", "Práctica Obligatoria", "507 - PC", PC),
        b("Viernes", "16", "17:30", "Teórica Obligatoria", "305-PC", PC),
        b("Viernes", "17:30", "19", "Práctica Obligatoria", "305-PC", PC),
      ],
    },
    {
      name: "Estadística Aplicada",
      credits: 8,
      label: "Curso 1 · práctica A",
      teachers: "Bonoli, Gil",
      color: "butter",
      blocks: [
        b("Lunes", "14:30", "17:30", "Teórico Práctica", "16-LH", LH),
        b("Lunes", "17:30", "19:30", "Teórica", "109-LH", LH),
        b("Jueves", "14", "17", "Teórico Práctica", "16-LH", LH),
      ],
    },
    {
      name: "Economía",
      credits: 6,
      label: "Curso 4",
      teachers: "Palavecino",
      color: "sky",
      blocks: [b("Martes", "17", "23", "Teórico Práctica Obligatoria", "104-LH", LH)],
    },
    {
      name: "Estática y Resistencia de Materiales",
      credits: 6,
      label: "Curso 1 · práctica B",
      teachers: "Corral, Pujol",
      color: "peach",
      blocks: [b("Miércoles", "9", "12", "Teórica Obligatoria", "202-LH", LH), b("Viernes", "9", "12", "Práctica", "16-LH", LH)],
    },
    {
      name: "Higiene y Seguridad",
      credits: 2,
      label: "Curso 3",
      teachers: "Beltramini, Di Meglio, Marensi",
      color: "pink",
      blocks: [b("Miércoles", "14", "16", "Teórico-Práctica", "107-PC", PC)],
    },
  ],
  activities: [
    {
      name: "Ayudantía de Álgebra Lineal",
      place: "Aula 400 · PC",
      color: "sky",
      blocks: [
        { day: "Lunes", start: h("9"), end: h("11") },
        { day: "Jueves", start: h("18"), end: h("20") },
      ],
    },
  ],
};

export default function PreviewPlanPdfPage() {
  return (
    <PosterScreen backHref="/plan">
      <PlanPoster poster={POSTER} date="19 de noviembre de 2026" />
    </PosterScreen>
  );
}
