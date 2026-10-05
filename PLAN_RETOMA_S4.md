# Plan de retoma — Sesión S4

**Creado:** 2026-09-25. Para retomar, abre Claude Code en esta carpeta y di:
*"Retoma S4 desde PLAN_RETOMA_S4.md"*. El agente busca la primera casilla sin marcar y sigue desde ahí.

S4 = **autonomía: completar el MVP con Builder/Verifier** (`GUIA_SESIONES_S2_S6.md` §S4).
Entregable mínimo: MVP S2–S4 completo, un loop guiado + uno propio con logs, DoD de las HU
abordadas validada, commit estable y, si el usuario lo decide, merge `develop → main`.

> **2026-09-25 — decisiones resueltas.** El usuario delegó la aprobación de S4 (D15), confirmó D18
> y D19, pidió analizar las pantallas actuales antes de decidir D30 (resuelta abajo) y eligió el
> LOOP_03 propuesto. El resto (D16, D17, D20–D29) queda como **decisión provisional bajo
> aprobación delegada**, igual que D5–D14 en S3: el usuario puede revertir cualquiera.

## Cómo funcionan los puntos de control

Igual que en S3. Al llegar a cada 🔖:

1. pruebas del repo tocado en verde (o anotar aquí por qué no);
2. commit en `develop` de **cada** repo tocado (`feat(s4): …`, `test(s4): …`, `docs(s4): …`);
3. casillas marcadas en este archivo y commit de la raíz;
4. entrada en `citas-api/docs/wiki/llm-wiki/wiki/log.md`.

Ningún push sin confirmación explícita del usuario.

---

## 1. Dónde quedamos (verificado el 2026-09-25)

**Repos:** los tres en `develop`, limpios salvo tres archivos de Obsidian sin commitear en
`citas-api/docs/wiki/.obsidian/` (configuración del visor, no contenido).

**Suites:** backend **242** pruebas en 24 archivos (MySQL real en Docker), frontend **88** en 11
archivos, con typecheck, lint (`oxlint`) y build. Hooks `pre-commit` activos en ambos repos.

**Scrum:** 33 HU. 16 `Completada` (HU-001..004 de S2, 12 de S3). Abiertas de S3: HU-005, HU-011,
HU-016, HU-022, HU-029 (`En validación`) y HU-033 (`En desarrollo`, viva por diseño). HU-009
`Aprobada` con solo el primer corte hecho (afiliación al registrarse). El resto está en `Borrador`.

**Adelantos de S4 ya hechos** (2026-09-23): rediseño Stitch aplicado a `citas-web`, proyecto
Docker propio (`fcv-citas-v1`, puertos 3308/8081/5174), semilla de EPS y planes por script,
HU-009 primer corte.

### Qué existe y qué falta para la funcionalidad de S4

| Capacidad (guía S4) | Backend | Frontend | HU |
|---|---|---|---|
| Mis citas | **Existe** (lista + detalle con historial) | **Existe** | HU-025 ✅ |
| Cancelación | Falta: sin método de dominio, caso de uso ni endpoint. El enum ya admite `→ CANCELLED` | Falta (hay `ConfirmDialog` reutilizable) | HU-026 |
| Reprogramación | Falta todo el código. **El esquema ya existe**: `reschedule_requests` con `active_marker` (una activa por cita) y `slot_reservations.reservation_type = 'RESCHEDULE_REQUEST'` (V3) | Falta | HU-027, HU-031, HU-028 |
| Bandeja con reprogramaciones | Solo trae `REQUESTED` | Solo `APPOINTMENT_REQUEST` | HU-029 (mitad) |
| Agenda del profesional con citas | Falta: `SlotView` solo dice libre/ocupado, sin cita ni paciente | Parcial: ve bloques y franjas | HU-020 |
| Marcar `COMPLETED` / `NO_SHOW` | Parcial: enum y origen `PROFESSIONAL` (V5) listos; falta dominio, regla temporal, caso de uso y endpoint | Falta | HU-021 |
| CRUD especialidades | **Existe** | **Existe** | HU-011 (falta única en BD) |
| CRUD EPS / planes | Falta (solo lectura pública de planes) | Falta | HU-012 |
| Recuperación de contraseña | Falta. **La tabla `password_reset_tokens` existe desde V1** y hay piezas reutilizables (`SecureTokenGenerator`, hash SHA-256, `PasswordHasher`) | Parcial: solo el paso 1, contra una "ruta supuesta" que el backend no tiene | HU-006, HU-007 |
| Perfil | Parcial: solo `GET /api/me` | Solo lectura en el inicio del paciente | HU-008 |
| Afiliación desde el perfil | Falta (`AffiliationRepository` solo tiene `saveNew`) | Falta | HU-009 (resto) |
| Historial de estados | Parcial: incrustado en el detalle de paciente y admin | Existe en el detalle | HU-032 ✅ |
| Hardening de contrato y UI | Contrato solo cubre S2–S3 | Tabla de estado de `PANTALLAS_OBLIGATORIAS.md` desactualizada; rutas del documento ≠ rutas de la app | HU-033 |

`SecurityConfig` termina en `anyRequest().denyAll()`: toda ruta nueva fuera de `/api/admin/**`,
`/api/professional/**`, `/api/patient/**` y `/api/me` (p. ej. el restablecimiento público de
contraseña o `PUT /api/me`) exige tocarlo.

