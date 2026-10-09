"""Prototipo del intérprete de la oferta horaria pública del SIU-Guaraní de FIUBA.

Entrada: texto copiado de guaraniautogestion.fi.uba.ar/g3w/horarios_cursadas
Salida: JSON con materias -> comisiones -> (subcomisiones) -> horarios

Es un prototipo para validar el formato; la versión final va en TypeScript dentro de la app.
"""
import json
import re
import sys
import unicodedata

DIAS = {"Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"}
RE_ACTIVIDAD = re.compile(r"^Actividad: (.+) \(([A-Z0-9]+)\)$")
RE_HORA = re.compile(r"^(\d{1,2}):(\d{2}) a (\d{1,2}):(\d{2})$")
RE_DOCENTE = re.compile(r"([^,(]+?) \(([^)]+)\)")
RE_CURSO = re.compile(r"^CURSO (\w+?)\s*-\s*(.+)$", re.I)


def sede_de_aula(aula: str):
    """El aula trae la sede como sufijo: '403 - PC' (Paseo Colón), '108-LH' (Las Heras)."""
    m = re.search(r"-\s*(PC|LH|CU)\s*$", aula.upper())
    return {"PC": "Paseo Colón", "LH": "Las Heras", "CU": "Ciudad Universitaria"}.get(m.group(1)) if m else None


def a_minutos(h, m):
    return int(h) * 60 + int(m)


def parse_docentes(s):
    return [{"nombre": n.strip(), "rol": r.strip()} for n, r in RE_DOCENTE.findall(s)]


def parse(texto):
    periodo = None
    materias = []
    materia = comision = bloque = None  # bloque = comisión o subcomisión que recibe horarios
    avisos = []

    for nro, linea in enumerate(texto.splitlines(), 1):
        linea = linea.rstrip()
        if not linea:
            continue
        if linea.startswith("Período lectivo:"):
            periodo = linea.split(":", 1)[1].strip()
            continue
        m = RE_ACTIVIDAD.match(linea)
        if m:
            materia = {"codigo": m.group(2), "nombre": m.group(1).strip(), "comisiones": []}
            materias.append(materia)
            comision = bloque = None
            continue
        if linea.startswith("Comisión:"):
            nombre = linea.split(":", 1)[1].strip()
            comision = {"nombre": nombre, "subcomisiones": [], "horarios": [], "docentes": []}
            mc = RE_CURSO.match(nombre)
            comision["numero"], comision["docente_en_nombre"] = (mc.group(1), mc.group(2).strip()) if mc else (None, None)
            comision["es_condicional"] = nombre.upper().startswith("CONDICIONALES")
            materia["comisiones"].append(comision)
            bloque = comision
            continue
        if linea.startswith("Subcomisión:"):
            sub = {"nombre": linea.split(":", 1)[1].strip(), "horarios": [], "docentes": []}
            comision["subcomisiones"].append(sub)
            bloque = sub
            continue
        if ":" in linea and "\t" not in linea:
            clave, valor = (x.strip() for x in linea.split(":", 1))
            if clave == "Cupo / insc.":
                cupo, insc = (x.strip() for x in valor.split("/"))
                bloque["cupo"] = int(cupo) if cupo.isdigit() else None
                bloque["inscriptos"] = int(insc) if insc.isdigit() else None
            elif clave == "Docentes":
                bloque["docentes"] = parse_docentes(valor)
            elif clave == "Instancias":
                comision["modalidad"] = valor  # Promoción / Regularidad
            elif clave == "Observaciones":
                bloque["observaciones"] = valor
            elif clave in ("Turno", "Ubicación"):
                pass  # en esta oferta siempre "Sin definir" / "Sede Unica": no aportan información
            else:
                avisos.append(f"línea {nro}: campo desconocido '{clave}'")
            continue
        if linea.startswith("Tipo de clase"):
            continue
        partes = linea.split("\t")
        if len(partes) == 4:
            tipo, dia, horario, aula = (p.strip() for p in partes)
            if dia == "Sin definir":
                continue
            mh = RE_HORA.match(horario)
            if dia not in DIAS or not mh:
                avisos.append(f"línea {nro}: horario no interpretable '{linea}'")
                continue
            ini, fin = a_minutos(*mh.groups()[:2]), a_minutos(*mh.groups()[2:])
            # El SIU tiene errores de tipeo como "11:02 a 13:00". Solo se corrigen minutos que no son
            # múltiplos de 5 (redondeo al cuarto de hora); "19:00 a 20:15" es un horario real.
            def corregir(t):
                return round(t / 15) * 15 if t % 5 else t
            ini_r, fin_r = corregir(ini), corregir(fin)
            if (ini_r, fin_r) != (ini, fin):
                avisos.append(f"línea {nro}: horario corregido {horario}")
            bloque["horarios"].append({
                "tipo": tipo, "dia": dia,
                "inicio": f"{ini_r // 60:02d}:{ini_r % 60:02d}", "fin": f"{fin_r // 60:02d}:{fin_r % 60:02d}",
                "aula": None if "determinar" in aula.lower() else aula,
                "sede": sede_de_aula(aula),
            })
            continue
        avisos.append(f"línea {nro}: no reconocida '{linea[:60]}'")

    return {"periodo": periodo, "materias": materias}, avisos


def normalizar(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").strip()


if __name__ == "__main__":
    oferta, avisos = parse(open(sys.argv[1], encoding="utf-8").read())
    json.dump(oferta, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n".join(avisos) or "Sin avisos")
