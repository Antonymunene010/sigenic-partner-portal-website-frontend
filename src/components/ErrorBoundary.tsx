import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

/**
 * App-wide crash guard. A render-time exception anywhere in the tree would
 * otherwise blank the whole page; here it's caught and replaced with a recover
 * card so a session can be salvaged with a reload instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-canvas dark:bg-canvas-dark">
        <div className="card max-w-md w-full p-6 text-center">
          <h1 className="text-lg font-semibold text-emphasis">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted dark:text-muted-dark">
            An unexpected error interrupted the page. Reloading usually clears it.
          </p>
          <button className="btn-accent mt-4" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