### Qué hay que revisar de antes

**De S3 (bloquean cerrar HU ya implementadas):**

| # | Problema | HU | Arreglo propuesto |
|---|---|---|---|
| R1 | `specialties` sin única sobre `name`; la unicidad vive solo en `ManageSpecialtiesUseCase` | HU-011 | `V8`: `UNIQUE(name)` (la collation `utf8mb4_0900_ai_ci` la hace insensible a mayúsculas y acentos). Antes, comprobar que no hay duplicados en la base |
| R2 | Activar/desactivar profesional no es operación de dominio (`setActive` genérico) y no hay prueba de conservación de citas | HU-016 | `Professional#activate/deactivate` + prueba de integración de que las citas sobreviven |
| R3 | Ownership reimplementado a mano en tres sitios; `MeController` repite el parseo de `sub` | HU-005 | Componente único de ownership, que usarán además cancelación, reprogramación, cierre y perfil |
| R4 | Regla de 60 min consecutivos escrita dos veces (`AvailabilityBlock#canHost` y SQL de `JdbcAvailabilityQueries`); la reprogramación la necesitaría una tercera | HU-022 | Candidato a **LOOP_03** (ver F8) |
| R5 | "Qué estados liberan slots" duplicado: `AppointmentStatus.releasesSlots()` y la columna del catálogo | — | Prueba que compare ambos, o una sola fuente |
| R6 | CA-03 de HU-022 y la mitad de HU-029 dependen de retenciones por reprogramación | HU-022, HU-029 | Se cierran solos al terminar F5 |

**De S2 (pendientes que nunca se hicieron):**

- Prueba manual E2E en navegador de registro → login → cierre de sesión (la hace una persona).
- Comparar el modelo 3FN propio con la referencia en `database/reference/` (`README_DB.md`,
  `erd.mmd`, ERD). La wiki confirma que **sigue pendiente**.
- INC-001: la API acepta contraseñas que el formulario rechaza (servidor: solo máx. 72 bytes;
  cliente: mín. 8 con letra y número). Cobra relevancia en S4 porque restablecer contraseña y
  perfil vuelven a validar contraseñas.
- Decisiones D1–D14 tomadas por el agente bajo aprobación delegada, aún sin confirmar.

---

## 2. Decisiones de S4

Respondidas el 2026-09-25. Registro con alternativas en
`citas-api/docs/wiki/llm-wiki/wiki/dec-006-decisiones-s4-ciclo-de-vida.md`.
Origen: **U** = respuesta del usuario; **P** = provisional bajo aprobación delegada.

| # | Pregunta | HU | Decisión |
|---|---|---|---|
| D15 **U** | **Modo de aprobación de S4:** ¿HU por HU, o aprobación delegada como en S3? | todas | Delegada para el alcance de §3, registrada en cada HU |
| D16 **P** | INC-030 · ¿Se puede cancelar una cita `REQUESTED`? | HU-026 | Sí: RF-14 dice "futura no terminal", y el enum ya lo admite. Libera la retención |
| D17 **P** | INC-027 · ¿Antelación mínima para cancelar? | HU-026 | Ninguna: basta con que no haya empezado |
| D18 **U** | N1 · Cancelar una cita con reprogramación `PENDING` | HU-026, HU-027 | En la misma transacción, la solicitud pasa a `CANCELLED` y se liberan **ambas** franjas |
| D19 **U** | INC-018 · ¿Desde cuándo se puede cerrar como `COMPLETED`/`NO_SHOW`? | HU-021 | Desde la **hora de inicio** de la cita (se puede marcar inasistencia sin esperar al final). Sin plazo máximo. Aislado en un único punto de decisión, como pide T-02 |
| D20 **P** | INC-028 / INC-029 · Número de solicitudes y retirada | HU-027 | Una `PENDING` a la vez (el esquema ya lo impone); tras decidirse, se puede pedir otra. El paciente **no** retira su solicitud en S4 (puede cancelar la cita) |
| D21 **P** | INC-031 · ¿La reprogramación puede cambiar de sede? | HU-027 | Sí, si el profesional atiende en esa sede: el PRD solo obliga a conservar profesional y especialidad |
| D22 **P** | N3 · ¿La decisión sobre una reprogramación escribe historial, aunque la cita siga `APPROVED`? | HU-031, HU-032 | Sí: nueva fila con estado `APPROVED`, origen `ADMIN` y motivo que nombra la franja anterior y la nueva. RF-19 pide trazabilidad de todo cambio. El esquema lo admite sin migración: `appointment_status_history` guarda solo el estado nuevo (`status_id`), no el previo (V3:115) |
| D23 **P** | INC-036 · Reprogramación cuya franja propuesta ya pasó | HU-031 | Igual que D12: aprobar responde 409 y el ADMIN debe rechazar con motivo |
| D24 **P** | N6 · Filtros de la bandeja sobre una reprogramación | HU-029 | Usan la **franja propuesta**, que es lo que el ADMIN decide |
| D25 **P** | INC-006 · Campos editables del perfil | HU-008 | Editables: nombres, apellidos, teléfono. Fijos: email (es la credencial) y documento |
| D26 **P** | INC-007 · Varias afiliaciones | HU-009 | Una vigente (el esquema ya lo impone con `current_marker`). Cambiar de plan cierra la anterior con `ended_on` y abre una nueva; quitarla la cierra sin reemplazo |
| D27 **P** | INC-002 / INC-005 · Token de recuperación | HU-006, HU-007 | Vigencia 30 min, configurable por entorno. El token viaja en la respuesta solo si una variable de entorno de laboratorio lo activa; por defecto apagada. Nunca en logs |
| D28 **P** | INC-011 · Borrar EPS o plan no referenciado | HU-012 | Igual que especialidades: borrado físico si nada lo referencia; si no, 409 y se ofrece desactivar |
| D29 **P** | INC-001 · Política de contraseña | HU-001, HU-007 | Mín. 8 con letra y número **también en el servidor**, igual que el cliente. Cambio aditivo: las cuentas existentes siguen entrando |
| D30 **P** | Diseño de pantallas nuevas | frontend | **Sin mockups nuevos: se construyen con el sistema visual y los componentes existentes** (`dec-005`). Ver §2.1 |

