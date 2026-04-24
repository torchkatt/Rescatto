#!/usr/bin/env node
/**
 * AI Router — Smart Model Selection
 *
 * Clasifica automáticamente la complejidad de una instrucción y la enruta
 * al modelo de DeepSeek adecuado:
 *   - COMPLEX  → deepseek-v4-pro   ($1.74/$3.48 por 1M tokens) — Planificación estratégica
 *   - SIMPLE   → deepseek-v4-flash ($0.14/$0.28 por 1M tokens) — Implementación directa
 *
 * Uso:
 *   npx tsx scripts/ai-router.ts --classify "descripción de la tarea"
 *   npx tsx scripts/ai-router.ts --model flash --task "implementar X"
 *   npx tsx scripts/ai-router.ts --model pro   --task "generar plan para Y"
 *   npx tsx scripts/ai-router.ts --plan "descripción del feature completo"
 *
 * Variables de entorno:
 *   DEEPSEEK_API_KEY  (requerida)
 *   DEEPSEEK_BASE_URL (default: https://api.deepseek.com)
 */

import fs from 'fs';
import path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

const MODELS = {
  flash: 'deepseek-v4-flash',
  pro: 'deepseek-v4-pro',
} as const;

const COST_PER_1M = {
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek-v4-pro': { input: 1.74, output: 3.48 },
} as const;

// ─── CLI Argument Parser ──────────────────────────────────────────────────────

function parseArgs(): { command: string; model?: keyof typeof MODELS; task?: string } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  if (command === '--classify') {
    return { command, task: args.slice(1).join(' ') || '' };
  }

  if (command === '--model') {
    const model = args[1] as keyof typeof MODELS;
    if (!model || !MODELS[model]) {
      console.error(`❌ Modelo inválido. Usa: flash | pro`);
      process.exit(1);
    }
    const taskIdx = args.indexOf('--task');
    const task = taskIdx !== -1 ? args.slice(taskIdx + 1).join(' ') : '';
    return { command, model, task };
  }

  if (command === '--plan') {
    const task = args.slice(1).join(' ');
    return { command: '--plan', task };
  }

  printUsage();
  process.exit(1);
}

function printUsage() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║         AI Router — Smart Model Selection               ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  USO:                                                     ║
║                                                          ║
║  Clasificar tarea:                                       ║
║    npx tsx scripts/ai-router.ts --classify "desc"        ║
║                                                          ║
║  Ejecutar con modelo específico:                         ║
║    npx tsx scripts/ai-router.ts --model flash --task "X" ║
║    npx tsx scripts/ai-router.ts --model pro   --task "X" ║
║                                                          ║
║  Pipeline completo (plan pro → implementación flash):    ║
║    npx tsx scripts/ai-router.ts --plan "feature"         ║
║                                                          ║
║  MODELOS:                                                 ║
║    flash → deepseek-v4-flash  ($0.14/$0.28 por 1M)      ║
║    pro   → deepseek-v4-pro    ($1.74/$3.48 por 1M)      ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
}

// ─── DeepSeek API Client ──────────────────────────────────────────────────────

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

