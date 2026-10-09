# Intérprete del SIU (prototipo)

Convierte el texto copiado de la página pública de horarios del SIU-Guaraní de FIUBA en JSON (materias → comisiones → subcomisiones → horarios).

```
python3 parser_siu.py ../../data/siu/industrial-2023_2C2026.txt salida.json
```

Validado con la oferta de Ing. Industrial del 2C 2026: 61 materias, 201 cursos y 442 bloques de horario.

Es un prototipo para entender el formato. La versión de producción va en TypeScript dentro de la app; los archivos de `data/siu/` sirven como casos de prueba.
