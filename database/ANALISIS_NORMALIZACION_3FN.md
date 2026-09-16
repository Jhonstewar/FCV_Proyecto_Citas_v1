# Análisis de normalización a 3FN

## Fuentes y alcance

El análisis usa `PRD.md`, `RESTRICCIONES_TECNICAS.md`, `database/reference/erd.mmd` y `database/reference/db.sql`. No presupone reglas que no estén documentadas en esas fuentes.

## Corrección aplicada: tipo de cita y aprobación

El PRD establece que la cita general se aprueba automáticamente y que la especializada requiere aprobación ADMIN. Si una especialidad guardara a la vez `is_general` y `requires_admin_approval`, la política se repite por especialidad, aunque está determinada por su tipo:

```text
appointment_type -> requires_admin_approval
specialty_id -> appointment_type
```

Se eliminó esa repetición con el catálogo fijo:

```text
appointment_types(id, code, name, requires_admin_approval)
specialties(id, code, name, appointment_type_id, appointment_duration_minutes, active)
```

`GENERAL` y `SPECIALIZED` provienen literalmente del PRD. La regla de aprobación se conserva, pero existe una sola vez por tipo.

## Dependencias funcionales relevantes

| Relación | Dependencia |
|---|---|
| `users` | `id -> datos personales, email, password_hash, active` |
| `professionals` | `id -> user_id, professional_code, license_number, active` |
| `appointment_types` | `id -> code, name, requires_admin_approval` |
| `specialties` | `id -> code, name, appointment_type_id, duration, active` |
| `eps` | `id -> code, name, active` |
| `eps_plans` | `id -> eps_id, regime_id, code, name, active` |
| `user_insurance_affiliations` | `id -> user_id, plan_id, membership_number, is_current` |
| `appointments` | `id -> paciente, profesional, sede, especialidad, afiliación, estado e intervalo` |

Las tablas puente `user_roles`, `professional_specialties`, `professional_locations` y `reschedule_request_slots` poseen PK compuesta y atributos propios de la relación.

## Validación de formas normales

- **1FN:** no hay listas de roles, sedes, especialidades o slots en columnas; cada relación tiene una clave y valores atómicos.
- **2FN:** las relaciones con PK compuesta son tablas puente y no contienen atributos descriptivos que dependan de una sola FK.
- **3FN:** los nombres de EPS, régimen, plan, profesional, especialidad y estado no se copian en la cita. La política de aprobación se centraliza en `appointment_types`.

Los horarios de una cita y de una solicitud de reprogramación se preservan como snapshots operativos. No son una duplicación de catálogo y se necesitan para conservar la decisión histórica.

## Decisiones no modificadas por falta de evidencia

- `eps_plans.regime_id` se mantiene. El modelo permite planes de una misma EPS en varios regímenes. Solo debe moverse a `eps` si se confirma `eps_id -> regime_id` como regla de negocio.
- Un único `is_primary` por profesional, el no solapamiento de bloques y que una afiliación pertenezca al paciente de la cita son restricciones de negocio/transacción. No exigen una descomposición adicional de 3FN.

## Integridad que debe conservar la API

- Reservar slots, cambiar estado e insertar historial en una misma transacción.
- Usar bloqueo de filas para impedir dobles reservas.
- Validar transiciones de estado, pertenencia de afiliación y reglas temporales en el dominio/aplicación.