interface DeepSeekResponse {
  id: string;
  choices: {
    finish_reason: string;
    index: number;
    message: DeepSeekMessage;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function callDeepSeek(
  model: keyof typeof MODELS,
  systemPrompt: string,
  userMessage: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ content: string; cost: { input: number; output: number; total: number } }> {
  if (!DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY no configurada.');
    console.error('   Configúrala en ~/.claude/settings.json o como variable de entorno.');
    process.exit(1);
  }

  const modelId = MODELS[model];
  const costPerUnit = COST_PER_1M[modelId];

  const requestBody: DeepSeekRequest = {
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    max_tokens: options?.maxTokens ?? 8192,
    temperature: options?.temperature ?? 0.3,
  };

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error (${response.status}): ${error}`);
  }

  const data: DeepSeekResponse = await response.json();
  const content = data.choices[0]?.message?.content || '';
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const inputCost = (usage.prompt_tokens / 1_000_000) * costPerUnit.input;
  const outputCost = (usage.completion_tokens / 1_000_000) * costPerUnit.output;
  const cost = { input: inputCost, output: outputCost, total: inputCost + outputCost };

  return { content, cost };
}

// ─── System Prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  flash: `Eres un ingeniero implementador EXCEPCIONALMENTE EFICIENTE.

REGLAS ESTRICTAS:
- NO expliques qué vas a hacer. SOLO hazlo.
- NO uses frases como "I'll", "Let me", "Great", "Perfect", "Sure", "Absolutely".
- NO des contexto innecesario.
- Cada respuesta debe ser ÚNICAMENTE: el código/acción requerida.
- Si necesitas leer un archivo → usa read_file.
- Si necesitas modificar → usa replace_in_file o write_to_file.
- Si necesitas ejecutar tests → usa execute_command.
- NO pidas permiso para cosas obvias.
- NO hagas preguntas retóricas.
- Después de implementar: ejecuta tests para verificar.
- Si tests fallan → corrige inmediatamente sin preguntar.

RESUMEN: Actúa, no hables. Código, no explicaciones. Resultados, no promesas.`,

  pro: `Eres un arquitecto de software que genera planes de implementación EXACTOS.

Debes generar planes en formato PROMT ENGINEERING para que otro agente (deepseek-v4-flash) lo ejecute.

REGLAS:
1. Cada plan debe tener tareas atómicas (2-5 minutos cada una)
2. Para CADA tarea, incluir:
   - Archivos exactos a modificar (path completo)
   - Líneas exactas: "En service.ts:45-60, reemplazar X por Y"
   - Código exacto a escribir (incluir en bloques de código)
   - Comando exacto para tests
   - Mensaje de commit exacto
3. NO incluir explicaciones de por qué. Solo QUÉ hacer exactamente.
4. NO incluir opciones o alternativas.
5. NO incluir contexto que el implementador no necesite.
6. Máximo 1 párrafo de contexto técnico por tarea.
7. El plan debe ser ejecutable por un agente sin intervención humana.

FORMATO:
# PLAN: [Nombre del Feature]
## Task 1: [Nombre]
**Files:** path/File.tsx
1. En línea X, cambiar Y por Z
2. Ejecutar: comando exacto
3. Commit: mensaje exacto

## Task 2: [Nombre]
...

COSTO OBJETIVO: Cada tarea debe consumir < 500 tokens de output.`,

  classify: `Eres un clasificador de tareas de desarrollo. Debes analizar la instrucción del usuario y determinar si es COMPLEX (necesita planificación con un modelo más potente) o SIMPLE (puede implementarse directamente con un modelo rápido).

CLASIFICA como COMPLEX si la tarea involucra:
- Arquitectura o diseño de sistemas
- Migraciones de datos o schemas
- Cambios en múltiples archivos (3+)
- Seguridad, autenticación, autorización, RLS
- Webhooks, integraciones externas
- Nuevos features grandes
- Refactors significativos
- Performance, optimización
- Data model, Firestore indexes/rules
- Estrategia, planificación, trade-offs
- Componentes nuevos complejos
- Cosas que no has hecho antes (inciertas)

CLASIFICA como SIMPLE si:
- Bug fixes
- Tests (unitarios, e2e)
- UI simple (cambios de estilos, layout)
- Cambios en 1-2 archivos
- Ajustes menores
- Logging, debugging
- Hotfixes
- Documentación
- Typo fixes, eslint
- Cosas que has hecho muchas veces (rutinarias)

Si hay duda, clasifica como COMPLEX (fallback seguro).

Responde EXACTAMENTE con una línea JSON:
{"classification":"COMPLEX|SIMPLE","reason":"razón breve","complexity_score":0.0-1.0,"suggested_skill":"nombre del skill"}
`,
};

// ─── Classifier ────────────────────────────────────────────────────────────────

async function classifyTask(taskDescription: string): Promise<{
  classification: 'COMPLEX' | 'SIMPLE';
  reason: string;
  complexity_score: number;
  suggested_skill: string;
}> {
  // Fast path: heuristic pre-check (0 tokens, instant)
  const heuristic = classifyHeuristic(taskDescription);
  if (heuristic) {
    logCost(0, 0, 0, 'heuristic');
    return heuristic;
  }

  // AI path: use flash to classify (cheap)
  const result = await callDeepSeek('flash', SYSTEM_PROMPTS.classify, taskDescription, {
    temperature: 0.1,
    maxTokens: 150,
  });

  logCost(result.cost.input, result.cost.output, 0, 'classify');
  try {
    return JSON.parse(result.content.trim());
  } catch {
    return {
      classification: 'COMPLEX',
      reason: 'Fallback seguro - no se pudo clasificar',
      complexity_score: 0.8,
      suggested_skill: 'brainstorming',
    };
  }
}

// ─── Heuristic Classifier (0 tokens) ──────────────────────────────────────────

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

function classifyHeuristic(desc: string): {
  classification: 'COMPLEX' | 'SIMPLE';
  reason: string;
  complexity_score: number;
  suggested_skill: string;
} | null {

  const lower = desc.toLowerCase();

  // Check complex first
  for (const kw of COMPLEX_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return {
        classification: 'COMPLEX',
        reason: `Keyword detectada: "${kw}"`,
        complexity_score: 0.85,
        suggested_skill: 'brainstorming',
      };
    }
  }

  // Then check simple
  for (const kw of SIMPLE_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return {
        classification: 'SIMPLE',
        reason: `Keyword detectada: "${kw}"`,
        complexity_score: 0.2,
        suggested_skill: 'test-driven-development',
      };
    }
  }

  // Ambiguous — let AI decide
  return null;
}

// ─── Skill Selector ────────────────────────────────────────────────────────────

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

  // COMPLEX
  if (lower.includes('plan') || lower.includes('diseño') || lower.includes('arquitectura')) {
    return 'brainstorming → writing-plans → subagent-driven-development';
  }
  if (lower.includes('estrategia') || lower.includes('trade')) {
    return 'brainstorming';
  }
  if (lower.includes('migración') || lower.includes('refactor')) {
    return 'brainstorming → writing-plans → executing-plans';
  }
  return 'brainstorming → writing-plans → subagent-driven-development';
}

// ─── Plan Generator (PRO) ─────────────────────────────────────────────────────

async function generatePlan(taskDescription: string): Promise<void> {
  console.log(`\n🔍 Clasificando tarea...`);
  const classification = await classifyTask(taskDescription);

  if (classification.classification === 'SIMPLE') {
    console.log(`\n✅ Tarea SIMPLE — implementando directamente con flash...`);
    const result = await callDeepSeek(
      'flash',
      SYSTEM_PROMPTS.flash,
      taskDescription,
      { temperature: 0.2 }
    );
    console.log(`\n📝 Resultado:`);
    console.log(result.content);
    logCost(result.cost.input, result.cost.output, 0, 'flash');
    return;
  }

  console.log(`\n🧠 Tarea COMPLEJA — generando plan con deepseek-v4-pro...`);
  console.log(`   Motivación: ${classification.reason}`);
  console.log(`   Skill sugerido: ${classification.suggested_skill}`);

  const systemPlanPrompt = SYSTEM_PROMPTS.pro + `\n\nIMPORTANTE: La tarea a planificar es en este proyecto:\n${getProjectContext()}`;

  const planResult = await callDeepSeek(
    'pro',
    systemPlanPrompt,
    taskDescription,
    { temperature: 0.3, maxTokens: 4096 }
  );

  const timestamp = new Date().toISOString().split('T')[0];
  const planFilename = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 50);
  const planPath = path.join(
    process.cwd(),
    'docs',
    'plans',
    `${timestamp}-${planFilename}.md`
  );

  fs.writeFileSync(planPath, planResult.content, 'utf-8');

  console.log(`\n📋 Plan generado en: ${planPath}`);
  logCost(planResult.cost.input, planResult.cost.output, 0, 'pro');

  console.log(`\n🚀 Ejecutando plan con deepseek-v4-flash...\n`);

  // Extract tasks and execute each with flash
  const tasks = extractTasks(planResult.content);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n── Task ${i + 1}/${tasks.length}: ${task.title} ──`);

    const taskResult = await callDeepSeek(
      'flash',
      SYSTEM_PROMPTS.flash,
      `Plan context: ${task.context || ''}\n\nTask to execute:\n${task.instructions}`,
      { temperature: 0.2 }
    );

    console.log(taskResult.content);
    logCost(taskResult.cost.input, taskResult.cost.output, 0, `flash (task ${i + 1})`);
  }

