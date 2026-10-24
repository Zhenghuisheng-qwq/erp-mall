import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

// Keep ordinary development unchanged; audit runs can isolate all incremental caches.
const args = ['-b']
if (process.env.CHECK_OUTPUT_DIR) {
  const output = resolve(process.env.CHECK_OUTPUT_DIR)
  mkdirSync(output, { recursive: true })
  for (const name of ['app', 'node']) {
    writeFileSync(resolve(output, `tsconfig.${name}.json`), JSON.stringify({
      extends: resolve(`tsconfig.${name}.json`),
      compilerOptions: { tsBuildInfoFile: resolve(output, `${name}.tsbuildinfo`) },
    }, null, 2))
  }
  const config = resolve(output, 'tsconfig.json')
  writeFileSync(config, JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.node.json' }] }, null, 2))
  args.push(config)
}
const result = spawnSync(process.execPath, [resolve('node_modules/vue-tsc/bin/vue-tsc.js'), ...args, ...process.argv.slice(2)], { stdio: 'inherit' })
if (result.error) throw result.error
process.exit(result.status ?? 1)
