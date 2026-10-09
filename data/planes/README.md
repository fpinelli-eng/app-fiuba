# Planes de estudio

Archivos JSON copiados de [FIUBA Map](https://github.com/FdelMazo/FIUBA-Map) (`src/data/`, commit `b549897`, 31 de agosto de 2026). Licencia MIT: ver `LICENSES/FIUBA-Map.txt`.

FIUBA Map nombra "2020" a los planes nuevos; el nombre oficial es 2023 o 2024. La app usa siempre el nombre oficial.

| Archivo | Carrera | Plan oficial | En la app |
|---|---|---|---|
| `bioingenieria-2020.json` | Bioingeniería | 2024 | Sí (vigente) |
| `civil-2020.json` | Ing. Civil | 2023 | Sí (vigente) |
| `civil-2009.json` | Ing. Civil | 2009 | Sí |
| `electronica-2020.json` | Ing. Electrónica | 2023 | Sí (vigente) |
| `electronica-2009.json` | Ing. Electrónica | 2009 | Sí (tiene orientaciones: para más adelante) |
| `agrimensura-2020.json` | Ing. en Agrimensura | 2023 | Sí (vigente) |
| `agrimensura-2006.json` | Ing. en Agrimensura | 2006 | Sí |
| `alimentos-2020.json` | Ing. en Alimentos | 2024 | Sí (vigente) |
| `alimentos-2000.json` | Ing. en Alimentos | 2001 | Sí |
| `energia-electrica-2020.json` | Ing. en Energía Eléctrica | 2024 | Sí (vigente) |
| `electricista-2009.json` | Ing. en Energía Eléctrica (como Ing. Electricista) | 2009 | Sí |
| `informatica-2020.json` | Ing. en Informática | 2023 | Sí (vigente) |
| `informatica-1986.json` | Ing. en Informática | 1986 | Sí (tiene orientaciones: para más adelante) |
| `petroleo-2020.json` | Ing. en Petróleo | 2023 | Sí (vigente) |
| `petroleo-2015.json` | Ing. en Petróleo | 2015 | Sí |
| `industrial-2020.json` | Ing. Industrial | 2023 | Sí (vigente) |
| `industrial-2011.json` | Ing. Industrial | 2011 | Sí |
| `mecanica-2020.json` | Ing. Mecánica | 2024 | Sí (vigente) |
| `mecanica-1986.json` | Ing. Mecánica | 1986 | Sí |
| `naval-2020.json` | Ing. Naval | 2024 | Sí (vigente) |
| `naval-1986.json` | Ing. Naval (como Ing. Naval y Mecánica) | 1986 | Sí |
| `quimica-2020.json` | Ing. Química | 2023 | Sí (vigente) |
| `quimica-1986.json` | Ing. Química | 1986 | Sí |
| `sistemas-1986.json` | Lic. en Análisis de Sistemas | 1986 | Sí (vigente) |
| `sistemas-2014.json` | Lic. en Análisis de Sistemas | 2014 | **No, a confirmar:** la web oficial solo publica el plan 1986 |

Quedan afuera Ing. Civil 1986 e Ing. Electricista 1986: existen oficialmente, pero FIUBA Map no los tiene cargados.

## Formato

Cada archivo es una lista de materias con estos campos:

- `id`: código de la materia según FIUBA Map (no siempre coincide con el código del SIU).
- `materia`: nombre.
- `creditos`: créditos que da.
- `categoria`: "Materias Obligatorias", "Materias Electivas", "Fin de Carrera…", "*CBC" (cada materia del CBC) o "CBC" (el nodo que agrupa al CBC).
- `level`: cuatrimestre sugerido (columna del mapa). `-1` = materias del CBC, `0` = nodo CBC.
- `correlativas`: ids de las materias requeridas, separados por guiones (`"CBC66-CBC62"`).
- `requiere`: créditos aprobados requeridos.
- `requiereCBC`: si pide el CBC completo.

**Antes de usarlos en producción:** cruzar cada plan contra su PDF oficial en fi.uba.ar/grado/carreras/…/plan-de-estudios.
