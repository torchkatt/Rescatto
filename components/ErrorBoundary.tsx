import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { ErrorState } from './common/ErrorState';

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
    if (import.meta.env.PROD) {
      Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <ErrorState 
          error={this.state.error || new Error('Unknown Error')}
          resetErrorBoundary={this.handleReset}
          title={this.props.section ? `Error en ${this.props.section}` : undefined}
        />
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
