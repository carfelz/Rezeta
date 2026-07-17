import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type * as BabelTypes from '@babel/types'
import type { NodePath } from '@babel/traverse'

// Dev-only babel plugin: injects data-component + data-file on every JSX element
// so you can inspect any node in DevTools and know exactly which component owns it.

function addComponentDebugAttrs({ types: t }: { types: typeof BabelTypes }) {
  return {
    visitor: {
      JSXOpeningElement(
        path: NodePath<BabelTypes.JSXOpeningElement>,
        state: { filename?: string },
      ) {
        // Skip self-closing fragments and html intrinsics (lowercase)
        const name = path.node.name
        if (t.isJSXMemberExpression(name)) return

        // Walk up to find enclosing function component (uppercase name)
        let componentName: string | null = null
        let funcPath = path.getFunctionParent()
        while (funcPath) {
          const node = funcPath.node
          if (t.isFunctionDeclaration(node) && node.id?.name) {
            componentName = node.id.name
            break
          }
          if (
            (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) &&
            funcPath.parentPath?.isVariableDeclarator()
          ) {
            const id = funcPath.parentPath.node.id
            if (t.isIdentifier(id)) {
              componentName = id.name
              break
            }
          }
          funcPath = funcPath.getFunctionParent()
        }

        // Only tag elements inside a component (uppercase = React component convention)
        if (!componentName || !/^[A-Z]/.test(componentName)) return

        // Skip if already tagged (e.g. plugin ran twice)
        const alreadyTagged = path.node.attributes.some(
          (a) =>
            t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'data-component',
        )
        if (alreadyTagged) return

        const relPath = (state.filename ?? '').replace(process.cwd() + '/', '')

        path.node.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('data-component'), t.stringLiteral(componentName)),
          t.jsxAttribute(t.jsxIdentifier('data-file'), t.stringLiteral(relPath)),
        )
      },
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: mode === 'development' ? [addComponentDebugAttrs] : [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    // Honor the port assigned by the preview harness (PORT env); default 5173.
    port: Number(process.env['PORT']) || 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}))
