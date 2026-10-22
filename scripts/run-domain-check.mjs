import { createServer } from 'vite'

const entry = process.argv[2]
if (!entry) throw new Error('Usage: node scripts/run-domain-check.mjs scripts/<check>.ts [--baseline]')
const baseline = process.argv.includes('--baseline')
  ? (await import('./planning-performance-fixtures.mjs')).baselineSources()
  : undefined
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  plugins: baseline ? [{
    name: 'pinned-domain-check-baseline', enforce: 'pre',
    transform(code, id) {
      const match = /\/src\/domain\/(planning|draftComboPreview|logic)\.ts$/.exec(id)
      if (match) return baseline[match[1]]
    },
  }] : [],
})
try {
  await server.ssrLoadModule(entry)
} finally {
  await server.close()
}
