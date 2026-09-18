# Prompts para Google Stitch — S3 (flujo de citas completo)

Continúa `citas-web/docs/diseno/PROMPTS_STITCH.md` (S2). Objetivo: una interfaz **más bonita,
cálida y moderna** que la de S2, sin perder la seriedad clínica, para las pantallas de S3.

Los prompts van **en inglés** (Stitch los interpreta mejor); el texto de la interfaz va en
español porque es el idioma del producto.

## Cómo usarlo

1. En Stitch, proyecto "FCV Citas". Modo `Equilibrado` (el de mayor calidad) para el prompt 0 y
   la primera generación; modo rápido solo para retoques.
2. Pega **el prompt 0** y después las pantallas **en orden** (1 → 13). Si Stitch pierde
   coherencia, vuelve a pegar el prompt 0 antes de la pantalla.
3. Revisa cada pantalla con la lista del final. Cuando el conjunto te convenza, **apruébalo de
   forma explícita** y pasa a Google AI Studio (`citas-web/docs/diseno/HANDOFF_AI_STUDIO.md`),
   eligiendo **React + TypeScript**.
4. Lo exportado **no sustituye** el código: se reconcilia con `citas-web` (rutas, contrato
   REST y pruebas ya existen). Pásale a Claude la exportación y di "reconcilia el diseño de Stitch".

---

## Prompt 0 — Sistema visual (pegar primero)

```text
Design system for "FCV Citas", a web app to book and manage medical appointments at two
hospitals in Santander, Colombia (HIC and ICV). Three roles use it: patients (USER), doctors
(PROFESSIONAL) and administrators (ADMIN). All UI copy in Spanish (Colombia).

Design thesis: "calm, warm clinical clarity". Trustworthy like a hospital, friendly like a
modern consumer health app. Clean, airy, confident; never cold or bureaucratic. Avoid purple
gradients, glassmorphism, neon, stock-photo heroes and heavy drop shadows.

Color:
- Primary deep teal-blue #0B5C8C (hover #094A71), with a fresh accent aqua #14B8A6 used sparingly
  for highlights, progress and selected states.
- Background #F4F7FA, surfaces #FFFFFF, muted surface #EEF3F7, borders #DCE4EB.
- Text #14212B, secondary #5B6B7B.
- Status colors, always paired with an icon and a text label (never color alone):
  Solicitada/REQUESTED amber #B45309 on #FEF3C7 · Aprobada/APPROVED green #15803D on #DCFCE7 ·
  Rechazada/REJECTED red #B91C1C on #FEE2E2 · Cancelada/CANCELLED slate #475569 on #F1F5F9 ·
  Atendida/COMPLETED blue #1D4ED8 on #DBEAFE · No asistió/NO_SHOW gray #374151 on #E5E7EB.
- WCAG AA contrast everywhere. Provide a matching dark mode.

Typography: "Plus Jakarta Sans" for headings (600-700), "Inter" for body (400-500).
Scale 12/14/16/18/22/28/36 px. Generous line-height (1.55 body).

Shape & depth: 12px radius on cards, 10px on inputs and buttons, 999px only for status pills and
avatar chips. Soft layered shadow for elevated cards (0 1px 2px rgba(16,24,40,.06),
0 8px 24px rgba(16,24,40,.06)). Subtle 1px borders.

Layout: app shell with a left sidebar (240px, collapsible to a bottom tab bar on mobile), top
bar with page title, search when relevant, notifications bell and user avatar menu with
"Cerrar sesión". 8px spacing grid, content max width 1200px, 24-32px page padding.
Responsive from 360px mobile to 1440px desktop.

Components to define and reuse: primary/secondary/ghost/danger buttons (44px height), inputs with
label above and helper/error text below, select, date picker, time chips, segmented control,
stepper (numbered steps with progress bar), status pill, stat card with icon and trend,
data table that becomes stacked cards on mobile, filter bar with chips, empty state (simple
line illustration + message + call to action), skeleton loaders, toast notifications, confirm
modal, form modal, timeline (for appointment history), week calendar grid.

Iconography: rounded line icons (Lucide style), 20px, stroke 1.75.
Tone of voice: short, warm, direct. Examples: "Agenda tu cita en 3 pasos", "¡Listo! Tu cita
quedó confirmada", "Tu solicitud está en revisión".

Data is fictitious: use invented Colombian names like "Laura Gómez", "Dr. Andrés Rincón",
"Dra. Paula Serrano". Never real patients or doctors.
```

