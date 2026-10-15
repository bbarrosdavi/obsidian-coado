// Empacota a API com esbuild. Dependências npm ficam externas (instaladas no container);
// o @coado/shared é código TypeScript do monorepo e entra no bundle.
import { readFile, rm } from 'node:fs/promises'
import { build } from 'esbuild'

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'))
const external = Object.keys(pkg.dependencies).filter((name) => name !== '@coado/shared')

await rm(new URL('./dist', import.meta.url), { recursive: true, force: true })

await build({
  entryPoints: ['src/server.ts', 'src/migrate.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external,
  // algumas libs CommonJS ainda usam require dinâmico
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'info',
})