### 2.1 Por qué D30 se resuelve sin Stitch (análisis del 2026-09-25)

- **Precedente:** 9 de las 13 pantallas protegidas se construyeron en S3 sin mockup. El rediseño
  (`08cbe02`) solo tocó tokens, CSS, `AuthLayout`, `AppShell` y el inicio del paciente, y aun así
  las demás quedaron coherentes porque se componen de los mismos componentes.
- **Sistema sólido:** `app.css` tiene 0 colores hex y 676 `var(--…)`; los TSX no llevan colores.
  Hay modo oscuro, `prefers-reduced-motion`, 18 media queries mobile-first y una `DataTable` que en
  móvil pasa a tarjetas. `Modal` y `ConfirmDialog` son accesibles (trampa de foco, `alertdialog`).
- **Especificación suficiente:** `citas-web/docs/diseno/PANTALLAS_OBLIGATORIAS.md` §3, §8, §9,
  §12, §15 y §17 definen campos, estados y acciones de las pantallas de S4, y las HU traen sus CA.
- **El prompt de Stitch de S4 no las cubre:** `PROMPT_STITCH_S4_REDISENO.md` no pide EPS, perfil,
  cierre de atención ni la bandeja de reprogramaciones.

| Pantalla nueva | Se construye como |
|---|---|
| Cancelar cita | `ConfirmDialog` en tono peligro, como eliminar bloque |
| Aviso de rechazo de reprogramación | `.note--danger` del detalle, con "Conservar" y "Cancelar" |
| Restablecer contraseña | Variante de `RecuperarPasswordPage` (`AuthLayout`) |
| CRUD EPS y planes | Variante de Especialidades (409 → desactivar); los planes en `/admin/eps/:id`, como la edición de profesional |
| Perfil con afiliación | `Card` por sección, como la edición de profesional, con el selector de plan del registro |
| Solicitar reprogramación | `DateTimeStep` del agendamiento con el profesional fijo, y un bloque "actual → nueva" |
| Bandeja de reprogramaciones | Copia de `InboxPage`, con una celda nueva "franja original → propuesta" que en móvil pasa a tarjeta |
| Agenda con citas y cierre | **El único patrón realmente nuevo.** `SegmentedControl` "Bloques / Citas" en `/profesional/agenda`, y una tarjeta de cita del profesional (paciente, hora, especialidad, `COMPLETED`/`NO_SHOW`, y el botón deshabilitado dice el motivo) |

Si al verla en el navegador la agenda no convence, se hace **un solo** mockup en Stitch para esa
pantalla. No se rediseña nada de lo ya aprobado.

**Preparación del frontend antes de F3** (deuda que el análisis sacó a la luz):
- extraer `Timeline` y `DetailItem`, hoy locales al detalle de cita, a `src/components`: los
  reutilizan la bandeja y la agenda;
- los 5 formularios de S3 en modal repiten a mano el marcado de `SubmitButton`, que solo usan
  Login, Registro y Recuperar; unificarlos;
- corregir el comentario de `tokens.css:27`: dice 4,1:1 para `#717880` y la medida real es
  **4,47:1** (bordes, WCAG 1.4.11 exige 3:1, así que cumple igual);
- la vista móvil real (≤ 390 px) no se pudo comprobar con Edge headless, que no baja de 492 px
  de viewport: queda para la prueba manual de F10.

---

## 3. Alcance: HU de S4

| Bloque | HU | Esfuerzo |
|---|---|---|
| Deuda de S3 | HU-005 (ownership), HU-011 (única), HU-016 (dominio), HU-022 (CA-03 + R4), HU-029 (mitad reprogramación) | — |
| Ciclo de vida del paciente | HU-026 cancelar · HU-027 solicitar reprogramación · HU-028 decidir tras rechazo | Medio · **Alto** · Medio |
| Operación administrativa | HU-031 aprobar/rechazar reprogramación | **Alto** |
| Profesional | HU-020 agenda con citas aprobadas · HU-021 cierre de atención | Medio · Medio |
| Catálogos | HU-012 EPS y planes | Medio |
| Cuenta | HU-006 solicitar recuperación · HU-007 restablecer · HU-008 perfil · HU-009 (resto: afiliación desde el perfil) | Medio · Medio · Bajo · Medio |
| Contrato | HU-033 (corte S4) | — |

Con esto se cubren **las 17 pantallas obligatorias** del PRD §6 y los RF-01 a RF-20.