  console.log(`\n✅ Plan ejecutado completamente.`);
  console.log(`   Reconstruye el grafo si modificaste código:`);
  console.log(`   python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`);
}

function extractTasks(planContent: string): { title: string; instructions: string; context?: string }[] {
  const tasks: { title: string; instructions: string; context?: string }[] = [];
  const taskRegex = /### Task \d+: (.*?)(?=### Task|\n\n## |$)/gs;
  let match;

  while ((match = taskRegex.exec(planContent)) !== null) {
    const title = match[1].trim();
    const instructions = match[0].trim();
    tasks.push({ title, instructions });
  }

  if (tasks.length === 0) {
    // Fallback: treat whole plan as single task
    tasks.push({ title: 'Implement plan', instructions: planContent });
  }

  return tasks;
}

// ─── Project Context ───────────────────────────────────────────────────────────

function getProjectContext(): string {
  try {
    const memoryPath = path.join(process.cwd(), '.ai-context', 'memory.json');
    if (fs.existsSync(memoryPath)) {
      const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
      return JSON.stringify({
        project: memory.project,
        patterns: memory.patterns,
        architecture_decisions: memory.architecture_decisions?.slice(-3),
      });
    }
  } catch {}
  return '';
}

// ─── Cost Logger ───────────────────────────────────────────────────────────────

function logCost(inputTokens: number, outputTokens: number, totalTokens: number, label: string) {
  console.log(`   [⚡ ${label}] Tokens: ${inputTokens} in / ${outputTokens} out`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { command, model, task } = parseArgs();

  if (!task) {
    console.error('❌ Debes proporcionar una descripción de la tarea.');
    process.exit(1);
  }

  try {
    switch (command) {
      case '--classify': {
        const result = await classifyTask(task);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case '--model': {
        const systemPrompt = model === 'pro' ? SYSTEM_PROMPTS.pro : SYSTEM_PROMPTS.flash;
        const result = await callDeepSeek(model!, systemPrompt, task, {
          temperature: model === 'pro' ? 0.3 : 0.2,
          maxTokens: model === 'pro' ? 4096 : 8192,
        });
        console.log(result.content);
        logCost(result.cost.input, result.cost.output, 0, model!);
        break;
      }

      case '--plan': {
        await generatePlan(task);
        break;
      }
    }
  } catch (error) {
    console.error(`\n❌ Error:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
