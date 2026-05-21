import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error(error.message, {
      stack: (error.stack ?? '') + info.componentStack,
      context: 'ErrorBoundary',
    })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-n-50 p-8">
          <i className="ph ph-warning-circle text-5xl text-danger-text" />
          <h1 className="font-serif text-2xl text-n-900">Algo salió mal</h1>
          <p className="max-w-md text-center text-sm text-n-600">
            Se produjo un error inesperado. Por favor recarga la página.
          </p>
          <button
            className="mt-2 rounded-md bg-p-500 px-4 py-2 text-sm font-medium text-white hover:bg-p-700"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