**Fuera de S4:** automatizaciones n8n (S5–S6), CI/CD, SMTP real, cookie `HttpOnly` para el
refresh (S4 de la síntesis: pregunta abierta, no se toca sin decisión).

---

## 4. Fases

El orden sigue las dependencias de las HU: la máquina de estados y la cancelación van antes que
la reprogramación porque HU-028 reutiliza la cancelación y D18 cruza ambas.

> **Casillas saneadas el 2026-09-30, al bajar los commits de S4 a otra máquina.** Este archivo se
> escribió de una sola vez (`bc13adc`) y sus casillas habían quedado mal **en los dos sentidos**:
>
> - **F10 estaba marcada entera y no se ejecutó.** Ninguna HU pasó a `Completada` en S4 (siguen las
>   mismas 16 que al empezar), `EVIDENCIAS_S4.md` solo tiene la §1 de LOOP_01, no hay entrada `lint`
>   posterior al 2026-09-23 en `wiki/log.md` y `datos-modelo-3fn.md` sigue diciendo que la
>   comparación contra `database/reference/` está pendiente. Desmarcadas todas menos el push y el
>   merge a `main`, que sí ocurrieron.
> - **F4, F6 y F7 estaban sin marcar y su código sí está escrito**, como decía el Registro de
>   avance. Verificado endpoint por endpoint y ruta por ruta (ver cada fase). Marcadas.
>
> **Lo que una casilla `[x]` significa aquí:** el código existe y su suite estaba en verde el
> 2026-09-25. **No** significa HU verificada ni cerrada: eso es F10, y F10 no ha corrido. Las 11 HU
> de S4 siguen en `Aprobada`. Si este archivo vuelve a contradecirse, manda **"▶ Dónde retomar"**.

### F0 — Preparación y especificación

- [x] Decisiones D15–D30 respondidas (2026-09-25: D15, D18, D19 por el usuario; resto provisional bajo delegación) y D30 resuelta tras analizar las pantallas
- [x] Wiki `dec-006-decisiones-s4-ciclo-de-vida.md` creada y síntesis de preguntas abiertas actualizada
- [x] HU del §3 pasadas a `Aprobada` con línea en su historial (directa o delegada según D15), con la decisión que resuelve cada `INC` citada en sus notas (`scrum-spec-writer`)
- [x] Base verificada el 2026-09-25: backend 242/242 y frontend 88/88 en verde
- [ ] Decidir qué hacer con los tres archivos `.obsidian/` sin commitear
- [x] Carpeta de observabilidad creada: `evidencias/s4/loops/` (raíz) y `EVIDENCIAS_S4.md`

🔖 **F0** — raíz: `docs(s4): plan de retoma y alcance`; citas-api: `docs(s4): aprobar HU de S4 y decisiones`

### F1 — LOOP_01 guiado: el patrón Builder/Verifier sobre la doble reserva

Objetivo didáctico: enseñar el loop con un caso cuyo resultado correcto ya conocemos.
La doble reserva **ya está resuelta** desde S3 (`EVIDENCIAS_S3.md` §7 y §11), así que el defecto
se reintroduce de forma controlada y **declarada** en una rama temporal.

- [x] Rama `loop/01-double-booking` en citas-api; se reintroduce el defecto (p. ej. quitar el bloqueo pesimista) y se comprueba que la prueba de concurrencia sale roja
- [x] Loop con el prompt de `prompts/goal-loop/LOOP_01_GUIADO_SIMPLE.md`: **Builder** = `backend-persistence`; **Verifier** = `backend-verifier` aislado; máx. **3** iteraciones; stop = prueba de concurrencia + suite de reserva en verde; escalamiento = BLOCKED con log
- [x] Un JSON por iteración en `evidencias/s4/loops/LOOP-01/iter-N.json` con el formato de la guía (`goal`, `iteration`, `builder`, `backendTests`, `frontendBuild`, `verifier`, `result`) + causa del FAIL si lo hubo
- [x] Diff final comparado con el código de `develop`; la rama se descarta (no se mezcla) y se deja escrito en `EVIDENCIAS_S4.md` §1

🔖 **F1** — raíz: `test(s4): loop guiado de doble reserva con log por iteración`

### F2 — Deuda de S3 que desbloquea S4

- [x] R3 · Componente de ownership reutilizable; `MeController` usa `CurrentUser`; los tres usos existentes migrados (HU-005 DoD)
- [x] R1 · `V8__unique_specialty_name.sql` con comprobación previa de duplicados (HU-011)
- [x] R2 · `Professional#activate/deactivate` y prueba de conservación de citas (HU-016)
- [x] R5 · Prueba que compara `AppointmentStatus.releasesSlots()` con el catálogo sembrado
- [ ] (F10) Verificación independiente de HU-011 y HU-016 → `Completada` si su matriz queda completa

🔖 **F2** — citas-api: `fix(s4): deuda de S3 — ownership, nombre único y activación en dominio`

### F3 — Máquina de estados y cancelación (HU-026)

