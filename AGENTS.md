## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current

## Context Navigation:

When you need to understand the codebase, docs, or any files in this project:

1. ALWAYS query the knowledge graph first: `/graphify query "your question"`
2. Only read raw files if I explicitly say "read the file", "look at the raw file", "lee el archivo", "revisa el archivo" or similar.
3. Use `graphify-out/wiki/index.md` as your navigation entrypoint for browsing structure.

---

## ⚡ AI Router — Smart Model Selection (PRO→FLASH Workflow)

Este proyecto usa un sistema de routing inteligente para optimizar costos de API.
Usa `deepseek-v4-pro` ($1.74/M tokens) solo para planificación estratégica,
y `deepseek-v4-flash` ($0.14/M tokens) para implementación directa.

### Flujo Automático

Cuando recibas una instrucción:

1. **CLASIFICA automáticamente** la tarea usando heurísticas (0 tokens):
   - **COMPLEX** (usa PRO): arquitectura, multi-archivo, seguridad, data model, estrategia, migraciones, refactors grandes, features nuevos
   - **SIMPLE** (usa FLASH): bug fixes, tests, UI simple, 1-2 archivos, documentación, hotfixes, typos

2. **Ejecuta según clasificación:**
   ```
   COMPLEX → npx tsx scripts/ai-router.ts --plan "descripción de la tarea"
   SIMPLE  → implementa directamente con herramientas disponibles (read_file, replace_in_file, etc.)
   ```

3. **Usa memoria de contexto:**
   - Revisa `.ai-context/memory.json` al inicio de cada sesión
   - Actualiza `sessions` y `last_session` al finalizar
   - Usa los `architecture_decisions` y `patterns` para mantener coherencia

### Selección Automática de Skills

Según la clasificación y descripción, aplica el skill adecuado:

| Tipo de Tarea | Skill a Usar |
|---|---|
| Bug / test failure (SIMPLE) | `systematic-debugging` |
| Tests / implementación existente (SIMPLE) | `test-driven-development` |
| Diseño / arquitectura (COMPLEX) | `brainstorming → writing-plans → subagent-driven-development` |
| Migraciones / refactors (COMPLEX) | `brainstorming → writing-plans → executing-plans` |
| Estrategia / trade-offs (COMPLEX) | `brainstorming` |
| Después de implementar (cualquier tarea) | `verification-before-completion` |
| Antes de finalizar rama | `finishing-a-development-branch` |

### Reglas de Eficiencia

- **NO** uses "I'll", "Let me", "Great" — solo acción directa
- **NO** preguntes antes de hacer cosas obvias — solo hazlas
- **VERIFICA** con tests después de implementar
- **CORRIGE** fallos inmediatamente sin preguntar
- **MÍNIMO** contexto en cada respuesta — solo código y comandos
- **MEMORIA** persiste en `.ai-context/memory.json`
- **ADMIN** todas las tablas nuevas deben usar `useAdminTable` y `inMemorySearch`. Prohibido usar estado local manual para paginación o búsqueda.

### Recordatorios Post-Implementación

- Si modificaste archivos de código, reconstruye el grafo graphify:
  `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
