# Catálogo de agentes — FCV Citas

Agentes especializados de Claude Code para este workspace. La gobernanza que todos obedecen está
en [`../../AGENTS.md`](../../AGENTS.md).

## Orquestación

| Agente | Cuándo usarlo |
|---|---|
| `s2-orchestrator` | Ejecutar, retomar o cerrar la **sesión S2** completa. Coordina a todos los demás. |

## Especificación y conocimiento

| Agente | Cuándo usarlo |
|---|---|
| `scrum-spec-writer` | Crear, revisar, actualizar o cerrar épicas y HU en `citas-api/docs/wiki/scrum/`. Escribe solo ahí; nunca código ni git. |
| `wiki-keeper` | `INGEST` / `QUERY` / `LEARN` / `LINT` sobre la LLM Wiki de Obsidian. |
| `research-scout` | Investigación técnica acotada con fuentes citadas, antes de decidir librería, patrón o versión. |

## Backend (`citas-api`)

| Agente | Cuándo usarlo |
|---|---|
| `backend-domain` | Entidades, value objects, invariantes, transiciones, puertos y casos de uso. Vigila la pureza hexagonal. |
| `backend-persistence` | Esquema 3FN, migraciones Flyway, JPA, índices, transacciones, riesgo de doble reserva. |
| `backend-security` | Registro, hash, JWT access/refresh, rotación y revocación, roles, ownership, CORS. |
| `backend-verifier` | Verificar una HU contra CA y DoD. **No implementa.** |

## Frontend (`citas-web`)

| Agente | Cuándo usarlo |
|---|---|
| `frontend-ui` | Componentes, rutas, formularios, estados de UI, fidelidad al diseño aprobado. |
| `frontend-api` | Cliente REST, DTO, ciclo de vida del token, errores HTTP, URL por entorno. |
| `frontend-verifier` | Verificar una HU contra CA y DoD con build, typecheck y pruebas. **No implementa.** |

## Reglas de uso

1. **Quien implementa no verifica.** Los `*-verifier` corren aislados, sin permisos de escritura.
   Un agente no valida su propio trabajo.
2. **Delega lo acotado y paralelizable.** Varios agentes sobre archivos disjuntos pueden correr a
   la vez; dos agentes sobre el mismo archivo se pisan.
3. **Cada agente recibe contexto completo.** No ve esta conversación: dale el objetivo, lo que ya
   se descartó y las rutas concretas.
4. **La HU es la unidad de alcance.** Ningún agente implementa sin una HU `Aprobada`.
5. **Ningún agente crea repos remotos, hace push ni aprueba una HU.** Eso lo confirma el usuario.

Los prompts originales del trainer, de los que derivan estos agentes, están en
[`../../prompts/`](../../prompts/).
