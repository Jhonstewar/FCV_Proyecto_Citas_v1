# Proyecto FCV — Sistema ficticio de agendamiento de citas

Plantilla de trabajo para las sesiones **S2 a S6** de la formación de agentes de desarrollo. El paquete deja deliberadamente **vacíos de lógica de negocio** los repositorios `citas-api` y `citas-web`: el objetivo es que cada estudiante los construya con agentes, especificaciones, pruebas y automatización, manteniendo evidencia mediante Git.

> **Importante:** el dominio es académico. Las sedes y algunos nombres de especialidades se apoyan en información pública de FCV; pacientes, profesionales, credenciales, EPS, planes, horarios y citas son datos sintéticos. No representa sistemas ni procesos internos reales de FCV.

## Estructura

```text
FCV_Proyecto_Citas_v1/          # Repo orquestador: specs, prompts, skills, infraestructura
├── README.md
├── AGENTS.md                   # Gobernanza canónica de los agentes
├── CLAUDE.md                   # Específico de Claude Code; apunta a AGENTS.md
├── PRD.md
├── RESTRICCIONES_TECNICAS.md
├── EVIDENCIAS_Y_TRAZABILIDAD.md
├── docker-compose.yml
├── .env.example
├── .claude/
│   ├── agents/                 # Agentes especializados (ver .claude/agents/README.md)
│   ├── hooks/                  # Hook que recuerda mantener la LLM Wiki en cada turno
│   └── settings.json
├── database/
├── prompts/
├── skills/
├── scripts/
├── citas-api/       # Repo Git independiente: Java/Spring Boot
└── citas-web/       # Repo Git independiente: React + TypeScript + Vite
```

`citas-api/` y `citas-web/` **no están versionados por el repo raíz**: están en su `.gitignore`
porque son repositorios propios. El raíz solo los orquesta.

## Stack objetivo

### Backend
- Java 21 LTS.
- Spring Boot 3.5.x.
- Maven.
- Arquitectura hexagonal.
- Spring Data JPA.
- Flyway durante la implementación.
- MySQL 8.4 LTS.
- REST/JSON.
- JWT access + refresh token.

### Frontend
El estudiante decide el framework al exportar/continuar desde Stitch y Google AI Studio:
- React + TypeScript, **o**
- Angular + TypeScript.

Node.js 24 LTS es el runtime/toolchain. **No se usa Express ni BFF.** El frontend consume directamente `citas-api` por REST.

## Dos repositorios, un workspace

`citas-api` y `citas-web` son repositorios Git independientes. La carpeta raíz solo los orquesta y permite que Codex/Claude tengan visibilidad de ambos cuando el trabajo sea cross-repo.

La única LLM Wiki global se versionará dentro de:

```text
citas-api/docs/wiki/llm-wiki/
```

## Skills incluidas

En `skills/` se incluyen las dos Skills proporcionadas por el trainer:
- `scrum-spec-orchestrator`: genera épicas, historias, tareas, criterios de aceptación y DoD en `docs/wiki/scrum/` sin implementar código.
- `stitch-design-to-frontend`: guía prototipado, aprobación visual, handoff a Google AI Studio y reconciliación del frontend.

## Agentes

La gobernanza que todos obedecen está en [`AGENTS.md`](AGENTS.md); el catálogo completo, en
[`.claude/agents/README.md`](.claude/agents/README.md). El agente de entrada es
`s2-orchestrator`, que ejecuta la secuencia de la sesión S2 y delega en los especialistas.

Dos reglas estructurales: **quien implementa no verifica** —los agentes `*-verifier` corren
aislados y sin permisos de escritura— y **ningún agente aprueba una HU, crea un repo remoto ni
hace push**; eso lo confirma siempre una persona.

## LLM Wiki

`citas-api/docs/wiki/llm-wiki/` es la memoria única del proyecto, mantenida por el agente y
legible en Obsidian. Tres capas: `raw/` (fuentes curadas e inmutables), `wiki/` (síntesis que el
agente escribe, con `index.md` y `log.md`) y `schema/` (las convenciones).

Las reglas están en [`schema/SCHEMA.md`](citas-api/docs/wiki/llm-wiki/schema/SCHEMA.md), con los
cuatro workflows: `INGEST` al entrar una fuente, `QUERY` al preguntar, `LEARN` al cerrar una
interacción con conocimiento durable, y `LINT` como revisión periódica de salud. Un hook de
`UserPromptSubmit` recuerda la obligación en cada turno.

## Flujo de desarrollo esperado

```text
PRD + restricciones
      ↓
scrum-spec-orchestrator
      ↓
Épicas + HU + CA + DoD
      ↓
Stitch → diseño aprobado → Google AI Studio
      ↓
citas-web
      ↕ REST
citas-api
      ↓
MySQL
      ↓
S3 verificación
      ↓
S4 autonomía / goals / loops
      ↓
S5-S6 MCP + n8n
```

## Inicio rápido de infraestructura

1. Instala Docker Desktop y habilita WSL Integration.
2. Desde esta carpeta:

```powershell
Copy-Item .env.example .env
.\scripts\preflight.ps1
```

3. Levanta únicamente MySQL:

```powershell
docker compose up -d mysql
```

4. Comprueba:

```powershell
docker compose ps
.\scripts\db-smoke-test.ps1
```

5. Si quieres disponer también de toolchains Java/Node dentro de contenedores:

```powershell
docker compose --profile dev up -d
```

Estos contenedores **no contienen la aplicación**. Solo montan los repos vacíos y ofrecen Java/Maven y Node para que el estudiante inicialice sus proyectos.

## Inicializar Git

```powershell
.\scripts\init-repos.ps1
```

El script crea en cada repo:
- `main` como rama estable;
- `develop` como rama de trabajo.

La lógica se construye en `develop`. El estudiante fusiona a `main` cuando considere el incremento estable.

## Orden recomendado

1. Lee `PRD.md` y `RESTRICCIONES_TECNICAS.md`.
2. Ejecuta `scrum-spec-orchestrator` desde `citas-api` para producir las épicas/HU/DoD.
3. Ejecuta el prompt del agente orquestador desde la raíz.
4. Genera los agentes de `citas-api` y `citas-web` con los prompts de `prompts/agents/`.
5. Sigue `GUIA_SESIONES_S2_S6.md`.
6. Usa `prompts/goal-loop/` en S2-S4.
7. Versiona los JSON de n8n en `citas-api/automations/n8n/` durante S5-S6.

## Referencias de base de datos

El paquete incluye la solución de referencia `database/reference/db.sql` y su ERD. Para la actividad de normalización, el trainer puede **ocultar temporalmente** esa carpeta y entregar únicamente `database/REQUISITOS_NORMALIZACION_3FN.md`.
