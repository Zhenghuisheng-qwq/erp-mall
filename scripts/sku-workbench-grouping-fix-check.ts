import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { runGroupingFixChecks } from './sku-workbench-grouping-fix-fixtures'

const baseline = process.env.SKU_GROUP_BASELINE || '2a0b1cc771c23620dab3f117f22fbfc98458f525'
const output = resolve(process.env.SKU_GROUP_OUTPUT_DIR || 'work/sku-workbench-fixes')
const phase = process.argv.includes('--before') ? 'before' : 'after'
const sha = (source: string) => createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
mkdirSync(output, { recursive: true })
if (phase === 'before') {
  let original: string
  try { original = execFileSync('git', ['show', `${baseline}:src/domain/skuWorkbenchQuery.ts`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch (error) { throw new Error(`Missing original SKU grouping baseline ${baseline}:src/domain/skuWorkbenchQuery.ts. Restore its Git object or set SKU_GROUP_BASELINE to the intended original commit.`, { cause: error }) }
  writeFileSync(resolve(output, 'before-skuWorkbenchQuery.ts'), original)
  const server = await createServer({ configFile: false, cacheDir: resolve(output, 'grouping-before-vite-cache'), server: { middlewareMode: true, hmr: false }, appType: 'custom', plugins: [{
    name: 'original-sku-grouping-module', enforce: 'pre',
    transform(_source, id) { if (id.replaceAll('\\', '/').endsWith('/src/domain/skuWorkbenchQuery.ts')) return original },
  }] })
  try {
    const check = await server.ssrLoadModule('/scripts/sku-workbench-grouping-fix-fixtures.ts')
    check.runGroupingFixChecks(phase, output, { baseline, querySha256: sha(original) })
  } finally { await server.close() }
} else {
  runGroupingFixChecks(phase, output, { baseline, querySha256: sha(readFileSync('src/domain/skuWorkbenchQuery.ts', 'utf8')) })
}
