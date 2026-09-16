#!/usr/bin/env node
// Hook UserPromptSubmit: recuerda al agente la obligación de mantener la LLM Wiki.
// Inyecta contexto en cada turno, incluyendo las últimas entradas reales del log.

const fs = require("fs");
const path = require("path");

const WIKI = path.join(__dirname, "..", "..", "citas-api", "docs", "wiki", "llm-wiki");
const LOG = path.join(WIKI, "wiki", "log.md");

let ultimas = "(log no encontrado)";
try {
  const entradas = fs
    .readFileSync(LOG, "utf8")
    .split("\n")
    .filter((l) => /^## \[\d{4}-\d{2}-\d{2}\]/.test(l))
    .slice(-3);
  if (entradas.length) ultimas = entradas.join("\n");
} catch {
  // El log puede no existir todavía; el recordatorio sigue siendo válido.
}

process.stdout.write(
  [
    "<llm-wiki>",
    "Este proyecto mantiene una LLM Wiki de Obsidian en citas-api/docs/wiki/llm-wiki/.",
    "Convenciones y workflows: citas-api/docs/wiki/llm-wiki/schema/SCHEMA.md",
    "",
    "Antes de cerrar este turno, si la interaccion produjo conocimiento durable",
    "(una decision, un contrato, una regla confirmada, un cambio de arquitectura,",
    "una preferencia del usuario o una pregunta abierta), ejecuta el workflow LEARN:",
    "clasificar HECHO / DECISION / PREFERENCIA / PREGUNTA ABIERTA, verificar los HECHO",
    "contra el codigo real, integrarlos en las paginas existentes de wiki/ con [[wikilinks]],",
    "actualizar index.md si cambio la estructura y anadir una linea a wiki/log.md.",
    "",
    "Si no produjo nada durable, NO escribas nada. La wiki es sintesis, no transcript.",
    "Nunca persistas secretos, tokens ni PII.",
    "",
    "Ultimas entradas del log:",
    ultimas,
    "</llm-wiki>",
  ].join("\n")
);
