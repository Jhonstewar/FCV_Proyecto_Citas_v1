# Prompts Stitch — rediseño S4 ("warm clinical premium")

Reemplaza la dirección visual de `PROMPT_STITCH_S3.md`. Uso: pegar el maestro primero y luego una
pantalla por prompt en el mismo proyecto de Stitch. Resultado exportado en
`citas-web/docs/diseno/stitch/` (ver `RETOMA_REDISENO.md` ahí).

## Prompt 1 — Maestro (Inicio paciente)

```
Design a modern, premium healthcare web app called "FCV Citas" — an appointment booking platform for Fundación Cardiovascular de Colombia. Desktop web first (1440px), responsive. All UI text in Spanish (Colombia). Use fictitious Colombian names.

VISUAL DIRECTION: "warm clinical premium". Think One Medical, Zocdoc, Linear and Stripe Dashboard: calm, confident, lots of whitespace, strong typographic hierarchy, soft depth. It must NOT look like a generic admin template or a Bootstrap form.
- Palette: deep medical blue #0B5C8C (primary), aqua #14B8A6 used only as a small accent, background #F6F8FB, white cards, text #14212B, secondary text #5B6B7B, hairline borders #E3E9EF.
- A subtle blue-to-aqua gradient only in hero areas and key highlights, never everywhere.
- Typography: Plus Jakarta Sans for headings (bold, large, tight tracking) and Inter for body text.
- Cards: 16px radius, very soft shadows, generous 24–32px padding. Buttons: 12px radius, 44px tall.
- Status pills (rounded, soft background plus colored dot): Solicitada amber, Aprobada green, Rechazada red, Cancelada slate, Atendida blue, No asistió gray.
- Icons: Lucide, thin stroke. Logo: a heart-pulse icon plus "FCV Citas".
- Layout: left sidebar 248px, white, with the logo, nav items with icons, and the active item as a soft blue pill. Top bar with a search field, a notifications bell, and an avatar with name and role. Content max width 1200px.

SCREEN: Patient home ("Inicio"), role Paciente.
- Sidebar: Inicio, Agendar cita, Mis citas.
- Hero card with a soft gradient: "Hola, Laura 👋", a subtitle, and a primary CTA "Agendar nueva cita".
- Highlight card for the "Próxima cita": doctor avatar, "Dr. Andrés Rincón", Cardiología, date/time block, sede "Hospital Internacional de Colombia – Piedecuesta", pill "Aprobada", actions "Ver detalle" and "Cancelar".
- A list of "Próximas citas" (3 compact rows with status pills).
- Bento grid of "Accesos directos": Agendar cita, Mis citas, Sedes (HIC Piedecuesta / ICV Floridablanca), Ayuda.
- Small footer note: "Entorno de laboratorio – datos ficticios".
```

## Prompt 2 — Login

```
Same design system and layout style as the previous screens (FCV Citas: deep medical blue #0B5C8C primary, aqua #14B8A6 accent used sparingly, background #F6F8FB, Plus Jakarta Sans headings, Inter body, 16px card radius, 12px button radius, 44px inputs, soft shadows, Lucide icons). All UI text in Spanish (Colombia). Desktop 1440px.

SCREEN: Login ("Iniciar sesión"). No sidebar and no top bar; this is a public page. Split screen 50/50.

LEFT PANEL: full-height deep blue gradient (#0B5C8C → #073A58) with a subtle aqua glow. Top-left logo (white heart-pulse icon + "FCV Citas"). Headline "Tu salud cardiovascular, a tiempo." Subtitle "Agenda, consulta y gestiona tus citas en la Fundación Cardiovascular de Colombia." 3 benefit rows with small aqua icons: "Agenda en minutos, 24/7", "Especialistas en HIC Piedecuesta e ICV Floridablanca", "Sigue el estado de tus solicitudes en tiempo real". Subtle ECG line illustration behind, low opacity. Bottom: translucent card with quote "Atención cercana, tecnología de vanguardia" and 3 avatars "+2.000 pacientes".

RIGHT PANEL: white, form max width 420px. Title "Bienvenido de nuevo", subtitle "Ingresa con tu correo y contraseña". Input "Correo electrónico" (mail icon, placeholder "tu@correo.com"). Input "Contraseña" (lock icon, show/hide toggle). Row: checkbox "Recordarme" + link "¿Olvidaste tu contraseña?". Full-width primary button "Iniciar sesión". Divider "¿No tienes cuenta?" then outline button "Crear cuenta". Footer: "Entorno de laboratorio – datos ficticios".

STATES: 1) Error alert "Correo o contraseña incorrectos" with red password border. 2) Loading "Ingresando…" with spinner. 3) Amber alert "Tu cuenta está desactivada. Contacta al administrador."

MOBILE (390px): hide left panel; compact blue header with logo and headline, form below.
```

