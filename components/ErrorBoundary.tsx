import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI to show on error */
  fallback?: ReactNode;
  /** Section name shown in the error message */
  section?: string;
  /** Whether to show a minimal inline error instead of a full page */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Generic Error Boundary — catches render/lifecycle errors in any subtree.
 * Prevents a component crash from taking down the entire app.
 *
 * Usage:
 *   <ErrorBoundary section="Dashboard">
 *     <Dashboard />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // In production, send to monitoring service (Sentry, etc.)
    if (import.meta.env.PROD) {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoHome = (): void => {
    window.location.hash = '/';
    this.handleReset();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Custom fallback provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    // Minimal inline error (for small widgets/cards)
    if (this.props.inline) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Esta sección no pudo cargarse.</span>
          <button
            onClick={this.handleReset}
            className="ml-auto flex items-center gap-1 text-xs underline hover:no-underline"
          >
            <RefreshCw className="w-3 h-3" />
            Reintentar
          </button>
        </div>
      );
    }

    // Full page error
    const { section } = this.props;
    const { error } = this.state;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Algo salió mal
          </h2>

          <p className="text-gray-500 text-sm mb-1">
            {section
              ? `La sección "${section}" encontró un error inesperado.`
              : 'Se produjo un error inesperado en la aplicación.'}
          </p>

          {import.meta.env.DEV && error && (
            <details className="mt-3 mb-4 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                Detalles del error (solo desarrollo)
              </summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-red-700 overflow-auto max-h-32 whitespace-pre-wrap">
                {error.message}
              </pre>
            </details>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={this.handleGoHome}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Home className="w-4 h-4" />
              Ir al inicio
            </button>
            <button
              onClick={this.handleReset}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Convenience HOC for wrapping page components.
 * Usage: export default withErrorBoundary(MyPage, 'My Page');
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  section?: string
): React.FC<P> {
  const displayName = section || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const WithBoundary: React.FC<P> = (props) => (
    <ErrorBoundary section={displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithBoundary;
}