---

## Pantallas del paciente (USER)

### 1. Inicio del paciente

```text
Screen "Inicio" for a patient. Sidebar items: Inicio, Agendar cita, Mis citas.
Hero card with greeting "Hola, Laura 👋" and subtitle "¿Qué necesitas hoy?", with a large primary
button "Agendar cita" and a secondary "Ver mis citas".
Section "Próximas citas": 2-3 appointment cards showing date block (day number big, month short),
time range, specialty, doctor, hospital (HIC or ICV) and status pill (Aprobada / Solicitada).
Small info banner explaining: "Las citas generales se confirman al instante; las especializadas
las aprueba un administrador".
Empty state variant when there are no appointments.
```

### 2. Agendar cita — asistente por pasos

```text
Screen "Agendar cita" as a friendly 4-step wizard with a top stepper:
1 Tipo de cita · 2 Especialidad y sede · 3 Fecha y hora · 4 Confirmar.
Step 1: two large selectable cards: "Cita general" (icon stethoscope, "Se confirma al instante")
and "Cita especializada" (icon heart-pulse, "Requiere aprobación").
Step 2: specialty picker as searchable cards showing name and duration badge ("30 min" / "60 min");
optional filters "Sede" (HIC, ICV, Cualquiera) and "Profesional" (Cualquiera or a doctor).
Step 3: horizontal 14-day date strip where days with availability show a small dot and days
without are dimmed; below, available time chips grouped by doctor and hospital
("Dr. Andrés Rincón · HIC": 08:00, 08:30, 09:30...). Selected chip in accent aqua.
Step 4: summary card (specialty, doctor, hospital with address, date, time range, duration) and
the primary button "Confirmar cita" (general) or "Enviar solicitud" (specialized).
Sticky footer with "Atrás" and "Continuar" on mobile.
```

### 3. Resultado de la reserva

```text
Two success states for booking:
A) "¡Listo! Tu cita quedó confirmada" with green check illustration, appointment summary and
buttons "Ver mis citas" / "Agendar otra".
B) "Solicitud enviada" with amber hourglass illustration, text "Un administrador la revisará.
Te avisaremos del resultado", same summary with status pill "Solicitada".
Also an inline error variant: warning card "Esa franja acaba de ser tomada por otra persona"
with button "Elegir otro horario".
```

### 4. Mis citas y detalle

```text
Screen "Mis citas": filter chips by status (Todas, Solicitadas, Aprobadas, Rechazadas,
Canceladas) and a date filter. List of appointment cards (date block, time, specialty, doctor,
hospital, duration, status pill). Clicking opens a right-side drawer (full screen on mobile)
"Detalle de la cita" with all data, and, only when rejected, a highlighted red note
"Motivo del rechazo: ...". Below, a vertical timeline "Historial" with entries like
"Solicitada · por ti · 18 sep, 10:32" and "Rechazada · por Administración · motivo".
Empty state: "Aún no tienes citas" with button "Agendar cita".
```

## Pantallas del profesional (PROFESSIONAL)

### 5. Inicio del profesional

```text
Screen "Inicio" for a doctor (Dr. Andrés Rincón). Sidebar: Inicio, Mi agenda.
Profile card with specialties (primary one marked with a star) and assigned hospitals as chips.
Stat cards: "Bloques esta semana", "Franjas libres", "Franjas ocupadas".
Card "Tu semana" with a compact mini-calendar preview and button "Gestionar agenda".
```

### 6. Mi agenda (calendario semanal de bloques)

```text
Screen "Mi agenda": week view Monday-Sunday with navigation "‹ Semana anterior | Hoy |
Semana siguiente ›" and button "Nuevo bloque". Each availability block is a card inside the day
column, labeled with hospital (HIC / ICV color-coded chip) and time range, containing its
30-minute slots as small rows: free slots light green "Libre", taken slots gray "Ocupada".
Blocks in the past or with bookings show a lock icon and no edit actions.
Empty week state: "No tienes bloques esta semana" with "Crear bloque".
On mobile: a vertical day-by-day list instead of the grid.
```