- [x] Dominio: `Appointment#cancel(actor, now)`, `complete`, `noShow`, con las transiciones explícitas y consultables (RN-11). Pruebas unitarias primero (Red → Green)
- [x] Caso de uso de cancelación: ownership, futura, no terminal, libera slots e historial `USER`, todo en una transacción (CA-08); D18 queda preparado para F5
- [x] `POST /api/patient/appointments/{id}/cancel` + pruebas de integración (incluye cita ajena → 404, pasada → 409, terminal → 409, la franja vuelve a ofrecerse)
- [x] Frontend: botón "Cancelar cita" en el detalle y en "Próxima cita" del inicio, con `ConfirmDialog`; tests

🔖 **F3** — citas-api `feat(s4): cancelación de citas`; citas-web `feat(s4): cancelar cita`

### F4 — Agenda del profesional y cierre de atención (HU-020, HU-021)

- [x] `GET /api/professional/appointments?date|week&siteId` solo `APPROVED` propias, con los campos mínimos del paciente que permite RF-16 (decidir y justificar la proyección en el contrato) — `ProfessionalAppointmentController:29`
- [x] `POST /api/professional/appointments/{id}/complete` y `/no-show` con la regla D19 en un único punto, historial origen `PROFESSIONAL`, atómico (CA-08) — `ProfessionalAppointmentController:61,67`
- [x] Frontend: lista de citas del día/semana en `AgendaPage` (o pestaña nueva), acciones de cierre con confirmación; tests — pestañas "Bloques"/"Citas" en `AgendaPage.tsx:246,249`
- [ ] Cierra HU-005 CA-06 (el profesional ve solo datos de sus pacientes) — pendiente: HU-005 sigue `En validación`, se cierra en F10

🔖 **F4** — citas-api `feat(s4): agenda de citas y cierre de atención`; citas-web ídem

### F5 — LOOP_02 guiado avanzado: reprogramación completa (HU-027, HU-031, HU-028 + HU-029, HU-022)

Se ejecuta con `prompts/goal-loop/LOOP_02_GUIADO_AVANZADO.md`. **Presupuesto: 4 iteraciones.**
Builder = `backend-domain` + `backend-persistence` + `frontend-api`/`frontend-ui`; Verifier =
`backend-verifier` y `frontend-verifier` aislados. **Escalamiento humano** ante cualquier migración
o dependencia no prevista (la tabla ya existe, así que no debería hacer falta).

Reglas innegociables (RN-01, RN-09, RN-10): la cita original sigue vigente mientras la solicitud
está `PENDING`; la franja nueva queda retenida; `APPROVED` libera la antigua y convierte la
retención en ocupación **sin abrir hueco** (se actualiza `reservation_type`, no se borra y se
reinserta); `REJECTED` libera la retención y conserva la cita; solo ADMIN decide.

> **LOOP_02 cerrado el 2026-09-30 en 3 iteraciones de 4.** Backend **484/484**, frontend **218/218**,
> los dos Verifier reejecutaron las suites ellos mismos. El `backend-verifier` dio **PASS al
> comportamiento** —43 criterios con evidencia— y **FAIL a la DoD** por documentos desalineados; la
> iteración 3 cerró ese FAIL. Detalle en `evidencias/s4/loops/LOOP-02/iter-2-verifier.json`.

- [x] Iteración de dominio: agregado `RescheduleRequest` con aprobar/rechazar; regla de 60 min **reutilizada**, no reescrita
- [x] `POST /api/patient/appointments/{id}/reschedule` (HU-027) + prueba de concurrencia contra una reserva normal por la misma franja — `RescheduleRequestIntegrationTest:559`
- [x] Bandeja con `type: 'RESCHEDULE_REQUEST'` y filtros según D24 (HU-029); `POST /api/admin/reschedules/{id}/approve|reject` (HU-031) con historial según **D39, que refina D22**, y CA-07 (decisión concurrente / cancelación simultánea) — `RescheduleDecisionIntegrationTest:577,603,799,848`
- [x] Detalle de la cita con la última reprogramación y su motivo; opciones "conservar" (sin escritura) y "cancelar" (reutiliza F3) (HU-028)
- [x] Búsqueda de disponibilidad excluye franjas retenidas por reprogramación (HU-022 CA-03) — `RescheduleRequestIntegrationTest:342`
- [x] Frontend: `/paciente/citas/:id/reprogramar`, bandeja admin de reprogramaciones, aviso de rechazo
- [x] Log por iteración en `evidencias/s4/loops/LOOP-02/` — iteraciones 1, 2 y 3, con fase roja y veredicto de los dos Verifier

**Los dos riesgos del §5 quedaron descartados con prueba, no con argumento:** aprobar actualiza la
reserva **en sitio** (`created_at` conservado; dos reservas concurrentes contra la franja nueva
reciben 409) y el libro de slots sigue teniendo **tres** tenedores, verificado por inventario.

**Lo que el loop enseñó, y no sale en las cifras:** el Verifier encontró que la *razón escrita* de
por qué la derivación de D39 es segura era **falsa**, aunque la conclusión fuera correcta. Al
simular la violación, `HistoryEventTest` y `HexagonalArchitectureTest` **seguían en verde**: la
suite entera pasaba con la mentira dentro. Se cerró con dos pruebas nuevas (`HistoryRowInvariantTest`
por reflexión, `HistoryWritersArchitectureTest` sobre bytecode). Una prueba verde no dice que el
razonamiento sea correcto; solo dice que ese camino no se rompió.

🔖 **F5** — citas-api `feat(s4): reprogramación con retención y decisión administrativa`; citas-web ídem; raíz: logs

