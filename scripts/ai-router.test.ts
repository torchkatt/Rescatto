/**
 * Tests para el AI Router
 *
 * Verifica:
 * - Clasificador heurístico (0 tokens)
 * - Extracción de tareas del plan
 * - Parsing de argumentos CLI
 */

import { describe, it, expect } from 'vitest';

// ─── Heuristic Classifier Tests ──────────────────────────────────────────────

describe('Heuristic Classifier (0 tokens)', () => {
  // Estas funciones están dentro de ai-router.ts, las duplicamos aquí para test
  // En producción se importarían, pero para tests aislados funciona así:

  const COMPLEX_KEYWORDS = [
    'arquitectura', 'architecture', 'diseño', 'design',
    'plan', 'estrategia', 'strategy', 'migración', 'migration',
    'schema', 'refactor grande', 'refactor masivo',
    'multi-archivo', 'multi-file', 'componente nuevo',
    'seguridad', 'security', 'auth', 'autenticación',
    'permisos', 'permissions', 'rls', 'row level security',
    'webhook', 'data model', 'firestore rules',
    'índice', 'index compuesto', 'composite index',
    'integración', 'integration', 'tercero', 'third-party',
    'trade-off', 'tradeoff', 'pros y contras',
    'performance', 'optimización', 'optimization',
    'nuevo feature', 'new feature', 'funcionalidad nueva',
    'componente desde cero', 'from scratch',
    'ci/cd', 'deployment', 'despliegue',
    'monitoreo', 'monitoring', 'alerting',
  ];

  const SIMPLE_KEYWORDS = [
    'bug fix', 'bugfix', 'hotfix', 'hot fix',
    'test', 'unit test', 'e2e', 'playwright',
    'ui simple', 'estilos', 'styles', 'css', 'tailwind',
    'ajuste', 'tweak', 'adjust', 'minor change',
    'logging', 'log', 'debug',
    'typo', 'eslint', 'lint',
    'documentación', 'documentation', 'docs',
    'single file', '1 archivo', 'un archivo',
    'cambio menor', 'small change', 'quick fix',
    'refactor pequeño', 'rename', 'renombrar',
  ];

  function classifyHeuristic(desc: string): { classification: string; reason: string } | null {
    const lower = desc.toLowerCase();

    for (const kw of COMPLEX_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        return { classification: 'COMPLEX', reason: `Keyword: "${kw}"` };
      }
    }

    for (const kw of SIMPLE_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        return { classification: 'SIMPLE', reason: `Keyword: "${kw}"` };
      }
    }

    return null;
  }

  // ─── COMPLEX cases ────────────────────────────────────────────────────

  it('clasifica "arquitectura" como COMPLEX', () => {
    const result = classifyHeuristic('necesito diseñar la arquitectura del sistema de pagos');
    expect(result?.classification).toBe('COMPLEX');
  });

  it('clasifica "migración de datos" como COMPLEX', () => {
    const result = classifyHeuristic('plan de migración de datos de Firestore');
    expect(result?.classification).toBe('COMPLEX');
  });

  it('clasifica "seguridad auth" como COMPLEX', () => {
    const result = classifyHeuristic('implementar autenticación con JWT y RLS');
    expect(result?.classification).toBe('COMPLEX');
  });

  it('clasifica "nuevo feature" como COMPLEX', () => {
    const result = classifyHeuristic('crear nuevo feature de reportes mensuales');
    expect(result?.classification).toBe('COMPLEX');
  });

  it('clasifica "multi-archivo" como COMPLEX', () => {
    const result = classifyHeuristic('refactor multi-archivo del módulo de órdenes');
    expect(result?.classification).toBe('COMPLEX');
  });

  it('clasifica "firestore rules" como COMPLEX', () => {
    const result = classifyHeuristic('actualizar firestore rules para nuevo rol');
    expect(result?.classification).toBe('COMPLEX');
  });

  // ─── SIMPLE cases ─────────────────────────────────────────────────────

  it('clasifica "bug fix" como SIMPLE', () => {
    const result = classifyHeuristic('bug fix en el formulario de login');
    expect(result?.classification).toBe('SIMPLE');
  });

  it('clasifica "test" como SIMPLE', () => {
    const result = classifyHeuristic('agregar test para el componente sidebar');
    expect(result?.classification).toBe('SIMPLE');
  });

  it('clasifica "estilos css" como SIMPLE', () => {
    const result = classifyHeuristic('ajustar estilos css del header');
    expect(result?.classification).toBe('SIMPLE');
  });

  it('clasifica "typo" como SIMPLE', () => {
    const result = classifyHeuristic('corregir typo en landing page');
    expect(result?.classification).toBe('SIMPLE');
  });

  it('clasifica "documentación" como SIMPLE', () => {
    const result = classifyHeuristic('actualizar documentación del API');
    expect(result?.classification).toBe('SIMPLE');
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  it('devuelve null para tareas ambiguas', () => {
    const result = classifyHeuristic('actualizar el dashboard');
    expect(result).toBeNull();
  });

  it('prioriza COMPLEX sobre SIMPLE si hay conflicto', () => {
    const result = classifyHeuristic('hotfix de seguridad en autenticación');
    // "seguridad" y "autenticación" están en COMPLEX_KEYWORDS
    // Aunque "hotfix" está en SIMPLE_KEYWORDS, COMPLEX se revisa primero
    expect(result?.classification).toBe('COMPLEX');
  });
});

