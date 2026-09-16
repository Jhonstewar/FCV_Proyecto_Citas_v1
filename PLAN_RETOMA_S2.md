# Plan de retoma — Sesión S2

**Guardado:** 2026-09-16. Para retomar, abre Claude Code en esta carpeta y di:
*"Retoma S2 desde PLAN_RETOMA_S2.md"*. El agente `s2-orchestrator` sabe continuar.

## Repositorios

| Repo | Remoto | Ramas |
|---|---|---|
| Raíz (specs, agentes, infra) | `jhonnunez-svg/FCV_Proyecto_Citas_v1` | `main` (historial del trainer) · `develop` (trabajo S2) |
| Backend | `jhonnunez-svg/citas-api` | `main` (commit inicial vacío) · `develop` (S2) |
| Frontend | `jhonnunez-svg/citas-web` | `main` (commit inicial vacío) · `develop` (S2) |

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

## Pendiente, en este orden

1. **Verificación independiente de HU-001..004.** Se lanzó un verificador y la sesión se cerró antes de su informe. Repetir:
   agente `backend-verifier` sobre HU-001..004 → matriz PASS/FAIL/NO VERIFICABLE. Si todo PASS, `scrum-spec-writer` pasa las HU a `Completada` con la evidencia.
2. **Ejecutar las pruebas uno mismo** antes de fiarse: `docker compose run --rm citas-api-dev mvn -B test` (desde la raíz).
3. **Prueba manual extremo a extremo:** levantar el backend (`docker compose run --rm --service-ports citas-api-dev mvn spring-boot:run`) y el frontend (`cd citas-web && npm run dev`), y hacer registro → login en el navegador.
4. **AGENTS.md por repo** (S2 paso 2): `citas-api/AGENTS.md` con `prompts/agents/PROMPT_AGENT_CITAS_API.md` y `citas-web/AGENTS.md` con `PROMPT_AGENT_CITAS_WEB.md`. Borrar los `AGENTS.md.template`.
5. **Stitch → AI Studio** (S2 paso 4, requiere a una persona): seguir `citas-web/docs/diseno/PROMPTS_STITCH.md` y `HANDOFF_AI_STUDIO.md`, aprobar el diseño e importar/reconciliar en `citas-web`.
6. **Comparar el modelo 3FN propio con la referencia** `database/reference/db.sql` y registrar las diferencias en la wiki.
7. **Pequeños ajustes** detectados por el builder:
   - `docker-compose.yml` no pasa `FRONTEND_ORIGIN`, `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` al contenedor (usa valores por defecto).
   - `JWT_REFRESH_SECRET` sobra (el refresh es opaco): quitarlo de los `.env.example`.
   - El contenedor `fcv-citas-api-dev` en ejecución monta otra carpeta; recrearlo: `docker compose up -d --force-recreate citas-api-dev`.
   - Los tests de integración usan la BD de desarrollo `citas_fcv_training` (limpian sus datos `@it.fcv.test`).
   - Frontend: el refresh automático ante un 401 aún no está cableado (con un único refresh en vuelo).
8. **Ampliar CA de HU-003 y la nota de HU-004** para reflejar la rotación y la revocación por familia (dec-002).
9. **Cerrar S2**: LINT de la wiki, merge `develop → main` solo cuando se declare estable.

## Decisiones que te esperan

Todas en `citas-api/docs/wiki/llm-wiki/wiki/sintesis-preguntas-abiertas.md`. Las que tocan S2:
- ¿Mantienes la aprobación delegada de HU-001..004?
- Política de contraseña mínima (hoy: sin mínimo, máximo 72 por BCrypt).
- ¿Cómo se crea el primer ADMIN?
- ¿Se acepta el access token no revocable durante 15 min?

Y dos defectos de esquema para S3 (migración V5): historial de auditoría con `ON DELETE CASCADE` y origen `PROFESSIONAL` ausente.
