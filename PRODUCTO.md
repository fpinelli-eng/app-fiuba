# App integral FIUBA — Documento de producto

**Versión 0.5 · 9 de octubre de 2026 · Autor: Francisco**
Nombre definitivo de la app: a definir.

Este documento define *qué* es la app y *por qué*. El diseño visual está terminado en el lienzo de Claude Design "App FIUBA — Diseño" (ver sección 7). Cómo se programa en detalle se define en la etapa 3 (arquitectura). Está pensado para vivir en la raíz del repositorio, así Claude Code lo lee como referencia en cada sesión de desarrollo.

---

## 1. Problema y propuesta

La FIUBA no ofrece una herramienta oficial para seguir tu carrera. Los alumnos usan tres páginas sueltas, hechas por estudiantes:

| Herramienta | Qué resuelve | Limitación principal |
|---|---|---|
| FIUBA Map | Correlativas, créditos, materias aprobadas | Se ingresa con el padrón, sin contraseña: cualquiera que conozca tu padrón puede modificar tus datos |
| FIUBA Plan | Armar el calendario semanal del cuatrimestre | Cada alumno tiene que copiar y pegar su SIU para cargar horarios |
| FIUBA Reviews | Puntajes y comentarios de docentes | No sabe qué materias tenés habilitadas ni qué cursos estás evaluando |

Ninguna habla con las otras. El alumno hace la integración en su cabeza: mira qué tiene habilitado en Map, busca horarios en Plan y consulta Reviews en otra pestaña.

**Propuesta:** una sola web, con cuenta personal, donde tus materias aprobadas definen qué podés cursar, eso filtra los cursos que aparecen en el plan del cuatrimestre, y cada curso muestra su puntaje de reseñas. Encima de eso, un panel con tu avance y tu promedio.

## 2. Principios

1. **Todo conectado.** Cada dato que el alumno carga una vez sirve en todas las pantallas.
2. **El diseño es un pilar, no una terminación.** La app compite contra herramientas gratuitas que ya funcionan. La gente se va a cambiar por la claridad, la estética y lo rápido que resuelve el problema.
3. **Datos confiables.** Una interfaz hermosa con correlativas mal cargadas o horarios viejos no sirve. Cada fuente de datos tiene un responsable y un proceso de actualización.
4. **Gratuita y sin fines de lucro.** Sin publicidad ni monetización.
5. **Escritorio primero.** La versión 1 se diseña para computadora. Celular, solo si la demanda lo justifica.
6. **Minimalismo.** Sin textos explicativos de relleno: la interfaz se tiene que entender sola.

## 3. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance | Las 13 carreras de grado de FIUBA y 24 planes de estudio (ver sección 9). Quedan afuera Civil 1986 y Electricista 1986, que FIUBA Map no tiene cargados |
| Carreras por cuenta | **Una sola.** No se contempla doble carrera |
| Login | "Iniciar sesión con Google" con la cuenta institucional @fi.uba.ar. El mail tiene la forma inicial del nombre + apellido (por ejemplo, `fpinelli@fi.uba.ar`). Nombre, apellido y foto se toman de la cuenta de Google; si no llegan, se preguntan una vez |
| Dispositivo | Solo computadora en la versión 1 |
| Horarios | Los carga el administrador una vez por cuatrimestre y por plan; los alumnos no pegan nada |
| Modelo | Gratuito, ad honorem |
| Formato | Página web pública con dominio propio, independiente de Claude |
| Reseñas: qué se califica | Cada **curso**, no cada docente ni la cátedra en conjunto. Una misma cátedra puede tener cursos con prácticas muy distintas, y el alumno muchas veces no recuerda los nombres de los ayudantes |
| Reseñas: formato | Puntaje de 1 a 5 estrellas obligatorio; comentario de texto opcional |
| Reseñas: anonimato | **Siempre anónimas.** Si un alumno borra su cuenta, sus reseñas quedan publicadas, desvinculadas de cualquier usuario |
| Reseñas: fuente | Propias, desde cero. No se usan los datos de FIUBA Reviews |
| Reseñas: recolección | Las reseñas pendientes bloquean el plan del cuatrimestre hasta completarlas, como la encuesta del SIU antes de inscribirse |
| Reseñas: moderación | Sin sistema de reportes. Filtro automático al escribir + revisión manual del administrador (eliminar o fijar) |
| Datos de planes | Se reutilizan los JSON de FIUBA Map (licencia MIT), verificados contra los PDF oficiales |

