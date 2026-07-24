/**
 * Puerta de seguridad de dependencias. Equivale a `npm audit --audit-level=high`, pero
 * permite EXCEPCIONES explícitas y documentadas por identificador de aviso (GHSA), para
 * casos en los que no existe hoy una versión libre de avisos y el aviso concreto NO es
 * aplicable a DocLab. Falla ante cualquier vulnerabilidad high/critical no permitida.
 *
 * Regla de oro: una excepción solo es legítima si (a) está justificada por escrito y
 * (b) no afecta realmente a esta aplicación. Revísalas al actualizar dependencias.
 */
import { execSync } from 'node:child_process';

/** GHSA permitidos → motivo. Manténlo al mínimo y documentado. */
const ALLOWED = new Map([
  [
    'GHSA-qwww-vcr4-c8h2',
    'react-router «RSC Mode CSRF»: DocLab es una SPA de cliente (createBrowserRouter) sin ' +
      'React Server Components ni acciones de servidor, así que el vector no existe aquí. ' +
      'No hay versión de react-router sin avisos a día de hoy; usamos la más segura (7.18.1).',
  ],
]);

function runAudit() {
  try {
    return JSON.parse(execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) {
    // npm audit devuelve código ≠0 cuando hay vulnerabilidades, pero imprime el JSON igualmente.
    if (e.stdout) { try { return JSON.parse(e.stdout); } catch { /* cae abajo */ } }
    console.error('audit-ci: no se pudo ejecutar/parsear `npm audit --json`.');
    process.exit(2);
  }
}

const report = runAudit();
const vulns = report.vulnerabilities ?? {};

// Reunimos todos los avisos (GHSA) high/critical presentes en el árbol.
const found = new Map(); // GHSA → { severity, title }
for (const v of Object.values(vulns)) {
  if (v.severity !== 'high' && v.severity !== 'critical') continue;
  for (const via of v.via ?? []) {
    if (typeof via !== 'object' || !via.url) continue;
    const id = via.url.match(/GHSA-[\w-]+/)?.[0];
    if (id) found.set(id, { severity: via.severity ?? v.severity, title: via.title ?? '' });
  }
}

const offenders = [...found].filter(([id]) => !ALLOWED.has(id));

if (offenders.length) {
  console.error('\naudit-ci: vulnerabilidades high/critical NO permitidas:\n');
  for (const [id, info] of offenders) console.error(`  ✗ ${id} (${info.severity}) — ${info.title}`);
  console.error('\nCorrige la dependencia o, si de verdad no aplica, añade una excepción justificada en scripts/audit-ci.mjs.\n');
  process.exit(1);
}

const allowedActive = [...found.keys()].filter((id) => ALLOWED.has(id));
if (allowedActive.length) {
  console.log('audit-ci: OK. Excepciones documentadas activas (no aplicables a DocLab):');
  for (const id of allowedActive) console.log(`  • ${id}`);
} else {
  console.log('audit-ci: OK. Sin vulnerabilidades high/critical.');
}