## Prompt 3 — Registro y recuperar contraseña

```
Same design and split layout as the Login screen.

SCREEN A: "Crear cuenta". Same left brand panel. Right: 2-column grid form — Nombres, Apellidos; Tipo de documento (CC, TI, CE, Pasaporte), Número de documento; Correo electrónico, Teléfono; Contraseña, Confirmar contraseña with a strength bar. Checkbox "Acepto los términos y el tratamiento de datos", primary button "Crear cuenta", link "¿Ya tienes cuenta? Inicia sesión". Error variant: "Este correo o documento ya está registrado".

SCREEN B: "Recuperar contraseña". Same left panel. Step 1: email input + "Enviar enlace"; neutral success message with mail illustration: "Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña." Step 2: "Nueva contraseña" + "Confirmar contraseña", button "Guardar contraseña", success state with link back to "Iniciar sesión".
```

## Prompts 4+ — Resto de pantallas (aún no generadas en Stitch)

Uno por prompt, en el mismo proyecto.

```
Same design system. SCREEN: "Agendar cita", a 4-step wizard for Paciente. Horizontal stepper: 1 Tipo de cita, 2 Especialidad y sede, 3 Fecha y hora, 4 Confirmar. Show step 3 active: horizontal strip of the next 14 days as date cards (selected filled blue); professional filter ("Cualquiera" or doctor chip); time slots as pill chips grouped Mañana / Tarde, unavailable disabled; sticky right summary card (especialidad, sede, profesional, fecha, hora, duración 30 min); buttons "Atrás" / "Continuar". Variants: step 1 with two big cards "General" and "Especializada – requiere aprobación"; success "¡Cita confirmada!" / "Tu solicitud está en revisión".
```

```
Same design system. SCREEN: "Mis citas" (Paciente). Status filter chips: Todas, Solicitada, Aprobada, Atendida, Cancelada, Rechazada. Appointment cards with large date block, doctor, specialty, sede, time, status pill; one card with a rejection reason in a soft red note. Detail view "Datos de la cita" with a vertical "Historial" timeline and buttons "Solicitar reprogramación" and "Cancelar cita" (confirmation modal).
```

```
Same design system. SCREEN: Professional "Mi agenda" (sidebar: Inicio, Mi agenda). Week calendar Lunes–Domingo. Controls "Semana anterior", "Hoy", "Semana siguiente", date range, primary "+ Nuevo bloque". Availability blocks as soft blue rounded blocks split into 30-min slots; booked slots filled with patient initials; today highlighted with "Hoy" badge; legend. "Nuevo bloque" modal: Fecha, Sede, Hora de inicio, Hora de fin.
```

```
Same design system. SCREEN: Admin "Panel" (sidebar: Panel, Solicitudes, Profesionales, Especialidades). 4 KPI cards: Solicitudes pendientes 12, Profesionales activos 28, Especialidades activas 9, Citas de hoy 47. Bar chart "Citas por sede esta semana" (HIC vs ICV). Preview list "Solicitudes pendientes" with quick Aprobar/Rechazar.
```

```
Same design system. SCREEN: Admin "Solicitudes". Filters: Sede, Profesional, Especialidad, Fecha, "Limpiar filtros". Table: Paciente, Especialidad, Profesional, Sede, Fecha y hora, Duración, Acciones (green "Aprobar", ghost red "Rechazar"). Hover + pagination. Modal "Rechazar solicitud" with required "Motivo del rechazo". Empty state "¡Todo al día! No hay solicitudes pendientes".
```

```
Same design system. SCREEN: Admin "Profesionales". Search "Nombre, documento, correo o código", segmented Todos / Activos / Inactivos. Table: Profesional (avatar, name, email), Documento, Código / matrícula, Especialidades (tags, primary starred), Sedes (HIC / ICV), Estado, Acciones. Button "+ Nuevo profesional". Create form with 5 section cards: Datos personales, Credencial inicial, Datos profesionales, Especialidades (checkboxes + radio principal), Sedes.
```

```
Same design system. SCREEN: Admin "Especialidades". Table: Nombre, Tipo (General / Especializada), Duración (30 / 60 min), Estado, Acciones. Create/edit modal with Nombre, Tipo and Duración as segmented controls. Warning toast "Está en uso: desactívala en lugar de eliminarla".
```

```
Same design system. SCREENS: 404 "Página no encontrada" and 403 "Sin permiso" with line illustration and "Volver al inicio"; skeleton loaders for card list and table; success and error toasts.
```
