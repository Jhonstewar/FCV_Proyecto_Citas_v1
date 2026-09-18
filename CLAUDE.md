# CLAUDE.md

`AGENTS.md` es la gobernanza canónica de este workspace (contexto, reglas duras, delegación, git,
seguridad) y aplica íntegra a Claude Code. Se importa aquí para que se cargue en cada sesión:

@AGENTS.md

Cada repo tiene además su propio `CLAUDE.md`, que importa su `AGENTS.md` y se carga al trabajar
en archivos de ese repo: [`citas-api/CLAUDE.md`](citas-api/CLAUDE.md) y
[`citas-web/CLAUDE.md`](citas-web/CLAUDE.md).

Este archivo solo añade lo específico de Claude Code.

## Agentes disponibles

Definidos en [`.claude/agents/`](.claude/agents/); catálogo en
[`.claude/agents/README.md`](.claude/agents/README.md). El agente de sesión es
`s2-orchestrator`, que ejecuta la secuencia completa de S2 según `GUIA_SESIONES_S2_S6.md`.

**El orquestador debe ser el hilo principal, no un subagente.** Un subagente de Claude Code no
puede lanzar otros subagentes, así que si `s2-orchestrator` se invoca como subagente no podrá
delegar. Arráncalo con `claude --agent s2-orchestrator`; en cualquier otra sesión, el hilo
principal delega directamente en los especialistas.

Delega en lugar de hacerlo todo en el hilo principal cuando el trabajo sea acotado y paralelizable.
**Quien implementa no verifica**: `backend-verifier` y `frontend-verifier` corren aislados y no editan código.

## Obligación de wiki en cada interacción

Al terminar una interacción que produzca conocimiento durable —una decisión, un contrato, una
regla confirmada, un cambio de arquitectura, una preferencia tuya, una pregunta abierta— ejecuta
el workflow `LEARN` de
[`citas-api/docs/wiki/llm-wiki/schema/SCHEMA.md`](citas-api/docs/wiki/llm-wiki/schema/SCHEMA.md)
antes de cerrar el turno:

1. extraer solo lo durable y clasificarlo (`HECHO` / `DECISIÓN` / `PREFERENCIA` / `PREGUNTA ABIERTA`);
2. verificar los `HECHO` contra el código o los documentos reales antes de persistirlos;
3. integrarlos en las páginas existentes de `wiki/` con `[[wikilinks]]`, en vez de crear páginas nuevas por defecto;
4. actualizar `wiki/index.md` si cambió la estructura;
5. añadir una línea a `wiki/log.md` con el prefijo `## [YYYY-MM-DD] learn | <asunto>`.

Si la interacción no produjo nada durable (una pregunta trivial, un comando de lectura), **no
escribas nada**. La wiki es síntesis acumulativa, no transcript. Un hook de `UserPromptSubmit` te
recuerda esta obligación en cada turno; el recordatorio no sustituye el criterio de qué merece
persistirse.

## Entorno

- Windows 10 + PowerShell. Rutas con espacios: cítalas siempre.
- **Java 21 y Maven solo dentro de Docker.** El JDK del host es 26 y no cumple la restricción:
  `docker compose run --rm citas-api-dev mvn ...`
- Node 24 y npm sí están disponibles en el host para `citas-web`.
- MySQL 8.4 corre en el contenedor `fcv-citas-mysql`, expuesto en el puerto **3307** del host
  (3306 dentro de la red de Docker). Desde el backend en contenedor: `mysql:3306`.
- `.env` de la raíz ya existe y está en `.gitignore`. No lo leas ni lo imprimas.

## Idioma

Documentación, commits y respuestas en **español**. Identificadores de código, nombres de paquete
y ramas en inglés.
