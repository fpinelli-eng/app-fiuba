"""Extract the ESTUDIANTES block of the FIUBA academic calendar PDF to JSON.

The FIUBA "Calendario Académico" is published once a year as a one-page PDF
where everything (including the text) is vector drawings, so there is no text
to read. It is a Gantt table: one row per activity and one column per week
(the Monday of each week; activities run Monday to Saturday). Shaded cells are
light-blue filled rectangles; grid lines are stroked lines; section header rows
("CALENDARIO ACADÉMICO", "ESTUDIANTES", "DOCENTES", ...) are grey rectangles.

This script only reads the ESTUDIANTES block (between the "ESTUDIANTES" and the
"DOCENTES" header rows). Since the row labels are drawings, their titles are
listed in TITLES below, top to bottom: check them against the PDF each year.

Needs PyMuPDF (`pip install pymupdf`). Run it from a neutral directory, e.g.:

    cd "$TEMP" && python -E path/to/tools/calendar/extract.py \
        path/to/Calendario.pdf 2026-01-05 path/to/data/calendario/2026-2027.json

Arguments: the PDF, the Monday of the first week column, and the output file.
The output is a list of {title, starts_on (Monday), ends_on (Saturday of the
last week), sort (row index)}, one entry per run of contiguous weeks.
Then run `node tools/calendar/build.mjs` (see data/calendario/README.md).
"""

import datetime
import json
import sys

import pymupdf

# Rows of the ESTUDIANTES block, top to bottom (from the 2026-2027 PDF).
TITLES = [
    "Período de Clases",
    "Evaluaciones Parciales",
    "Evaluaciones Parciales - 1ra. recuperación",
    "Evaluaciones Parciales - 2da. recuperación",
    "Período para completar encuestas estudiantiles",
    "Evaluaciones Integradoras",
    "Presentación de Certificados de Trabajo / Discapacidad",
    "Publicación de oferta horaria de asignaturas para cursar",
    "Publicación de Prioridades para Inscripción a Asignaturas a Cursar",
    "Inscripción para Cursar Asignaturas",
    "Desinscripción de Asignaturas",
    "Inscripción para Evaluaciones Integradoras",
    "Admisión de estudiantes del CBC",
    "Período de postulaciones de movilidad académica saliente",
    "Período de Solicitud de Prórrogas de Asignaturas Vencidas",
    "Período de Solicitud de Excepciones de Correlatividades",
    "Recepción de otros trámites (para el cuatrimestre siguiente)",
    "Publicación de oferta horaria de cursos de verano",
    "Inscripción para Cursos de Verano 2027",
    "Desinscripción de Cursos de Verano",
    "Inicio de los Cursos de Verano",
    "Recepción de trámites de simultaneidad entre carreras de FIUBA",
    "Período para abonar el trámite de convalidación para el siguiente cuatrimestre",
    "Período para mesas de examen especiales",
    "Charla de Ingresantes",
    "Charla de Bienvenida a estudiantes de movilidad académica",
]

BLUE = (0.55, 0.70, 0.89)


def close(color, target, tol=0.03):
    return color is not None and all(abs(a - b) <= tol for a, b in zip(color, target))


def cluster(values, tol=1.0):
    """Sorted values, merging the ones closer than tol (keeps the mean)."""
    out = []
    for v in sorted(values):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(g) / len(g) for g in out]


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    pdf, first_monday, out_path = sys.argv[1:]
    first_monday = datetime.date.fromisoformat(first_monday)
    if first_monday.weekday() != 0:
        sys.exit(f"{first_monday} is not a Monday")

    page = pymupdf.open(pdf)[0]
    drawings = page.get_drawings()

    # Section header rows: outlined (stroked) full-width rectangles, one per
    # header row (they also have a grey background).
    headers = []
    for d in drawings:
        if d["type"] in ("s", "fs"):
            for item in d["items"]:
                if item[0] == "re" and item[1].width > 500:
                    headers.append((item[1].y0, item[1].y1))
    headers.sort()
    # Header rows: [0] "CALENDARIO ACADÉMICO", [1] "ESTUDIANTES", [2] "DOCENTES".
    top, bottom = headers[1][1], headers[2][0]

    # Grid: stroked horizontal and vertical lines.
    hlines, vlines = [], []
    table_x0 = table_x1 = None
    for d in drawings:
        if d["type"] not in ("s", "fs"):
            continue
        for item in d["items"]:
            if item[0] != "l":
                continue
            a, b = item[1], item[2]
            if abs(a.y - b.y) < 0.5 and abs(a.x - b.x) > 500:
                hlines.append(a.y)
                table_x0 = min(a.x, b.x) if table_x0 is None else min(table_x0, a.x, b.x)
                table_x1 = max(a.x, b.x) if table_x1 is None else max(table_x1, a.x, b.x)
            elif abs(a.x - b.x) < 0.5 and abs(a.y - b.y) > 300:
                vlines.append(a.x)

    # Row bands of the ESTUDIANTES block.
    ys = [top] + [y for y in cluster(hlines) if top + 1 < y < bottom - 1] + [bottom]
    rows = list(zip(ys, ys[1:]))
    if len(rows) != len(TITLES):
        sys.exit(f"Found {len(rows)} rows in ESTUDIANTES, expected {len(TITLES)}: update TITLES")

    # Week columns: vertical lines to the right of the activity names column
    # (the first vertical line after the table's left border).
    xs = [x for x in cluster(vlines) if x > table_x0 + 5]
    cols = list(zip(xs, xs[1:]))
    print(f"{len(rows)} rows, {len(cols)} week columns", file=sys.stderr)

    # Shaded cells -> set of week indexes per row.
    weeks = {i: set() for i in range(len(rows))}
    for d in drawings:
        if not close(d.get("fill"), BLUE):
            continue
        r = d["rect"]
        # A rectangle can span several rows (e.g. two rows with the same
        # dates) and several weeks: it covers every row band and every week
        # column whose center is inside it. Rectangles of other sections
        # cover no band of this one.
        for i, (y0, y1) in enumerate(rows):
            if not r.y0 - 0.5 <= (y0 + y1) / 2 <= r.y1 + 0.5:
                continue
            for j, (x0, x1) in enumerate(cols):
                if r.x0 - 0.5 <= (x0 + x1) / 2 <= r.x1 + 0.5:
                    weeks[i].add(j)

    events = []
    for row, ws in weeks.items():
        run = []
        for j in sorted(ws) + [None]:
            if run and (j is None or j != run[-1] + 1):
                start = first_monday + datetime.timedelta(weeks=run[0])
                end = first_monday + datetime.timedelta(weeks=run[-1], days=5)
                events.append({
                    "title": TITLES[row],
                    "starts_on": start.isoformat(),
                    "ends_on": end.isoformat(),
                    "sort": row,
                })
                run = []
            if j is not None:
                run.append(j)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{len(events)} events -> {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