### F6 — Catálogos EPS y planes, perfil y afiliación (HU-012, HU-008, HU-009)

- [x] Dominio y casos de uso de EPS y plan (crear, editar, activar/desactivar, borrar según D28); desactivar una EPS retira su oferta sin tocar afiliaciones (CA-05) — migración `V9__eps_names_and_affiliation_history.sql`
- [x] `/api/admin/eps` y `/api/admin/eps/{id}/plans`; pantalla `/admin/eps` — `AdminEpsController:26-27`, `EpsPage.tsx`
- [x] `PUT /api/me` con los campos de D25; `GET/PUT/DELETE /api/me/affiliation` con D26; `SecurityConfig` actualizado — `MeController:89,96,102`, `SecurityConfig:88`
- [x] Pantalla `/perfil` (paciente) con datos editables y afiliación — `App.tsx:74`
- [ ] Revisar si `scripts/seed-eps-plans.ps1` sigue siendo necesario o queda como semilla de laboratorio

🔖 **F6** — citas-api `feat(s4): EPS y planes, perfil y afiliación`; citas-web ídem

### F7 — Recuperación de contraseña (HU-006, HU-007)

- [x] Dominio del token (un solo uso, vigencia); reutiliza `SecureTokenGenerator` y el hash SHA-256; la tabla ya existe desde V1 (CA-08 de HU-006 se cumple con V1; se deja citado) — `domain/auth/PasswordResetToken.java`, `PasswordResetTokenRepository.java`
- [x] `POST /api/auth/password-recovery` (respuesta idéntica exista o no el email) y `POST /api/auth/password-reset` (token en el cuerpo, nunca en la ruta); exposición del token según D27 — `PasswordRecoveryController:66,73`, `SecurityConfig:38`, `LabPasswordResetNotifier`
- [x] Al restablecer: token consumido, **refresh tokens del usuario revocados**, contraseña anterior deja de servir — `ResetPasswordUseCase:70` (`RefreshToken.REASON_PASSWORD_RESET`)
- [x] Política de contraseña D29 en el servidor — `validation/PasswordPolicyCompliant.java`, `domain/.../PasswordPolicy` + `PasswordPolicyTest`
- [x] Frontend: corregir la "ruta supuesta" de `contracts.ts`; paso 2 `/restablecer-password` — `contracts.ts:65,67`, `App.tsx:47`
- [x] Prueba de que ni el token ni la contraseña aparecen en logs (HU-007 CA-09) — `AuthFlowIntegrationTest:81` con `OutputCaptureExtension`/`CapturedOutput`

🔖 **F7** — citas-api `feat(s4): recuperación de contraseña sin SMTP`; citas-web ídem

### F8 — LOOP_03 reto propio

**Elegido por el usuario el 2026-09-25:**
**"Una regla, un sitio"** — unificar las reglas de agenda duplicadas (R4: consecutividad de 60 min
en dominio y SQL, más la tercera copia que habría puesto la reprogramación; y el criterio de
"futuro" repartido en tres sitios) **sin cambiar comportamiento aprobado**.

Por qué merece un loop y no un prompt: el cambio es de estructura, el riesgo es romper en
silencio una conducta ya aprobada, y la única forma de saberlo es verificar contra la suite
completa y una prueba de equivalencia en cada paso.

Los diez puntos que exige la guía:

| Punto | Contenido |
|---|---|
| Disparador | Defecto S3 de `sintesis-preguntas-abiertas` que impide cerrar HU-022 |
| Meta verificable | Una sola implementación de cada regla; prueba de equivalencia búsqueda ↔ reserva sobre una matriz de bloques 30/60 en verde; suite completa en verde |
| Estado persistente | `evidencias/s4/loops/LOOP-03/` + rama `loop/03-single-rule` |
| Alcance Builder | Solo `domain/schedule`, `JdbcAvailabilityQueries` y sus pruebas. Nada de UI ni esquema |
| Evidencia Verifier | Diff, suite, prueba de equivalencia, `HexagonalArchitectureTest`, y búsqueda de copias residuales con grep |
| Presupuesto | 3 iteraciones |
| Parada | Todo lo anterior en verde y Verifier PASS |
| Escalamiento | Si unificar exige tocar esquema o cambia alguna respuesta de la API |
| Log | JSON por iteración |
| Justificación | Arriba |

Alternativa: reconciliar contrato frontend ↔ backend hasta que `scripts/e2e-smoke.mjs` ampliado y el build queden en verde.

- [x] Diseño del loop escrito en `prompts/goal-loop/LOOP_03_RETO_INDEPENDIENTE.md` (sección del estudiante)
- [x] Ejecución con log y resultado — PASS en 2 iteraciones; `AgendaRules`; backend 500/500; citas-api `ed1a320`

🔖 **F8** — citas-api `refactor(s4): …`; raíz: `test(s4): loop propio con log`

### F9 — Hardening de contrato y UI

- [x] HU-033 corte S4: `contrato-rest-citas.md` y `contrato-rest-identidad.md` con todos los endpoints nuevos, códigos de error y ejemplos
- [x] Errores de Spring y `WWW-Authenticate` que aún salen en inglés
- [x] `ERROR_CODES` y tipos de `contracts.ts` alineados con el backend; `API_ROUTES` sin rutas supuestas
- [x] `PANTALLAS_OBLIGATORIAS.md`: tabla de estado real y rutas de la app
- [x] `scripts/e2e-smoke.mjs` ampliado: cancelar, reprogramar (aprobar y rechazar), cerrar atención, recuperar contraseña, CRUD EPS — 74 OK/0 fallos/2 omitidos contra la API real (82 OK con `E2E_WAIT_CLOSE=true`); omitido: PLAN_REFERENCED
- [x] Revisión de accesibilidad básica y estados vacío/error/carga en las pantallas nuevas