**Web o aplicación:** web. Para uso en computadora es lo natural, y una web se puede convertir más adelante en una "PWA" (se instala en el celular desde el navegador, sin pasar por las tiendas de apps) sin reescribirla.

### Dirección visual

- Fondo lavanda muy suave (#F3F2F9), tarjetas blancas, paleta pastel sin colores estridentes; acento violeta suave (#5B5BD6). Texto #24243A, texto secundario #5D5E76, bordes #E2E0EE.
- Tipografía: IBM Plex Sans, con números de ancho fijo. Sin tipografías monoespaciadas.
- Colores de estado: aprobada = verde menta (#D6F1E3 / #1F4D36); final pendiente = amarillo manteca (#FFF1C7 / #5A4310); cursando = celeste (#DCEBFB / #2F4F73); habilitada = blanco con borde #8F8DAE; bloqueada = gris #EEEDF3 con borde punteado. Pendientes y avisos = durazno (#FFE3D3 / #8A3A18). Estrellas #E8B23A.
- Calendario semanal de lunes a sábado, de 7 a 23 h. Cada materia recibe un color pastel distinto, que se mantiene en toda la app.
- Mapa de la carrera: diagrama por columnas de cuatrimestre (estilo FIUBA Map) sin flechas. Al tocar una materia se abre una ficha con lo que necesita, lo que habilita, el estado y la nota; las correlativas se resaltan y el resto se atenúa. Créditos con la etiqueta "C". Para aprobar una materia hay que elegir la nota. Electivas en un panel lateral lavanda agrupadas por área. El CBC se puede compactar en un solo módulo (compactado por defecto cuando está completo). La prueba de inglés es un requisito marcable (Aprobada / Pendiente) en la columna del 8.º cuatrimestre, sin créditos ni nota.
- Panel de inicio: avance, promedio (incluye CBC), cuadro "Materias" (aprobadas incluyendo CBC y estado de la prueba de inglés), calendario de la cursada y cuadro "Finales pendientes" con lo que destraba cada final.
- Plan del cuatrimestre (antes "Armador"; pestañas "Opción A / Opción B"): lista de materias habilitadas con sus cursos (número de curso primero, debajo hasta 3 docentes y luego horario y sede), puntaje de reseñas, vista previa al pasar el mouse, avisos de superposición y de traslado apurado entre sedes. Las clases asincrónicas no van a la grilla: se listan en una franja aparte y no generan avisos.
- Modo oscuro: paleta "Nocturno" (fondo #111117, tarjetas #1A1A23, texto #ECECF3, acento #A3A1FA). Se elige en el perfil (Claro / Oscuro / Según el sistema). Se implementa cambiando los colores base, sin rediseñar cada pantalla.

## 4. Usuarios

- **Alumno:** cualquier estudiante de grado de FIUBA. Es el usuario principal.
- **Administrador:** Francisco (y colaboradores que él sume). Carga la oferta horaria cada cuatrimestre, corrige planes y modera reseñas.

## 5. Funcionalidades

**MVP** = lo mínimo para lanzar. **Después** = mejoras para versiones siguientes.

### 5.1 Perfil y avance

| Funcionalidad | Etapa |
|---|---|
| Elegir carrera y plan de estudios (las opciones de plan dependen de la carrera; el vigente viene marcado) | MVP |
| Cambiar de carrera o plan desde el perfil; las materias pasan según las equivalencias oficiales | MVP |
| Marcar materias: aprobada (con nota obligatoria), final pendiente, cursando | MVP |
| Porcentaje de avance por créditos, total y por categoría (CBC, obligatorias, electivas, trabajo final) | MVP |
| Promedio general (incluye CBC, sin aplazos) | MVP |
| Requisitos que no son materias (prueba de inglés) | MVP |
| Foto de perfil (de Google o subida por el alumno) | MVP |
| Ver y editar las reseñas propias | MVP |
| Descargar mis datos y borrar la cuenta | MVP |
| Elección de orientación (Informática 1986, Electrónica 2009) | Después |
| Importar materias desde FIUBA Map | Después, opcional |
| Promedio con aplazos | Después |
| Proyección: "si cursás X materias por cuatrimestre, te recibís en…" | Después |

### 5.2 Mapa de correlativas

| Funcionalidad | Etapa |
|---|---|
| Diagrama por cuatrimestres con estados: aprobada, final pendiente, cursando, habilitada, bloqueada | MVP |
| Clic en una materia: ficha con correlativas, lo que habilita, estado y nota | MVP |
| Buscador de materias | MVP |
| Primera carga guiada: la ficha recorre las materias en orden y cada toque de nota avanza a la siguiente | MVP |
| Resaltar el camino crítico | Después |

### 5.3 Plan del cuatrimestre

| Funcionalidad | Etapa |
|---|---|
| Lista de materias que podés cursar, calculada desde tu perfil | MVP |
| Cursos de cada materia con docentes, horarios, sede y puntaje de reseñas | MVP |
| Calendario semanal con superposiciones marcadas | MVP |
| Dos alternativas (Opción A / Opción B) | MVP |
| Mostrar la modalidad: promoción o regularidad | MVP |
| Aviso de traslado entre sedes (Paseo Colón / Las Heras) sin tiempo para viajar | MVP |
| Clases asincrónicas fuera de la grilla, sin avisos de superposición | MVP |
| Bloqueado mientras haya reseñas pendientes | MVP |
| Indicador de demanda (inscriptos sobre cupo) | Después |
| Generador automático de combinaciones sin superposición | Después |
| Bloquear horarios propios (trabajo, pasantía) | Descartado |

### 5.4 Reseñas

| Funcionalidad | Etapa |
|---|---|
| Buscador de cursos por materia o docente, con todas las materias del plan (aunque no tengan reseñas) | MVP |
| Ficha de curso: puntaje promedio, distribución de estrellas, otros cursos de la materia, comentarios; las reseñas fijadas aparecen primero como "Destacada" | MVP |
| Reseñar un curso: 1 a 5 estrellas obligatorio + comentario opcional (hasta 500 caracteres) | MVP |
| Solo pueden reseñar quienes cursaron ese curso según su perfil; una reseña por alumno, curso y cuatrimestre | MVP |
| Reseñas pendientes en dos fechas fijas por año (principios de julio y de diciembre) | MVP |
| Filtro automático al escribir: bloquea insultos, teléfonos, mails, links y usuarios de redes (@usuario) | MVP |
| Criterios desglosados además del puntaje general | Después |
| Resumen automático de comentarios | Después |

### 5.5 Administración

| Funcionalidad | Etapa |
|---|---|
| Cargar la oferta **por carrera y plan** pegando el texto del SIU; tablero con el estado de cada plan (sin cargar / procesado / publicado) | MVP |
| Cursos con cambios respecto del cuatrimestre anterior: "mismo curso que…", "curso nuevo" o "no mostrar", con la opción sugerida ya marcada. Se puede publicar sin revisar nada | MVP |
| Materias del SIU que no están en el plan: se informan y se ignoran | MVP |
| Oferta publicada editable: quitar o volver a mostrar cursos; reemplazar todo el plan con otro texto | MVP |
| Fecha de reseñas pendientes del cuatrimestre | MVP |
| Lista de todas las reseñas con buscador: eliminar (con deshacer) y fijar | MVP |
| Editar materias, correlativas y créditos de un plan | MVP |
| Métricas de uso | Después |

## 6. Recorrido principal del alumno

1. **Entra** a la web y toca "Ingresar con tu cuenta @fi.uba.ar". Si la cuenta no es de FIUBA, ve un aviso y puede probar con otra.
2. **Elige carrera y plan.**
3. **Carga sus materias en el mapa:** la ficha arranca en la primera materia del CBC; elige la nota (o Final pendiente / Cursando / Sin cursar) y pasa sola a la siguiente. Toca "Listo" cuando termina.
4. **Ve su panel:** avance, promedio, materias, calendario y finales pendientes.
5. **Arma su cuatrimestre** en el Plan, con horarios y puntajes, y guarda dos opciones.
6. **Al terminar la cursada** (julio o diciembre) le aparecen las reseñas pendientes, que desbloquean el plan del cuatrimestre siguiente.

El paso 6 cierra el círculo: cada alumno que usa la app alimenta las reseñas que ayudan al siguiente.

## 7. Pantallas (diseño terminado)

Lienzo de Claude Design "App FIUBA — Diseño". Las marcadas "(se puede usar)" son prototipos interactivos.

1. **Ingreso:** login y elección de carrera y plan.
2. **Cuenta rechazada:** aviso al ingresar con un mail que no es @fi.uba.ar.
3. **Primera carga de materias:** el mapa vacío con la carga guiada.
4. **Inicio:** modo día y modo oscuro.
5. **Mapa de la carrera.**
6. **Plan del cuatrimestre** y **Plan bloqueado** (con reseñas pendientes).
7. **Reseñas:** buscador de cursos, ficha de un curso y reseñas pendientes.
8. **Perfil y configuración:** foto, carrera y plan, apariencia, mis reseñas, descargar datos, borrar cuenta. Pie con "Hecho por estudiantes. No es un sitio oficial de la universidad."
9. **Administración:** oferta del cuatrimestre por plan y reseñas.

Pendiente de diseño, sin frenar el desarrollo: modo oscuro del resto de las pantallas (sale de la paleta) y orientaciones.

## 8. Modelo de datos (conceptual)

```
Carrera ─< Plan ─< Materia ─< Correlatividad (materia → materia requerida, o créditos mínimos)

Usuario ─ cursa → un solo Plan
Usuario ─< MateriaUsuario (estado, nota, cuatrimestre)

Cuatrimestre ─< PublicaciónOferta (plan, estado: sin cargar / procesada / publicada, fecha)
Cuatrimestre ─< Oferta de curso (materia, docentes, sede, visible sí/no)
Oferta de curso ─< Horario (día, inicio, fin, aula, tipo)
Oferta de curso ─ es una instancia de → Curso (identidad estable entre cuatrimestres)

Usuario ─< Cursada (oferta de curso, resultado)
Reseña (curso, cuatrimestre, estrellas 1-5, comentario opcional, fijada sí/no, autor opcional)
```

**Reseñas y borrado de cuentas:** la reseña guarda una referencia al autor solo para evitar duplicados y permitir editarla. Si la cuenta se borra, esa referencia se elimina y la reseña queda publicada sin autor.

**El punto más delicado del modelo es la identidad del curso entre cuatrimestres.** Las reseñas se escriben sobre el curso que alguien hizo en un cuatrimestre pasado, pero se consultan al elegir el curso del cuatrimestre siguiente. El SIU publica una oferta nueva cada vez, y la numeración de los cursos puede cambiar.

Lo que muestra la oferta real del 2C 2026 (Industrial):

- Cada comisión se llama "CURSO NN - APELLIDO DEL TITULAR". En 32 de 201 cursos hay subcomisiones de práctica que llevan además el apellido del jefe de trabajos prácticos ("CURSO 01A - VARGAS/TORLASCO").
- **Propuesta:** la identidad estable es *materia + docentes*. Al cargar la oferta, la app empareja sola los cursos que mantienen sus docentes; los dudosos (cambio de docentes, curso nuevo que comparte un docente con uno anterior) se le muestran al administrador con una opción sugerida.
- Las comisiones "CONDICIONALES" no tienen horario y no se muestran en el plan.
- Hay 37 comisiones con sufijo "i" ("CURSO 01i") con el mismo horario y docentes que su curso base y un cupo de unos 10 lugares. Se tratan como el mismo curso.

Otro punto a resolver: los códigos de materia cambian entre planes, y FIUBA Map no usa los códigos oficiales del SIU (usa abreviaturas propias, como "AL" para Álgebra Lineal, que en el SIU es CB002). Hay que construir una tabla de correspondencias. Comparando por nombre, 54 de las 61 materias de la oferta de Industrial coinciden exactamente con el plan de Map.

## 9. Fuentes de datos

| Dato | Fuente | Licencia / condición | Actualización |
|---|---|---|---|
| Planes, materias, créditos, correlativas, cuatrimestre sugerido | Archivos JSON de FIUBA Map, verificados contra los PDF oficiales de cada plan (fi.uba.ar/grado/carreras/…/plan-de-estudios) | MIT: incluir su aviso de licencia en el repositorio | Los planes viejos no cambian; los vigentes los actualiza el administrador |
| Oferta horaria | Página pública de horarios del SIU-Guaraní de FIUBA, una por carrera y plan | Dato público de la facultad | Una vez por cuatrimestre y por plan: el administrador copia y pega, la app lo interpreta. Validado con la oferta de Industrial del 2C 2026: 61 materias, 201 cursos y 442 bloques de horario |
| Intérprete del texto del SIU | Propio (`parser_siu.py`), con el `siuparser` de FIUBA Plan (MIT) como referencia | MIT | Se adapta si el SIU cambia de formato |
| Reseñas | Propias, generadas por los alumnos | — | Continua |
| Materias y notas de cada alumno | El propio alumno | — | Continua |

**Planes incluidos (24).** El primero de cada carrera es el vigente. Los nombres son los oficiales; FIUBA Map llama "2020" a los planes 2023/2024.

| Carrera | Planes |
|---|---|
| Bioingeniería | 2024 |
| Ing. Civil | 2023, 2009 |
| Ing. Electrónica | 2023, 2009 |
| Ing. en Agrimensura | 2023, 2006 |
| Ing. en Alimentos | 2024, 2001 |
| Ing. en Energía Eléctrica | 2024, 2009 (como Ing. Electricista) |
| Ing. en Informática | 2023, 1986 |
| Ing. en Petróleo | 2023, 2015 |
| Ing. Industrial | 2023, 2011 |
| Ing. Mecánica | 2024, 1986 |
| Ing. Naval | 2024, 1986 (como Ing. Naval y Mecánica) |
| Ing. Química | 2023, 1986 |
| Lic. en Análisis de Sistemas | 1986 |

## 10. Stack técnico preliminar

Se detalla y justifica en la etapa 3. Punto de partida:

- **Frontend:** Next.js (React + TypeScript), el mismo ecosistema de FIUBA Map.
- **Estilos:** Tailwind CSS, con los colores del diseño definidos una sola vez (claro y oscuro).
- **Base de datos y login:** Supabase (PostgreSQL + autenticación con Google). Cambios de estructura siempre como migraciones dentro del repositorio.
- **Hosting:** Vercel, con una vista previa por cada pull request.
- **Dominio:** propio. Un `.com.ar` se registra en NIC Argentina.

**Detalle de seguridad importante:** Google permite *sugerir* que se use una cuenta @fi.uba.ar, pero eso no alcanza como control. El servidor tiene que verificar el dominio del mail en cada inicio de sesión y rechazar cualquier otro.

## 11. Privacidad y aspectos legales

- La app guarda datos personales (notas, materias, mail, foto). En Argentina eso cae bajo la Ley 25.326 de Protección de Datos Personales. Mínimo necesario: política de privacidad clara, guardar solo lo indispensable, permitir descargar los datos y borrar la cuenta.
- Las reseñas se muestran anónimas, pero el sistema sabe quién las escribió mientras la cuenta existe. Al borrar la cuenta, las reseñas quedan publicadas sin autor. La política de privacidad tiene que decir las dos cosas.
- **No es un sitio oficial de la universidad.** Se aclara en el pie de página y no se usa el logo de la facultad ni de la UBA.
- Licencia MIT de FIUBA Map y FIUBA Plan: alcanza con incluir su aviso de licencia en el repositorio. El crédito visible en la web es opcional (por ejemplo, en una página "Acerca de").

## 12. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Pocas reseñas al lanzar | El plan muestra cursos sin puntaje al principio | Reseñas pendientes obligatorias; campaña de difusión; mostrar "sin reseñas todavía" sin penalizar al curso |
| Reseñas de baja calidad por obligación | Puntajes poco informativos | Exigir solo estrellas; mostrar la cantidad de reseñas junto al promedio; el administrador elimina las vacías o sin sentido |
| Vínculo entre ofertas de un mismo curso mal resuelto | Puntajes asignados al curso equivocado | Emparejamiento automático por docentes + revisión del administrador con opción sugerida |
| Correlativas desactualizadas | Pérdida de confianza | Verificación contra los PDF oficiales antes de lanzar |
| Reseñas ofensivas o con publicidad | Problemas con docentes y reputación de la app | Login institucional, filtro automático al escribir y revisión manual del administrador. El filtro no detecta críticas duras sin insultos (eso es aceptable) ni publicidad sin datos de contacto |
| Dependencia de una sola persona para cargar horarios | Si Francisco no puede, el cuatrimestre queda sin horarios | Documentar el proceso y sumar un segundo administrador |
| Baja adopción | El proyecto no cumple su objetivo | Diseño como diferencial, difusión en centros de estudiantes y grupos de cada carrera |

## 13. Decisiones abiertas

1. **Nombre y dominio.**
2. **Criterios de calificación:** ¿solo estrellas generales, o criterios adicionales opcionales?
3. **Lic. en Análisis de Sistemas:** la web oficial solo muestra el plan 1986 (versión 2016); FIUBA Map tiene además un plan 2014. Confirmar con alguien de la carrera.
4. **Google Workspace:** confirmar que las cuentas @fi.uba.ar entregan nombre y foto al iniciar sesión con Google.
5. **Equivalencias entre planes:** conseguir las tablas oficiales para el cambio de plan desde el perfil.
6. **Cursos con sufijo "i":** significado desconocido; mientras tanto se tratan como el mismo curso.

### Decisiones cerradas

- **Disparador de reseñas:** fin de cursada, en dos fechas fijas por año (principios de julio y principios de diciembre), configurables por el administrador.
- **Qué se bloquea:** el plan del cuatrimestre, hasta completar las reseñas pendientes.
- **Materias históricas:** las aprobadas antes de usar la app quedan exentas de reseña.
- **Fin de carrera (Tesis / Trabajo Profesional):** cuenta como requisito para el avance; fuera del desarrollo inicial en lo demás.
- **Sedes:** sufijo "PC" = Paseo Colón, "LH" = Las Heras.
- **Primer ingreso (7 de octubre):** sin pantalla aparte de carga de materias; la carga se hace en el mapa.
- **Moderación (7 de octubre):** sin reportes de usuarios.
- **Doble carrera (9 de octubre):** no se contempla.
- **Reseñas al borrar la cuenta (9 de octubre):** quedan publicadas, anónimas.

## 14. Próximos pasos

1. ~~Analizar la oferta del SIU~~ Hecho: intérprete de prueba funcionando (`parser_siu.py`).
2. ~~Etapa 2, diseño visual~~ Hecho (9 de octubre de 2026).
3. **Repositorio en GitHub** con este documento, un `CLAUDE.md`, el intérprete del SIU, los planes de FIUBA Map con su licencia y referencias al diseño. Sumar al segundo desarrollador como colaborador.
4. **Etapa 3, arquitectura:** esquema de base de datos, login y estructura del proyecto.
5. **Etapa 4, construcción con Claude Code:** primero la base común (login, base de datos, colores y componentes), después dividir por áreas: mapa y planes; plan del cuatrimestre y parser del SIU; reseñas y administración.
