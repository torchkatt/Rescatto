/**
 * scripts/docs/build-pdfs.mjs
 *
 * Genera los manuales de usuario en PDF para cada rol de Rescatto.
 * Usa Playwright (ya instalado como devDependency) para convertir HTML → PDF.
 *
 * Uso:
 *   node scripts/docs/build-pdfs.mjs
 *   pnpm docs:pdf
 *
 * Prerequisitos:
 *   npx playwright install chromium   (solo la primera vez)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DOCS_DIR = join(ROOT, 'docs', 'manuals');
const OUT_DIR = join(ROOT, 'public', 'manuals');

// Versión del paquete (se lee de package.json)
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const VERSION = pkg.version || '1.0.0';

// Definición de los manuales
const MANUALS = [
  {
    role: 'customer',
    label: 'Cliente',
    color: '#10b981',
    files: [
      'customer/00-cover.md',
      '_shared/01-what-is-rescatto.md',
      'customer/01-primeros-pasos.md',
      '_shared/02-install-pwa.md',
      'customer/02-explorar-negocios.md',
      'customer/03-carrito-checkout.md',
      'customer/04-mis-pedidos.md',
      'customer/05-impacto-gamificacion.md',
      'customer/06-referidos-wallet.md',
      'customer/07-casos-de-uso.md',
      'customer/08-faq.md',
      '_shared/glossary.md',
      '_shared/99-support.md',
    ],
  },
  {
    role: 'venue-owner',
    label: 'Dueño de negocio',
    color: '#f59e0b',
    files: [
      'venue-owner/00-cover.md',
      '_shared/01-what-is-rescatto.md',
      'venue-owner/01-primeros-pasos.md',
      '_shared/02-install-pwa.md',
      'venue-owner/02-gestion-productos.md',
      'venue-owner/03-flash-deals.md',
      'venue-owner/04-gestion-pedidos.md',
      'venue-owner/05-estadisticas-finanzas.md',
      'venue-owner/06-faq.md',
      '_shared/glossary.md',
      '_shared/99-support.md',
    ],
  },
  {
    role: 'kitchen-staff',
    label: 'Personal de cocina',
    color: '#8b5cf6',
    files: [
      'kitchen-staff/00-cover.md',
      '_shared/01-what-is-rescatto.md',
      'kitchen-staff/01-kds.md',
      '_shared/02-install-pwa.md',
      '_shared/glossary.md',
      '_shared/99-support.md',
    ],
  },
  {
    role: 'driver',
    label: 'Domiciliario',
    color: '#3b82f6',
    files: [
      'driver/00-cover.md',
      '_shared/01-what-is-rescatto.md',
      'driver/01-dashboard-entregas.md',
      '_shared/02-install-pwa.md',
      '_shared/glossary.md',
      '_shared/99-support.md',
    ],
  },
  {
    role: 'admin',
    label: 'Administrador',
    color: '#ef4444',
    files: [
      'admin/00-cover.md',
      '_shared/01-what-is-rescatto.md',
      'admin/01-overview-panel.md',
      'admin/02-gestion-usuarios.md',
      'admin/03-gestion-negocios.md',
      'admin/04-finanzas-auditoria.md',
      '_shared/glossary.md',
      '_shared/99-support.md',
    ],
  },
];

/** Convierte Markdown básico a HTML (sin dependencias externas) */
function mdToHtml(md) {
  return md
    // Encabezados
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Negrita + cursiva
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Código inline
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Tablas
    .replace(/^\|(.+)\|$/gm, (line) => {
      if (line.match(/^\|[-| ]+\|$/)) return '';
      const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
      const isHeader = false;
      return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
    })
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Listas ordenadas
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Listas desordenadas
    .replace(/^[-✅❌] (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Separadores horizontales
    .replace(/^---$/gm, '<hr/>')
    // Párrafos (líneas vacías)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hbplctu])(.+)$/gm, '<p>$1</p>');
}

function buildHtml(manual, content) {
  const today = new Date().toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Rescatto — Manual ${manual.label}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1e293b;
      background: #fff;
    }

    /* Portada */
    .cover {
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 60px 80px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
    }
    .cover-badge {
      display: inline-block;
      background: ${manual.color};
      color: white;
      font-size: 9pt;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 24px;
    }
    .cover h1 {
      font-size: 38pt;
      font-weight: 700;
      line-height: 1.15;
      margin-bottom: 16px;
      color: white;
    }
    .cover h1 span { color: ${manual.color}; }
    .cover-subtitle {
      font-size: 14pt;
      color: #94a3b8;
      margin-bottom: 48px;
    }
    .cover-meta {
      font-size: 10pt;
      color: #64748b;
      margin-top: auto;
      padding-top: 60px;
    }
    .cover-meta span { color: #94a3b8; margin-right: 24px; }

    /* Contenido */
    .content {
      padding: 48px 64px;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 24pt;
      font-weight: 700;
      color: #0f172a;
      margin: 36px 0 16px;
      padding-bottom: 8px;
      border-bottom: 3px solid ${manual.color};
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      font-weight: 600;
      color: #1e293b;
      margin: 28px 0 12px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      font-weight: 600;
      color: #334155;
      margin: 20px 0 8px;
      page-break-after: avoid;
    }

    p {
      margin-bottom: 12px;
      orphans: 3;
      widows: 3;
    }

    ul, ol { margin: 8px 0 16px 24px; }
    li { margin-bottom: 6px; }

    code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10pt;
      font-family: 'Menlo', 'Monaco', monospace;
      color: #e11d48;
    }

    blockquote {
      border-left: 4px solid ${manual.color};
      padding: 12px 20px;
      background: #f8fafc;
      color: #475569;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
      font-style: italic;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 24px;
      font-size: 10pt;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 8.5pt;
      letter-spacing: 0.05em;
    }
    tr:hover td { background: #fafafa; }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 32px 0;
    }

    /* Pie de página */
    @page {
      size: A4;
      margin: 20mm 18mm;
      @bottom-center {
        content: "Rescatto — Manual ${manual.label}  ·  v${VERSION}  ·  Página " counter(page) " de " counter(pages);
        font-size: 8pt;
        color: #94a3b8;
      }
    }

    @media print {
      h1, h2, h3 { page-break-after: avoid; }
      table, blockquote { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <span class="cover-badge">Manual de usuario</span>
    <h1>Rescatto<br/><span>${manual.label}</span></h1>
    <p class="cover-subtitle">Guía completa para sacar el máximo provecho de la plataforma</p>
    <div class="cover-meta">
      <span>Versión ${VERSION}</span>
      <span>Actualizado: ${today}</span>
      <span>rescatto.com</span>
    </div>
  </div>
  <div class="content">
    ${content}
  </div>
</body>
</html>`;
}

async function buildPdf(browser, manual) {
  const mdChunks = manual.files.map(f => {
    const filePath = join(DOCS_DIR, f);
    if (!existsSync(filePath)) {
      console.warn(`  ⚠ Archivo no encontrado: ${f}`);
      return '';
    }
    return readFileSync(filePath, 'utf-8');
  });

  const combinedMd = mdChunks.join('\n\n---\n\n');
  const html = buildHtml(manual, mdToHtml(combinedMd));

  const outPath = join(OUT_DIR, `rescatto-${manual.role}-v${VERSION}.pdf`);

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
  });
  await page.close();

  writeFileSync(outPath, pdfBuffer);

  const sizeKB = Math.round(pdfBuffer.length / 1024);
  return { role: manual.role, label: manual.label, sizeKB };
}

async function main() {
  console.log('\n📚 Rescatto — Generador de manuales PDF\n');

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
    console.log(`  ✓ Directorio creado: public/manuals/`);
  }

  const browser = await chromium.launch({ headless: true });
  const manifest = { generatedAt: new Date().toISOString(), version: VERSION, manuals: [] };
  const errors = [];

  for (const manual of MANUALS) {
    process.stdout.write(`  Generando ${manual.label}...`);
    try {
      const { sizeKB } = await buildPdf(browser, manual);
      const entry = {
        role: manual.role,
        label: manual.label,
        url: `/manuals/rescatto-${manual.role}-v${VERSION}.pdf`,
        version: VERSION,
        updatedAt: new Date().toISOString(),
        sizeKB,
      };
      manifest.manuals.push(entry);
      console.log(` ✓ (${sizeKB} KB)`);
    } catch (err) {
      console.log(` ✗ ERROR: ${err.message}`);
      errors.push({ role: manual.role, error: err.message });
    }
  }

  await browser.close();

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n  ✓ manifest.json actualizado');

  if (errors.length > 0) {
    console.log(`\n⚠ ${errors.length} error(es) durante la generación:`);
    errors.forEach(e => console.log(`  - ${e.role}: ${e.error}`));
    process.exit(1);
  }

  console.log('\n✅ Todos los PDFs generados exitosamente.\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
