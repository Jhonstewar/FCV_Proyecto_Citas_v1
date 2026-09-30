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

## 2. LOOP_02 guiado avanzado — reprogramación (2026-09-25 / 2026-09-30)

**Prompt:** `prompts/goal-loop/LOOP_02_GUIADO_AVANZADO.md`. **Presupuesto:** 4 iteraciones.
**Cerrado en 3.** Builder: `backend-domain` + `frontend-ui`. Verifier: `backend-verifier` y
`frontend-verifier`, aislados, sin permiso de edición.

| Iteración | Builder | Backend | Frontend | Verifier | Resultado |
|---|---|---|---|---|---|
| 1 | completado | 471/471 | 212/212 | frontend **PASS**; backend **interrumpido** por la pausa del usuario | `ITERATION_2_REQUIRED` |
| 2 | D38 + D39 | 480/480 | 218/218 | frontend **PASS**; backend **PASS al comportamiento / FAIL a la DoD** | `ITERATION_3_REQUIRED` |
| 3 | documentos + invariante | **484/484** | 218/218 | — | **PASS** |

Los dos riesgos que el §5 del plan señalaba como más peligrosos quedaron **descartados con prueba, no
con argumento**: aprobar una reprogramación actualiza la reserva **en sitio** (la prueba compara
`created_at` antes y después, que un delete+insert cambiaría, y otra lanza dos reservas concurrentes
contra la franja nueva: ambas reciben 409), y el libro de slots sigue teniendo **tres** tenedores,
verificado por inventario completo de las mutaciones.

**Lo que el loop enseñó, y es lo que hay que recordar de S4.** El `backend-verifier` no se limitó a
comprobar que la derivación de D39 funciona —funcionaba—: verificó **la razón escrita** en el javadoc,
y era **falsa**. Al simular la violación, `HistoryEventTest` y `HexagonalArchitectureTest` **seguían
en verde**: la suite entera pasaba con la mentira dentro. Se cerró con dos pruebas nuevas,
`HistoryRowInvariantTest` (reflexión sobre los productores de transiciones) y
`HistoryWritersArchitectureTest` (bytecode: quién puede componer una fila de historial).

**Una prueba verde no dice que el razonamiento sea correcto; solo dice que ese camino no se rompió.**

Y al tirar del hilo de por qué D22 había decidido escribir historial en un rechazo, la justificación
no venía del PRD: venía de que **EP-008 reformuló RF-19** —«todo cambio de estado de cita» se
convirtió en «cada decisión»— y sobre esa reformulación se construyó una decisión, luego un criterio
de aceptación, luego código, y finalmente un defecto que el paciente veía en pantalla («Aprobada ·
Motivo: \<motivo del rechazo\>»). Una palabra cambiada en una épica, cuatro capas más abajo. Corregido
como **D40**, con aprobación directa del usuario.

Logs: `evidencias/s4/loops/LOOP-02/` (iteraciones 1, 2 y 3, con fase roja y los dos veredictos).

## 3. Guía de prueba manual en el navegador (la ejecuta una persona)

Es el último paso de F10 y **nadie la ha ejecutado todavía**. Cubre los tres roles y el pendiente que
S2 dejó abierto (registro → login → cierre de sesión en navegador real).

### Paso 0 — comprobar que los puertos concuerdan (imprescindible)

El `.env` de la raíz **no viaja en git**, así que en una máquina que venga de un `git pull` puede
tener valores anteriores a `dafb0fa`. Si los puertos no concuerdan, la aplicación no funciona y en
pantalla se ve como «no pudimos contactar al servidor», que es un síntoma engañoso. Compruébalo
**sin abrir el fichero**:

```powershell
docker compose ls                    # el proyecto debe decir fcv-citas-v1, no fcv-citas-training
docker port fcv-citas-v1-mysql       # debe dar 3308
docker port fcv-citas-v1-api-dev     # debe dar 8081
```

