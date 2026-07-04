/**
 * ErrorBoundary — Phase 7
 *
 * React class component (error boundaries must be class components).
 * Catches errors thrown during render/lifecycle of child tree.
 * Shows a graceful recovery UI with retry capability.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<p>Custom error UI</p>}>
 *     <RiskyPanel />
 *   </ErrorBoundary>
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom fallback. If omitted, the default Chronicle-styled recovery UI renders. */
  fallback?: ReactNode
  /** Human-readable context shown in the error UI (e.g. "Adventure Hub", "Combat Panel"). */
  context?: string
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.'
    return { hasError: true, errorMessage: message }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // Production: send to error-reporting service (e.g. Sentry)
    // For now, log to console and make it visible in the UI
    console.error(`[ErrorBoundary${this.props.context ? ` — ${this.props.context}` : ''}]`, error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  override render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div
        className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]"
        role="alert"
        aria-live="assertive"
      >
        <div className="chr-panel p-6 rounded-lg max-w-md w-full">
          <p className="stat-label text-harm-400 mb-2">
            {this.props.context ? `${this.props.context.toUpperCase()} ERROR` : 'SOMETHING WENT WRONG'}
          </p>
          <p className="text-void-300 text-sm mb-4">
            {this.state.errorMessage}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={this.handleRetry}
              className={[
                'px-4 py-2 rounded-md text-sm font-body font-semibold',
                'bg-arcane-600 hover:bg-arcane-500 text-void-950',
                'border border-arcane-500/50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
              ].join(' ')}
            >
              Try Again
            </button>
            <a
              href="/"
              className={[
                'px-4 py-2 rounded-md text-sm font-body font-semibold',
                'bg-transparent hover:bg-void-800 text-void-200',
                'border border-void-700/50 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
              ].join(' ')}
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    )
  }
}
