// Design system — must come before index.css so Tailwind's Preflight doesn't override tokens
import '../../../design-system/tokens.css'
import '../../../design-system/components.css'
import './index.css'
import './styles/globals.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './providers'
import { App } from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>,
)
