import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
  },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