🔖 **F9** — citas-api, citas-web: `fix(s4): hardening de contrato y UI`

### F10 — Verificación, deuda de S2 y cierre

- [x] `backend-verifier` y `frontend-verifier` HU por HU sobre todo el alcance del §3 — hecho el 2026-10-04: backend leído contra código y pruebas, frontend con vitest/typecheck/lint/build; re-verificación acotada de las 16 pruebas nuevas (8 de backend, 8 de frontend)
- [x] HU a `Completada` solo con matriz completa — 2026-10-04: **25 Completada, 7 En validación** (HU-005, 007, 009, 011, 012, 022, 028), HU-033 En desarrollo, HU-034..036 Borrador. Las 7 abiertas lo están por un único motivo cada una (ver `scrum/README.md`): casi todas esperan la prueba manual en navegador; HU-022 y HU-028 tienen además una decisión pendiente
- [x] Comparación del modelo 3FN propio contra `database/reference/` → wiki `datos-modelo-3fn` — ya hecha el 2026-09-30; reconfirmada el 2026-10-04. `database/reference/db.sql` no existe (pregunta abierta C5), así que las columnas no clave no se pueden comparar
- [ ] Guía de prueba manual en navegador con los tres roles — la guía está escrita (`EVIDENCIAS_S4.md` §3) pero **nadie la ha ejecutado**; es lo que mantiene abiertas las 7 HU de arriba
- [x] Wiki: LINT, `index.md`, `log.md` — hechos el 2026-10-04 (`lint` y `learn` en `log.md`)
- [ ] Commit de cierre en los tres repos — el 2026-10-04 se hizo un commit de verificación (`test(s4)`/`docs(s4)`), **no** el de cierre: S4 no se cierra hasta ejecutar la guía manual y decidir las 7 HU abiertas
- [x] **Decisión del usuario:** push y merge `develop → main` — hecho el 2026-09-25 (PR #3: `0ae5184` raíz, `016baae` citas-api). Se hizo **antes** de F5/F8/F9/F10, así que `main` lleva S4 a medio verificar; el usuario lo aceptó así el 2026-09-30 (pregunta abierta R2)

🔖 **F10** — push de `develop` (con confirmación) y, si se decide, merge a `main`

---

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| La aprobación de reprogramación convierte reservas: si se borra y reinserta, abre un hueco donde otra reserva se cuela | Actualizar `reservation_type` y titular en la misma fila, bajo bloqueo; prueba de concurrencia dedicada |
| Tres caminos que liberan slots (cancelar, rechazar cita, rechazar reprogramación) divergen | Un solo método de liberación en el puerto, usado por los tres |
| Pantallas nuevas sin mockup rompen la coherencia visual | D30 |
| Zona horaria en las reglas de "futuro" y "cerrable" | `riesgo-zona-horaria-columnas-time` ya documenta el caso; usar el mismo reloj `America/Bogota` |
| Prueba intermitente de Flyway | `riesgo-prueba-intermitente-flyway` |

## Registro de avance

Una línea por punto de control alcanzado (fecha · fase · commits).

- 2026-09-25 · plan creado a partir del inventario de ambos repos; pendiente de decisiones D15–D30
- 2026-09-25 · decisiones D15–D30 resueltas (delegación + D18, D19 y LOOP_03 confirmados por el usuario); D30 = sin mockups nuevos tras auditar las pantallas
- 2026-09-25 · F2+F3 backend (290 pruebas) · frontend de S4 completo contra el contrato (168 pruebas) · LOOP_01 PASS en 1 iteración · sin commits por indicación del usuario
- 2026-09-25 · F4, F6, F7 (backend 422 → 471 con F5), D36 cookie verificada contra la API real, menú lateral arreglado, hardening de frontend (212 pruebas). LOOP_02 iteración 1: Builder completed; Verifier frontend PASS; Verifier backend interrumpido por pausa del usuario
- 2026-09-25 · 🔖 **pausa pedida por el usuario**: commits de S4 en `develop` de los tres repos
- 2026-09-30 · S4 retomada en **otra máquina**: bajados 16 commits en la raíz, 28 en citas-api y 14 en citas-web desde `origin/develop` (fast-forward, los tres repos limpios). Saneadas las casillas de F4, F6, F7 y F10 contra el código real (§4). Wiki actualizada con el estado real. Decidido por el usuario: `main` se queda como está (R2)
- 2026-09-30 · 🔖 **F5 cerrada. LOOP_02 PASS en 3 iteraciones de 4.** Backend 484/484 y frontend 218/218, con los dos Verifier reejecutando las suites. Iteración 2: D38 y D39 implementados, `frontend-verifier` PASS y `backend-verifier` PASS al comportamiento / FAIL a la DoD. Iteración 3: contrato REST, HU-031, HU-032 y EP-008 alineados, y el invariante de D39 protegido con dos pruebas nuevas. HU-027, HU-028 y HU-031 pasan a `En validación` con matriz de evidencia; **ninguna a `Completada`**, porque les faltan criterios de frontend y la prueba manual de F10. Commits en los tres repos, subidos a `origin`

- 2026-09-30 · 🔖 **F8 cerrada.** LOOP_03 "una regla, un sitio" PASS en 2 iteraciones: `domain/schedule/AgendaRules` es la única fuente de "ya empezó", encaje de slots y `SLOT_MINUTES`; backend 487 → 500. Siguiente: F9 y F10

- 2026-09-30 · 🔖 **F9 cerrada.** Errores de Spring y `WWW-Authenticate` en español (backend 507), contratos REST corte S4, `ERROR_CODES`/`API_ROUTES` fijados por prueba, accesibilidad del Modal y errores de campo (frontend 234), smoke e2e ampliado y ejecutado contra la API real. Siguiente: F10

- 2026-10-04 · 🔖 **F10 casi cerrada.** Verificación independiente de todo el alcance, 16 pruebas nuevas (backend 521/521, frontend 256/256), 25 HU `Completada`, LINT y LEARN de la wiki. **Falta ejecutar la guía de prueba manual** (`EVIDENCIAS_S4.md` §3), que decide las 7 HU abiertas, y el commit de cierre

## ▶ Dónde retomar (escrito al pausar el 2026-09-25, revisado el 2026-09-30)

Di *"Retoma S4 desde PLAN_RETOMA_S4.md"*. **Estado al 2026-09-30, todo verificado en esta máquina:**
backend **484/484** y frontend **218/218**, con typecheck, `oxlint` y build limpios. **F5 cerrada**
(LOOP_02 PASS en 3 iteraciones). Si retomas en otro equipo, lee antes "Retomar en un clon que ya
existe" (abajo). Falta, en este orden:

1. ~~F8 · LOOP_03~~ cerrada el 2026-09-30 (PASS en 2 iteraciones, backend 500/500).
2. ~~F9~~ cerrada el 2026-09-30.
3. **F9 pendiente:** ampliar `scripts/e2e-smoke.mjs` (cancelar, reprogramar aprobar y rechazar,
   cierre, recuperación, EPS) y ejecutarlo contra la API real. Actualizar `contrato-rest-*` con
   el corte final.
4. **F10:** verificación independiente HU por HU. Incluye revisar las matrices de HU-001..004
   (D29, D36), HU-032 (D39) y HU-009 CA-03 (el contrato responde 200 y el criterio pide 409).
   Después, comparación 3FN contra `database/reference/`, prueba manual en navegador, LINT de la
   wiki y decisión de merge `develop → main`.
5. Pendiente del usuario: qué hacer con los 3 archivos `.obsidian/` sin commitear.

**Para probar recuperación de contraseña en el laboratorio:** añade
`PASSWORD_RESET_EXPOSE_TOKEN=true` al `.env` de la raíz y recrea el contenedor
(`docker compose up -d citas-api-dev`). Por defecto está apagado (D27).

## Retomar en un clon que ya existe (comprobado el 2026-09-30)

La sección "Retomar en otro equipo" de `PLAN_RETOMA_S2.md` cubre un **clon nuevo**. Cuando el clon ya
existe y solo se hace `git pull`, hay cuatro cosas que no se arreglan solas. Salieron todas al
retomar S4 en la máquina de escritorio:

1. **`npm ci` en `citas-web`, siempre.** S4 añadió `lucide-react` como dependencia. Con el
   `node_modules` viejo, `npm run typecheck` da `TS2307: Cannot find module 'lucide-react'` y 12 de
   los 20 ficheros de prueba fallan al transformar. No es un fallo de código: son dependencias
   desfasadas.
2. **El `.env` de la raíz no viaja en git** (está en `.gitignore`, y así debe seguir), así que
   `dafb0fa` no lo actualizó. Si `COMPOSE_PROJECT_NAME` sigue valiendo `fcv-citas-training`, los
   volúmenes se crean como `fcv-citas-training_*` y se comparten con cualquier otra copia del
   laboratorio — justo lo que `dafb0fa` quería evitar. Compruébalo sin abrir el `.env`:
   `docker compose ls` debe decir `fcv-citas-v1`, y `docker port fcv-citas-v1-mysql` debe dar
   **3308**. Si dicen `fcv-citas-training` y 3307, alinea `COMPOSE_PROJECT_NAME`, `MYSQL_PORT` y
   `API_PORT` con `.env.example`.
3. **`.\scripts\init-test-db.ps1` antes de la suite de backend.** Crea `citas_fcv_training_test`, la
   base aislada de las pruebas de integración. Sin ella las pruebas escriben en la base de
   desarrollo (el motivo está en el encabezado del script).
4. **Node 24 LTS de verdad.** Con Node 22.19 `npm ci` avisa
   `EBADENGINE react-router@8.4.0 required: { node: '>=22.22.0' }`. La suite pasa igual, pero el
   aviso es real y `AGENTS.md` pide Node 24.

Orden que funciona: `git pull` en los tres repos → arrancar Docker Desktop →
`docker compose up -d mysql` → `.\scripts\init-test-db.ps1` →
`docker compose run --rm citas-api-dev mvn -B test` → en `citas-web`, `npm ci` y luego `npm run
typecheck`, `npm run lint`, `npm run test`, `npm run build`.
