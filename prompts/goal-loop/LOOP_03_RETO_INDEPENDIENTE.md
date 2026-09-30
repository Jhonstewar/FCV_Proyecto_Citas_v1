# LOOP 3 — reto independiente

El estudiante debe identificar un problema real de su implementación que **merezca** un ciclo y diseñar su Builder/Verifier.

Debe entregar:
1. disparador;
2. meta verificable;
3. estado observado/persistente;
4. alcance de Builder;
5. evidencia del Verifier;
6. presupuesto de iteraciones;
7. condición de parada;
8. condición de escalamiento humano;
9. log de ejecución;
10. justificación de por qué no bastaba un único prompt.

Posibles retos:
- reconciliar errores de contrato frontend/backend hasta que pruebas de API y build queden verdes;
- completar cobertura de reglas de agenda sin modificar comportamiento ya aprobado;
- corregir una serie acotada de issues de accesibilidad detectados automáticamente.

---

## Sección del estudiante — "Una regla, un sitio" (S4, 2026-09-30)

| Punto | Contenido |
|---|---|
| 1. Disparador | Defecto S3 de `sintesis-preguntas-abiertas` (R4): la regla de consecutividad de 60 min y el criterio de "ya empezó" estaban copiados en dominio, `application`, REST y SQL, y impedían cerrar HU-022. |
| 2. Meta verificable | Una sola implementación de cada regla; prueba de equivalencia búsqueda ↔ reserva sobre una matriz de bloques 30/60 en verde; suite completa en verde; `HexagonalArchitectureTest` en verde. |
| 3. Estado persistente | `evidencias/s4/loops/LOOP-03/` y la rama `loop/03-single-rule` (integrada en `develop` por fast-forward). |
| 4. Alcance del Builder | `domain/schedule`, `domain/appointment` (solo "ya empezó"), `JdbcAvailabilityQueries` y sus pruebas. Nada de UI ni esquema. En la iteración 2 se amplió a `SlotAllocator` y `ProfessionalScheduleController`, que eran las copias residuales. |
| 5. Evidencia del Verifier | Diff completo, suite reejecutada, prueba de equivalencia revisada con ojo crítico, arquitectura hexagonal y grep de copias residuales. |
| 6. Presupuesto | 3 iteraciones (se usaron 2). |
| 7. Parada | Todo lo anterior en verde y Verifier PASS. |
| 8. Escalamiento | Tocar esquema o cambiar cualquier respuesta de la API → BLOCKED. |
| 9. Log | `iter-1-builder.json`, `iter-2-builder.json`, `iter-2-verifier.json`. |
| 10. Justificación | Es un refactor de estructura cuyo riesgo es romper en silencio una conducta ya aprobada; solo una suite completa más una prueba de equivalencia en cada paso lo detecta, y las copias residuales solo aparecieron al verificar la iteración 1. Un prompt único habría dejado las dos copias fuera. |

**Resultado:** PASS en la iteración 2. Nueva fuente única `domain/schedule/AgendaRules` (`SLOT_MINUTES`, `isOnGrid`, `hasStarted`, `fits`); backend 487 → 500 pruebas, 0 fallos.

**Límites que quedan (del Verifier):** la equivalencia usa el día +5, así que la cláusula SQL `start_time > :nowTime` no está cubierta; el rechazo de la reserva no distingue la causa; `Specialty.SLOT_MINUTES` se tocó fuera del alcance literal (alias inocuo).
