import React, { Component, ReactNode } from 'react';

interface AIErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for AI-related components
 * Handles errors gracefully and provides fallback UI
 */
export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  constructor(props: AIErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AIErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AI Error Boundary caught an error:', error, errorInfo);
    
    // Custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to monitoring service if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          component: 'AIErrorBoundary',
          module: 'ai',
        },
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            padding: '16px',
            border: '1px solid #ffcdd2',
            borderRadius: '4px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            fontSize: '14px',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
            🤖 AI Assistant Error
          </div>
          <div style={{ marginBottom: '8px' }}>
            Something went wrong with the AI assistant. Please try refreshing the page.
          </div>
          <details style={{ fontSize: '12px', color: '#666' }}>
            <summary>Technical Details</summary>
            <pre style={{ marginTop: '8px', fontSize: '11px' }}>
              {this.state.error?.message}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}