### 7. Crear / editar bloque (modal)

```text
Modal "Nuevo bloque de disponibilidad": fields Fecha (date picker, past dates disabled),
Sede (only the doctor's hospitals), Hora inicio and Hora fin (30-minute steps).
Live helper: "Se crearán 8 franjas de 30 minutos (08:00 – 12:00)".
Inline error examples: "Se cruza con otro bloque de 10:00 a 12:00" and
"No estás habilitado en esa sede". Buttons "Cancelar" / "Guardar bloque".
Delete confirmation modal: "¿Eliminar este bloque?" with danger button.
```

## Pantallas del administrador (ADMIN)

### 8. Panel del administrador

```text
Screen "Panel" for the administrator. Sidebar: Panel, Solicitudes (with count badge),
Profesionales, Especialidades.
Stat cards with icons: "Solicitudes pendientes", "Profesionales activos",
"Especialidades activas", "Citas de hoy". Quick actions and a short list of the 5 most recent
pending requests with "Revisar" buttons.
```

### 9. Bandeja de solicitudes

```text
Screen "Solicitudes pendientes": filter bar (Sede, Profesional, Especialidad, Fecha).
Table (cards on mobile) with columns Paciente (name + document), Especialidad, Profesional,
Sede, Fecha y hora, Duración, and actions "Aprobar" (green) and "Rechazar" (red outline).
Approve opens a small confirm modal. Reject opens a modal "Rechazar solicitud" with a required
textarea "Motivo del rechazo" (counter 0/500) and a disabled confirm button until filled.
After deciding, the row fades out and a toast says "Solicitud aprobada" / "Solicitud rechazada".
Empty state: "¡Todo al día! No hay solicitudes pendientes".
```

### 10. Profesionales (listado)

```text
Screen "Profesionales": search box, filter Activo/Inactivo, button "Nuevo profesional".
Table: avatar with initials + name, código profesional, matrícula, especialidades (chips, primary
with star), sedes (HIC/ICV chips), estado (Activo/Inactivo toggle pill), actions menu
(Editar datos, Especialidades, Sedes, Desactivar).
```

### 11. Crear / editar profesional

```text
Form page "Nuevo profesional" in clear sections (cards):
1 Datos personales (nombres, apellidos, tipo y número de documento, correo, teléfono),
2 Acceso (contraseña inicial with strength hint),
3 Datos profesionales (código profesional, matrícula),
4 Especialidades (checkbox list with duration badges; radio "Principal" on the selected ones),
5 Sedes (two selectable cards: HIC and ICV with address).
Sticky bottom bar "Cancelar" / "Crear profesional". Show inline duplicate error
"Ya existe un profesional con ese código".
```

### 12. Especialidades

```text
Screen "Especialidades": table with Nombre, Código, Tipo (General / Especializada pill),
Duración (30 min / 60 min), Estado, actions (Editar, Activar/Desactivar, Eliminar).
"Medicina General" row shows a lock badge "Protegida" and no deactivate/delete actions.
Modal "Nueva especialidad": código, nombre, tipo (segmented General / Especializada),
duración (segmented 30 min / 60 min). Delete conflict message:
"Está en uso: desactívala en lugar de borrarla".
```

### 13. Acceso denegado y estados globales

```text
Small set of global states in the same style: "No tienes permiso para ver esta página"
(403, with button "Ir a mi inicio"), "Tu sesión expiró" (redirect to login), 404
"Página no encontrada", loading skeletons for list and calendar, and toast styles
(success, error, info).
```

---

## Lista de verificación antes de aprobar

- [ ] Las 13 pantallas comparten sidebar, tipografía, colores y componentes.
- [ ] Cada estado de cita tiene color **e** icono o texto.
- [ ] Móvil (360 px) usable: sidebar → barra inferior, tablas → tarjetas, asistente con pie fijo.
- [ ] Hay estados vacío, carga y error, no solo el caso feliz.
- [ ] Todo el texto de interfaz en español; datos inventados.
- [ ] Contraste AA en texto y en las insignias de estado.