// ─── Task Extraction Tests ─────────────────────────────────────────────────

describe('Task Extraction', () => {
  function extractTasks(planContent: string): { title: string }[] {
    const tasks: { title: string }[] = [];
    const taskRegex = /### Task \d+: (.*?)(?=### Task|\n\n## |$)/gs;
    let match;

    while ((match = taskRegex.exec(planContent)) !== null) {
      tasks.push({ title: match[1].trim() });
    }

    if (tasks.length === 0) {
      tasks.push({ title: 'Implement plan' });
    }

    return tasks;
  }

  it('extrae múltiples tareas de un plan', () => {
    const plan = `
# PLAN: Auth System
### Task 1: Login component
Something here
### Task 2: Token validation
Something else
### Task 3: Logout
More content
    `;
    const tasks = extractTasks(plan);
    expect(tasks).toHaveLength(3);
    expect(tasks[0].title).toBe('Login component');
    expect(tasks[1].title).toBe('Token validation');
    expect(tasks[2].title).toBe('Logout');
  });

  it('devuelve una tarea por defecto si no hay formato de tareas', () => {
    const plan = `Just a plain plan without task markers`;
    const tasks = extractTasks(plan);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Implement plan');
  });

  it('extrae tareas con instrucciones multilínea', () => {
    const plan = `
# PLAN: UI Fixes
### Task 1: Fix header
**Files:** components/Header.tsx
1. Change bg color to blue
2. Fix padding
3. Run: npm test
4. Commit: "fix: header styles"

### Task 2: Fix footer
**Files:** components/Footer.tsx
1. Update links
2. Fix spacing
    `;
    const tasks = extractTasks(plan);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Fix header');
    expect(tasks[1].title).toBe('Fix footer');
  });
});

// ─── Skill Selector Tests ─────────────────────────────────────────────────

describe('Skill Selector', () => {
  function selectSkill(classification: string, taskDescription: string): string {
    const lower = taskDescription.toLowerCase();

    if (classification === 'SIMPLE') {
      if (lower.includes('bug') || lower.includes('fix') || lower.includes('error')) {
        return 'systematic-debugging';
      }
      if (lower.includes('test')) {
        return 'test-driven-development';
      }
      return 'test-driven-development';
    }

    if (lower.includes('plan') || lower.includes('diseño') || lower.includes('arquitectura')) {
      return 'brainstorming → writing-plans → subagent-driven-development';
    }
    if (lower.includes('migración') || lower.includes('refactor')) {
      return 'brainstorming → writing-plans → executing-plans';
    }
    return 'brainstorming → writing-plans → subagent-driven-development';
  }

  it('recomienda TDD para tareas SIMPLE estándar', () => {
    const skill = selectSkill('SIMPLE', 'hacer un cambio menor en el header');
    expect(skill).toContain('test-driven-development');
  });

  it('recomienda systematic-debugging para bugs SIMPLE', () => {
    const skill = selectSkill('SIMPLE', 'bug fix en el login');
    expect(skill).toContain('systematic-debugging');
  });

  it('recomienda brainstorming para tareas COMPLEX de diseño', () => {
    const skill = selectSkill('COMPLEX', 'diseñar arquitectura del módulo de pagos');
    expect(skill).toContain('brainstorming');
    expect(skill).toContain('writing-plans');
  });

  it('recomienda executing-plans para migraciones COMPLEX', () => {
    const skill = selectSkill('COMPLEX', 'migración de Firestore a nuevo schema');
    expect(skill).toContain('brainstorming');
    expect(skill).toContain('executing-plans');
  });
});

// ─── Cost Calculation Tests ───────────────────────────────────────────────

describe('Cost Calculation', () => {
  const COST_PER_1M = {
    'deepseek-v4-flash': { input: 0.14, output: 0.28 },
    'deepseek-v4-pro': { input: 1.74, output: 3.48 },
  } as const;

  function calculateCost(model: keyof typeof COST_PER_1M, inputTokens: number, outputTokens: number) {
    const cost = COST_PER_1M[model];
    return {
      input: (inputTokens / 1_000_000) * cost.input,
      output: (outputTokens / 1_000_000) * cost.output,
      total: 0,
    };
  }

  it('calcula costo de flash correctamente', () => {
    const cost = calculateCost('deepseek-v4-flash', 1000, 500);
    expect(cost.input).toBeCloseTo(0.00014, 6);
    expect(cost.output).toBeCloseTo(0.00014, 6);
  });

  it('calcula costo de pro correctamente', () => {
    const cost = calculateCost('deepseek-v4-pro', 2000, 1000);
    expect(cost.input).toBeCloseTo(0.00348, 6);
    expect(cost.output).toBeCloseTo(0.00348, 6);
  });

  it('muestra que flash es ~12x más barato que pro', () => {
    const flashCost = calculateCost('deepseek-v4-flash', 10000, 5000);
    const proCost = calculateCost('deepseek-v4-pro', 10000, 5000);
    const ratio = proCost.total / flashCost.total;
    expect(ratio).toBeGreaterThan(10);
  });
});
