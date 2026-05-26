import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['prisma/__tests__/**/*.{spec,test}.ts'],
  },
})
