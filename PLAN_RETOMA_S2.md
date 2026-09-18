# Plan de retoma — Sesión S2

**Guardado:** 2026-09-16 · **Actualizado:** 2026-09-17. Para retomar, abre Claude Code en esta carpeta y di:
*"Retoma S2 desde PLAN_RETOMA_S2.md"*. El agente `s2-orchestrator` sabe continuar.

## Retomar en otro equipo

Los subrepos **no** vienen dentro del repo principal (están en su `.gitignore`); hay que clonarlos adentro.
Requisitos: Git, Docker Desktop, Node 24 LTS. No hace falta Java ni Maven en el equipo (corren en Docker).

```powershell
git clone -b develop https://github.com/Jhonstewar/FCV_Proyecto_Citas_v1.git
cd FCV_Proyecto_Citas_v1
git clone -b develop https://github.com/Jhonstewar/citas-api.git
git clone -b develop https://github.com/Jhonstewar/citas-web.git

Copy-Item .env.example .env          # cambia JWT_ACCESS_SECRET por uno propio de 32+ caracteres
Copy-Item citas-web\.env.example citas-web\.env
docker compose up -d mysql
.\scripts\init-test-db.ps1                          # base de pruebas aislada (una vez por equipo)
docker compose run --rm citas-api-dev mvn -B test   # debe dar 104 tests en verde
cd citas-web; npm install; npm test; npm run build; cd ..   # 42 tests en verde

git config --global user.name "Jhonstewar"      # si el equipo no tiene identidad de git
```

Luego abre Claude Code en `FCV_Proyecto_Citas_v1` y di: *"Retoma S2 desde PLAN_RETOMA_S2.md"*.

## Repositorios

| Repo | Remoto | Ramas |
|---|---|---|
| Raíz (specs, agentes, infra) | `Jhonstewar/FCV_Proyecto_Citas_v1` | `main` (historial del trainer) · `develop` (trabajo S2) |
| Backend | `Jhonstewar/citas-api` | `main` (S2 fusionado por PR #1) · `develop` (S2) |
| Frontend | `Jhonstewar/citas-web` | `main` (S2 fusionado por PR #1) · `develop` (S2) |

El repo del trainer queda como remoto `upstream` en la raíz. **Nunca** hagas push ahí.

## Hecho

- [x] Sistema de agentes: `AGENTS.md`, `CLAUDE.md`, 11 agentes en `.claude/agents/`
- [x] Hook que recuerda actualizar la LLM Wiki en cada turno (`.claude/hooks/wiki-reminder.js`)
- [x] LLM Wiki de Obsidian: `citas-api/docs/wiki/llm-wiki/` (esquema, índice, log, 8 páginas, 2 fuentes en raw)
- [x] Investigación delegada a subagente: `raw/RES-001-spring-security-jwt.md`
- [x] Scrum: 9 épicas, 33 HU; HU-001 a HU-004 `Aprobada` (aprobación delegada)
- [x] Backend Spring Boot 3.5.16 hexagonal, 4 migraciones Flyway (24 tablas), no-doble-reserva por PK
- [x] **GOAL_01**: registro, login JWT, refresh rotativo, logout, `/api/me` — 33 tests en verde (informe del builder)
- [x] Frontend React + TS + Vite: login, registro, recuperar contraseña (solo UI); compila y pasa typecheck
- [x] Contrato del frontend conciliado con el backend (`citas-web/src/api/contracts.ts`)
- [x] Commit S2 en `develop` de los tres repos y push
- [x] **2026-09-17 — Hallazgos de la verificación independiente corregidos** (antiguos pendientes 1, 2, 7 y 8):
  - `citas-web`: renovación ante 401 con una sola renovación en vuelo, épocas de sesión contra las carreras con el logout, dashboard con `GET /api/me`, `VITE_API_URL` obligatoria. 42 pruebas (Vitest + jsdom).
  - `citas-api`: base de pruebas aislada (`scripts/init-test-db.ps1`), migraciones probadas sobre esquema vacío, ArchUnit, CA-01 con reloj controlable, 400 en español ante cuerpo ilegible, locale fijo, rutas públicas que ignoran `Authorization`, límite de contraseña en bytes (el login aceptaba una contraseña distinta con los mismos 72 primeros bytes), rechazo del secreto `CHANGE_ME`. 104 pruebas.
  - Contrato REST documentado en la wiki: `contrato-rest-identidad.md`.
  - `docker-compose.yml` pasa `FRONTEND_ORIGIN`, `JWT_ACCESS_MINUTES` y `JWT_REFRESH_DAYS`; `JWT_REFRESH_SECRET` eliminado.
  - CA-01 de HU-003 ampliado para la rotación, CA-09 nuevo (reuso), y notas de HU-003/HU-004 alineadas con dec-002.
  - Tres rondas de verificación independiente con prueba de mutación; tablas de evidencia reescritas desde sus informes.

## Pendiente, en este orden

1. **Prueba manual extremo a extremo:** levantar el backend (`docker compose run --rm --service-ports citas-api-dev mvn spring-boot:run`) y el frontend (`cd citas-web && npm run dev`), y hacer registro → login → ver "Tu cuenta" → cerrar sesión en el navegador. Es lo único que los verificadores no pudieron comprobar (HU-002 CA-09 contra el backend real).
2. ~~**AGENTS.md por repo** (S2 paso 2)~~ — **hecho 2026-09-18**: `citas-api/AGENTS.md` y `citas-web/AGENTS.md` generados desde el código real; plantillas borradas. Revisar `citas-web/AGENTS.md` después del punto 3 (importación de AI Studio).
3. **Stitch → AI Studio** (S2 paso 4, requiere a una persona): seguir `citas-web/docs/diseno/PROMPTS_STITCH.md` y `HANDOFF_AI_STUDIO.md`, aprobar el diseño e importar/reconciliar en `citas-web`.
4. **Comparar el modelo 3FN propio con la referencia** `database/reference/db.sql` y registrar las diferencias en la wiki.
5. **HU-033** (contrato REST) sigue en `Borrador`: el contrato existe, pero la HU no estaba en la aprobación delegada. Decide si la apruebas.
6. **Cerrar S2**: LINT de la wiki, merge `develop → main` solo cuando se declare estable.

## Decisiones que te esperan

Todas en `citas-api/docs/wiki/llm-wiki/wiki/sintesis-preguntas-abiertas.md`. Las que tocan S2:
- ¿Mantienes la aprobación delegada de HU-001..004?
- Política de contraseña (INC-001). Hoy el servidor solo exige un máximo de 72 bytes, mientras que el cliente pide mínimo 8 con letra y número: la API acepta lo que el formulario rechaza.
- ¿Cómo se crea el primer ADMIN?
- ¿Se acepta el access token no revocable durante 15 min?
- Decisiones que tomó el agente bajo la aprobación delegada (tabla D1–D4 de la síntesis): el contrato en Markdown, `ProblemDetail`, la rotación con revocación por familia y el locale fijo `es_CO`.
- ¿Se pasa el refresh token a una cookie `HttpOnly`? Hoy vive en memoria de JavaScript.
- ¿Se suprime el `error_description`, en inglés, de la cabecera `WWW-Authenticate`?

Y dos defectos de esquema para S3 (migración V5): historial de auditoría con `ON DELETE CASCADE` y origen `PROFESSIONAL` ausente.
