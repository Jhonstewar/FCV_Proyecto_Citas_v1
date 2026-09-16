# Resumen del PRD y restricciones técnicas

## Propósito y alcance

El proyecto es un laboratorio con datos ficticios para construir una aplicación web de agendamiento de citas. No debe contener datos clínicos, pacientes, profesionales ni credenciales reales de la FCV. No incluye historia clínica, pagos, facturación, SMS/WhatsApp, SMTP obligatorio ni integración con sistemas clínicos reales.

## Actores y responsabilidades

| Actor | Responsabilidades principales |
|---|---|
| `USER` | Registro, perfil, afiliación, búsqueda de disponibilidad, solicitud/cancelación/reprogramación y consulta de sus citas. |
| `PROFESSIONAL` | Gestiona su disponibilidad y consulta su agenda; no aprueba citas. |
| `ADMIN` | Gestiona profesionales, EPS, planes y especialidades; aprueba/rechaza citas especializadas y reprogramaciones. |

## Reglas funcionales clave

- Una cita es de 30 o 60 minutos según su especialidad. Sesenta minutos exige dos slots consecutivos de 30 minutos.
- Los bloques de disponibilidad pertenecen a un profesional, una sede y una fecha; no pueden estar en el pasado ni solaparse.
- Una cita general de Medicina General se crea como `APPROVED`.
- Una cita especializada se crea como `REQUESTED`; sus slots se retienen y ADMIN debe aprobarla o rechazarla con motivo.
- Cancelar o rechazar libera los slots. Las transiciones deben quedar auditadas.
- La reprogramación conserva la cita original y sus slots hasta la decisión administrativa. La propuesta nueva se retiene mientras esté `PENDING`; al aprobarla se trasladan los slots y al rechazarla se liberan los propuestos.
- No puede existir doble reserva de un slot, y la API debe tratar reserva, cambio de estado e historial como una misma transacción.

## Catálogos y datos

- Fijos y precargados: roles, estados de cita, estados de reprogramación, regímenes y sedes HIC/ICV.
- Configurables por ADMIN: EPS, planes de EPS y especialidades.
- Los catálogos referenciados por transacciones se desactivan; no se borran físicamente.
- Las credenciales, tokens y contraseñas nunca se guardan en texto plano ni se versionan. Passwords con BCrypt/Argon2; refresh y reset tokens únicamente como hash.

## Modelo de datos y 3FN

- `users`, `roles` y `user_roles` resuelven los múltiples roles sin duplicar datos personales.
- `professionals` amplía a `users`; sus especialidades y sedes se resuelven mediante tablas puente N:M.
- La afiliación apunta a un plan; el plan apunta a EPS y régimen. No se guardan nombres de EPS, plan, régimen, profesional, especialidad ni estado dentro de la cita.
- `appointments` conserva los datos operativos y usa FKs; `appointment_status_history` registra cada cambio de estado, actor, origen, fecha y motivo.
- El inicio y fin programados de una cita son un snapshot temporal intencional, no una repetición de nombres de catálogo.
- Para sostener una reprogramación pendiente se necesita una relación entre la solicitud y los slots propuestos, sin quitar todavía los slots de la cita original.

## Arquitectura obligatoria

- Backend: Java 21, Spring Boot 3.5.x, Maven, arquitectura hexagonal, Spring Data JPA, Flyway, MySQL 8.4, Spring Security y JWT access/refresh.
- Frontend: TypeScript con React o Angular; consume REST directamente. No se permite Express ni BFF.
- API: REST/JSON, validación del lado servidor, CORS explícito, autorización por rol y ownership. Actuator health es recomendado.
- Repositorios: `citas-api` y `citas-web` independientes, con `main` estable y `develop` de trabajo. Debe haber al menos un commit trazable por sesión.

## Pruebas y automatización

- Backend: pruebas de dominio, aplicación, REST y persistencia relevante.
- Frontend: build/typecheck y pruebas que correspondan al framework elegido.
- Cross-repo: validar el contrato REST en funcionalidades críticas.
- En fases posteriores se agregan flujos n8n para recordatorios, notificaciones de estado y resumen operativo diario; no sustituyen el núcleo transaccional de la aplicación.
