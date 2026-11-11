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
| `sistemas-2014.json` | Lic. en Análisis de Sistemas | 2014 (oficialmente "Plan 1986 modificado en 2014"; en el SIU, "86V14") | Sí (vigente desde el 11 de noviembre de 2026; se suma con `20261113145000_sistemas_2014.sql`) |
| `sistemas-1986.json` | Lic. en Análisis de Sistemas | 1986 | Sí |

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

**Antes de usarlos en producción:** cruzar cada plan contra su resolución oficial (lista en fi.uba.ar/institucional/plan2020/planes-de-estudio-2023). Estos archivos quedan como los publica FIUBA Map, porque de ellos sale la migración de la semilla; las diferencias se corrigen en una migración aparte.

### Verificados

| Plan | Resolución | Diferencias corregidas |
|---|---|---|
| Industrial 2023 | RESCS-2023-1216, texto ordenado RCS-2024-63 | Ninguna |
| Informática 2023 | RESCS-2023-1215 | Empresas de Base Tecnológica II va en el 10.º cuatrimestre (columna 8) |
| Sistemas 2014 | PDF del plan en fi.uba.ar ("Plan 1986 modificado en 2014", actualización 2016: `cms.fi.uba.ar/uploads/Licenciatura_en_Analisis_de_Sistemas_1986_V2014_2ae2b76148.pdf`) | Ninguna (materias, créditos, correlativas, créditos requeridos, cuatrimestre sugerido, 214 créditos en total con 28 de electivas e inglés) |
| Química 2023 | RESCS-2023-1927 | "Conocimiento de Materiales I" se llama Conocimiento de Materiales Metálicos (como en el SIU); Microbiología Industrial también pide Ingeniería de Bioprocesos; Emisiones de Contaminantes y Legislación van en el 11.º cuatrimestre (columna 9) |

Se compararon materias, créditos, correlativas, créditos requeridos y cuatrimestre sugerido. Las correcciones están en `supabase/migrations/20261016180000_verified_plans_fixes.sql`. Ninguno de los tres planes agrupa sus electivas por área: las de Química e Informática se muestran en una sola lista (las áreas de Industrial salen del diseño).

## Al sumar un plan

La semilla original (`20261015120100_seed_plans.sql`) no se toca. El plan nuevo se agrega a `planes.json` con `"migration": "<AAAAMMDDHHMMSS_nombre>"` y su migración se genera con `node tools/plans-seed/build.mjs --plan <id> > supabase/migrations/<AAAAMMDDHHMMSS_nombre>.sql`. Si pasa a ser el vigente, el plan anterior queda con `"current": false` y `"current_until": "<AAAAMMDDHHMMSS_nombre>"`: la semilla lo sigue cargando como vigente y la migración nueva le saca la marca. El workflow "Base de datos" comprueba que la semilla y estas migraciones estén al día. Después, sumarlo a `data/siu/exam-filters.json` (fechas de examen) y actualizar los conteos de `tools/db-test/security.sql`.

## Al sumar una carrera

Junto con el plan, hay que cargar la tabla de equivalencias de su resolución en `data/sedes/equivalencias.json`, para completar las sedes que el SIU no publica. Cómo, en `data/sedes/README.md`.