`citas-web/.env.example` apunta a `http://localhost:8081` y `vite.config.ts` fija el **5174** con
`strictPort`. Si `API_PORT` no es 8081, el frontend llama a un puerto donde no hay nadie; si el
origen del navegador no coincide con `FRONTEND_ORIGIN`, el backend responde un fallo de CORS que en
la interfaz parece un problema de red. Alinea `COMPOSE_PROJECT_NAME`, `MYSQL_PORT`, `API_PORT`,
`REACT_PORT` y `FRONTEND_ORIGIN` con `.env.example` antes de seguir.

### Preparación

```powershell
cd "<raíz del workspace>"
# .env de la raíz: ADMIN_BOOTSTRAP_EMAIL y ADMIN_BOOTSTRAP_PASSWORD con valores propios (D5)
# y PASSWORD_RESET_EXPOSE_TOKEN=true para poder probar la recuperación sin SMTP (D27)
docker compose up -d mysql
.\scripts\init-test-db.ps1
docker compose run --rm --service-ports citas-api-dev mvn spring-boot:run   # terminal 1
cd citas-web; npm ci; npm run dev                                          # terminal 2, :5174
node scripts/e2e-smoke.mjs                                                 # terminal 3, datos de demostración
```

`spring-boot:run` **no recarga** el código: si el backend venía corriendo, párralo y arráncalo de nuevo.

### Casos

| # | Rol | Pasos | Resultado esperado |
|---|---|---|---|
| 1 | — | Registro con afiliación a un plan, cierre de sesión, login | Entra; el perfil muestra plan, EPS y régimen. **Cierra el pendiente de S2** |
| 2 | — | Recuperar contraseña: pedir enlace, abrirlo, fijar una nueva | Con `PASSWORD_RESET_EXPOSE_TOKEN=true` aparece el enlace rotulado «Dato de laboratorio». Tras el éxito **la sesión de esa pestaña queda cerrada** y «Iniciar sesión» lleva al formulario, no a la aplicación |
| 3 | PACIENTE | Agendar general, ver el detalle, cancelar | La franja vuelve a ofrecerse; el historial muestra la cancelación con origen `USER` |
| 4 | PACIENTE | Solicitar reprogramación de una cita aprobada | La cita **sigue vigente**; el detalle muestra franja actual y propuesta |
| 5 | ADMIN | Bandeja: aprobar la reprogramación | La cita se mueve sin duplicarse; la línea de tiempo la rotula **«Reprogramada»**, no «Aprobada» |
| 6 | ADMIN | Bandeja: rechazar otra reprogramación con motivo | La cita se conserva; el paciente ve el motivo en el aviso, y el historial **no** gana ninguna fila |
| 7 | PACIENTE | Tras el rechazo, «Conservar mi cita» | No se escribe nada. Si la cita ya empezó, el aviso **no** ofrece cancelar |
| 8 | PROFESIONAL | Agenda, pestaña «Citas» del día y de la semana | Ve nombre, tipo y número de documento del paciente. **Ni email ni teléfono** (D35) |
| 9 | PROFESIONAL | Cerrar una atención cuyo paciente tiene reprogramación pendiente | La confirmación **avisa** de que se cancelará la solicitud y se liberará la franja propuesta |
| 10 | PROFESIONAL | Intentar cerrar una cita que aún no ha empezado | El botón está desactivado y dice desde cuándo se podrá (D19) |
| 11 | ADMIN | EPS: crear, editar, desactivar, y borrar una referenciada | El borrado responde 409 y **ofrece desactivar en su lugar** (D28) |
| 12 | ADMIN | Plan activo de una EPS desactivada | El badge dice **«Activo · no se ofrece»**, y el selector del perfil no lo lista |
| 13 | PACIENTE | Perfil: cambiar de plan y luego quitar la afiliación | Son dos acciones distintas; quitar pide confirmación. Email y documento **no** se pueden editar (D25) |
| 14 | — | Vista móvil real (≤ 390 px) en los tres roles | Las tablas pasan a tarjetas; sin scroll horizontal. Quedó pendiente desde S4 porque Edge headless no baja de 492 px de viewport |

Resultado de la prueba manual: _pendiente, lo registra el usuario._
