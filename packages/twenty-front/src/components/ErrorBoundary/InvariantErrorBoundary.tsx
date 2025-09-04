/**
 * React Error Boundary for Invariant Error Handling
 *
 * Provides specialized error boundary component that gracefully handles
 * InvariantError instances and provides user-friendly error display.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
    InvariantError,
    invariant,
    debug as logDebug,
    error as logError,
} from 'twenty-shared/utils';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component specifically designed for handling InvariantError instances
 *
 * Features:
 * - Detects and specially handles InvariantError
 * - Provides configurable fallback UI
 * - Integrates with invariant logging system
 * - Supports custom error reporting
 *
 * @example
 * ```tsx
 * <InvariantErrorBoundary
 *   onError={(error, errorInfo) => {
 *     // Report to error tracking service
 *     Sentry.captureException(error, { extra: errorInfo });
 *   }}
 *   showErrorDetails={process.env.NODE_ENV === 'development'}
 * >
 *   <YourComponent />
 * </InvariantErrorBoundary>
 * ```
 */
export class InvariantErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state to show error UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error using invariant logging system
    if (error instanceof InvariantError) {
      logError('Invariant violation caught by error boundary:', error.message);
      logDebug('Error info:', errorInfo);
    } else {
      logError('Unexpected error caught by error boundary:', error.message);
    }

    // Store error info in state
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private renderErrorUI(): ReactNode {
    const { error, errorInfo } = this.state;
    const { fallback, showErrorDetails = false } = this.props;

    // Use custom fallback if provided
    if (fallback && error && errorInfo) {
      return fallback(error, errorInfo);
    }

    const isInvariantError = error instanceof InvariantError;
    const isProduction = process.env.NODE_ENV === 'production';

    return (
      <div
        style={{
          padding: '20px',
          margin: '20px',
          border: '1px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          color: '#c92a2a',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
          {isInvariantError ? 'Application Error' : 'Unexpected Error'}
        </h2>

        <p style={{ margin: '0 0 16px 0' }}>
          {isInvariantError && !isProduction
            ? error?.message
            : 'Something went wrong. Please try again or contact support if the problem persists.'}
        </p>

        {showErrorDetails && error && (
          <details style={{ marginBottom: '16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details (Development Mode)
            </summary>
            <pre
              style={{
                backgroundColor: '#f8f9fa',
                padding: '12px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '8px',
              }}
            >
              {error.stack}
            </pre>
            {errorInfo && (
              <pre
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '12px',
                  marginTop: '8px',
                }}
              >
                Component Stack: {errorInfo.componentStack}
              </pre>
            )}
          </details>
        )}

        <button
          onClick={this.handleRetry}
          style={{
            backgroundColor: '#228be6',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI();
    }

    return this.props.children;
  }
}

/**
 * Higher-order component that wraps a component with InvariantErrorBoundary
 *
 * @param Component - React component to wrap
 * @param boundaryProps - Props to pass to the error boundary
 * @returns Wrapped component with error boundary
 *
 * @example
 * ```tsx
 * const SafeUserProfile = withInvariantErrorBoundary(UserProfile, {
 *   onError: (error) => console.error('UserProfile error:', error),
 * });
 * ```
 */
export function withInvariantErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps?: Omit<Props, 'children'>,
) {
  const WrappedComponent = (props: P) => (
    <InvariantErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </InvariantErrorBoundary>
  );

  WrappedComponent.displayName = `withInvariantErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for handling invariant errors in functional components
 *
 * Provides utilities for error handling and recovery in functional components.
 *
 * @returns Error handling utilities
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { handleError, clearError, hasError } = useInvariantError();
 *
 *   const handleLoadUser = async () => {
 *     try {
 *       invariant(userId, 'User ID is required');
 *       const user = await fetchUser(userId);
 *       invariant(user, 'User not found');
 *       setUser(user);
 *     } catch (error) {
 *       handleError(error);
 *     }
 *   };
 *
 *   if (hasError) {
 *     return <div>Error occurred. <button onClick={clearError}>Retry</button></div>;
 *   }
 *
 *   return <div>User profile content</div>;
 * }
 * ```
 */
export function useInvariantError() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    if (error instanceof InvariantError) {
      logError('Invariant error in component:', error.message);
    } else {
      logError('Unexpected error in component:', error.message);
    }
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    hasError: error !== null,
    isInvariantError: error instanceof InvariantError,
    handleError,
    clearError,
  };
}

/**
 * React hook for safe invariant calls in components
 *
 * Provides a way to use invariant assertions that automatically
 * handle errors through the component's error handling system.
 *
 * @param onError - Optional error handler
 * @returns Safe invariant function
 *
 * @example
 * ```tsx
 * function UserForm() {
 *   const safeInvariant = useSafeInvariant((error) => {
 *     // Handle error locally
 *     setFormError(error.message);
 *   });
 *
 *   const handleSubmit = (data: FormData) => {
 *     if (!safeInvariant(data.email, 'Email is required')) return;
 *     if (!safeInvariant(data.name, 'Name is required')) return;
 *
 *     // Submit form
 *   };
 * }
 * ```
 */
export function useSafeInvariant(onError?: (error: Error) => void) {
  return React.useCallback(
    (
      condition: any,
      message?: string | number,
    ): condition is NonNullable<typeof condition> => {
      try {
        invariant(condition, message);
        return true;
      } catch (error) {
        if (onError) {
          onError(error as Error);
        } else {
          // Log error if no handler provided
          logError('Safe invariant failed:', message);
        }
        return false;
      }
    },
    [onError],
  );
}
