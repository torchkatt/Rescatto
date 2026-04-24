# AI Router Workflow — PRO→FLASH Smart Model Selection

## Descripción

Sistema de routing inteligente que clasifica automáticamente las tareas de desarrollo
para usar el modelo de DeepSeek más eficiente en cada caso:

- **deepseek-v4-pro** ($1.74/$3.48 por 1M tokens) → Planificación estratégica
- **deepseek-v4-flash** ($0.14/$0.28 por 1M tokens) → Implementación directa

**Ahorro estimado: ~90% vs usar pro siempre.**

---

## Arquitectura

```
Instrucción del usuario
        │
        ▼
┌──────────────────┐
│  CLASIFICACIÓN   │ ← Heurísticas (0 tokens) + AI flash si ambigüo
│  Automática      │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
 COMPLEX    SIMPLE
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│   PRO  │ │ FLASH  │ (directo)
│  Plan  │ └────────┘
└───┬────┘
    │
    ▼
┌────────┐
│ FLASH  │ ← Cada tarea del plan
│ Execute│
└────────┘
```

## Comandos

### Clasificar una tarea (saber si es COMPLEX o SIMPLE)

```bash
npx tsx scripts/ai-router.ts --classify "implementar login con Google"
```

Output:
```json
{
  "classification": "COMPLEX",
  "reason": "Keyword detectada: 'auth'",
  "complexity_score": 0.85,
  "suggested_skill": "brainstorming"
}
```

### Ejecutar tarea SIMPLE directo con flash

```bash
npx tsx scripts/ai-router.ts --model flash --task "fix el typo en el header"
```

### Generar plan estratégico con pro

```bash
npx tsx scripts/ai-router.ts --model pro --task "diseñar arquitectura del módulo de pagos"
```

### Pipeline completo (plan pro → implementación flash)

```bash
npx tsx scripts/ai-router.ts --plan "migrar autenticación a Firebase Auth v2"
```

Esto:
1. Clasifica la tarea
2. Si COMPLEX: genera plan con pro → guarda en `docs/plans/` → ejecuta cada tarea con flash
3. Si SIMPLE: ejecuta directo con flash

---

## Clasificador Automático

### Heurísticas (0 tokens, instantáneo)

| Categoría | Palabras clave |
|---|---|
| **COMPLEX** | arquitectura, diseño, plan, estrategia, migración, schema, multi-archivo, seguridad, auth, permisos, RLS, webhook, data model, firestore rules, performance, optimización, nuevo feature, desde cero |
| **SIMPLE** | bug fix, test, unit test, e2e, playwright, estilos, css, tailwind, ajuste, logging, debug, typo, eslint, documentación, single file, cambio menor |

Si la tarea es ambigüa, se usa flash para clasificar (~10-20 tokens).

### Skills Asignados Automáticamente

| Tarea | Skill |
|---|---|
| Bug / test failure | `systematic-debugging` |
| Tests | `test-driven-development` |
| Diseño / arquitectura | `brainstorming → writing-plans → subagent-driven-development` |
| Migraciones / refactors | `brainstorming → writing-plans → executing-plans` |
| Estrategia | `brainstorming` |
| Después de implementar | `verification-before-completion` |
| Antes de merge | `finishing-a-development-branch` |

---

## Memoria de Contexto

El archivo `.ai-context/memory.json` persiste entre sesiones:

```json
{
  "project": { "name": "...", "tech_stack": [...], "architecture": "..." },
  "last_session": "2026-04-24T19:00:00Z",
  "sessions": [...],
  "active_features": [...],
  "patterns": { "testing": "...", "state": "...", ... },
  "architecture_decisions": [ { "id": "ADR-001", ... } ]
}
```

Se actualiza automáticamente al final de cada sesión.

---

## Planes Generados

Los planes de PRO se guardan en `docs/plans/` con formato:

```
docs/plans/YYYY-MM-DD-nombre-del-feature.md
```

Formato del plan (prompt engineering puro):

```markdown
# PLAN: [Nombre del Feature]
## Task 1: [Nombre]
**Files:** path/File.tsx
1. En línea X, cambiar Y por Z
2. Ejecutar: comando exacto
3. Commit: mensaje exacto

## Task 2: [Nombre]
...
```

---

## Integración con Graphify

- Las reglas de graphify en AGENTS.md se **preservan intactas**
- El router NO modifica ni lee el grafo
- Al final de cada sesión con cambios de código, se debe reconstruir:
  ```bash
  python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
  ```

---

## Costos Comparativos

| Escenario | Sin Router (pro siempre) | Con Router | Ahorro |
|---|---|---|---|
| Feature complejo (5 tareas) | ~$0.017 | ~$0.003 | **82%** |
| Bug fix simple | ~$0.003 | ~$0.00014 | **95%** |
| Día promedio (10 tareas) | ~$0.06 | ~$0.006 | **90%** |
| **Mes (30 días)** | **~$1.80** | **~$0.18** | **90%** |

vs Claude Sonnet: **Ahorro > 95%** ($3-15/M → $0.14-1.74/M)
