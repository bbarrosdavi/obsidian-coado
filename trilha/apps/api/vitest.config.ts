import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // cada arquivo recria o schema do banco de teste: rodar em série evita disputa
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
