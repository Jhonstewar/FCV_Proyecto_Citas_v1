# Evidencias — Sesión S4

Evidencia por ejecución de la sesión S4 (`GUIA_SESIONES_S2_S6.md` §S4, observabilidad). Cada loop
guarda un JSON por iteración en `evidencias/s4/loops/LOOP-0N/`.

## 1. LOOP_01 guiado — doble reserva (2026-09-25)

**Prompt:** `prompts/goal-loop/LOOP_01_GUIADO_SIMPLE.md`. **Presupuesto:** 3 iteraciones.
**Builder:** `backend-persistence`. **Verifier:** `backend-verifier`, aislado, sin permiso de edición.

La doble reserva ya estaba resuelta desde S3, así que el escenario de la guía ("existe una prueba
roja") se **preparó de forma controlada y declarada**. En el árbol de trabajo, sin commit, se
cambió `SlotReservationJpaEntity#isNew()` de `return true` a `return slotId == null`. Parece una
limpieza idiomática, pero con el id asignado hace que Spring Data use `merge`, y una segunda
reserva **sobrescribe** la fila ajena en vez de chocar con la PK.

| Iteración | Builder | Pruebas | Verifier | Resultado |
|---|---|---|---|---|
| 0 | — (defecto sembrado) | `BookingIntegrationTest` 15 / **3 fallos** (201 ≠ 409) | — | rojo confirmado |
| 1 | encuentra la causa raíz a partir de la prueba roja; cambio de 1 línea | 42/42 (`Booking*`, `AdminDecision*`, `VerificationGaps*`) | **PASS** | **COMPLETED** |

Al terminar, `git diff -- src/` está vacío: el código quedó idéntico a `HEAD`.

**Lo que el loop enseñó:**
- Las dos pruebas **concurrentes pasan con el defecto puesto**. En una carrera, ninguno de los
  `SELECT` del `merge` ve la fila, así que la PK choca igual. La regresión solo la detectan las
  tres pruebas **secuenciales**, y nadie lo sabía.
- Ninguna prueba unitaria fija que `isNew()` devuelva `true`. Pasa a F2.

Logs: `evidencias/s4/loops/LOOP-01/iter-0.json`, `iter-0-red.log`, `iter-1.json`.
