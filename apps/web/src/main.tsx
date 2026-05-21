import './index.css'
import '@phosphor-icons/web/regular'
import '@phosphor-icons/web/fill'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './providers'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { logger } from './lib/logger'

window.onerror = (_message, _src, _line, _col, error) => {
  logger.error(error?.message ?? 'Unhandled script error', {
    stack: error?.stack,
    context: 'window.onerror',
  })
}

window.onunhandledrejection = (event: PromiseRejectionEvent) => {
  const err = event.reason instanceof Error ? event.reason : null
  logger.error(err?.message ?? String(event.reason), {
    stack: err?.stack,
    context: 'unhandledrejection',
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <App />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
)
