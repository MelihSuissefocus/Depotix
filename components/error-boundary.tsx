'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo })
    console.error('Error caught by boundary:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />
      }

      return <DefaultErrorFallback error={this.state.error!} resetError={this.resetError} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            <p>An unexpected error occurred. Please try again or contact support if the problem persists.</p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 p-3 bg-muted rounded text-left">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {error.message}
                  {'\n\n'}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={resetError} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// State component for consistent loading/error/empty states
interface StateBlockProps {
  loading?: boolean
  error?: string | Error | null
  empty?: boolean
  emptyMessage?: string
  children?: React.ReactNode
  onRetry?: () => void
}

export function StateBlock({ 
  loading, 
  error, 
  empty, 
  emptyMessage = 'No data available', 
  children, 
  onRetry 
}: StateBlockProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : error
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">Error</p>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
            <div className="h-6 w-6 rounded bg-muted-foreground/20"></div>
          </div>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Hook for error handling
export function useErrorHandler() {
  const [error, setError] = React.useState<string | null>(null)

  const handleError = React.useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'An unknown error occurred'
    setError(message)
    console.error('Error:', error)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return { error, handleError, clearError }
}

// Toast helpers for consistent notifications
export const showSuccessToast = (message: string) => {
  if (typeof window !== 'undefined') {
    const { toast } = require('react-hot-toast')
    toast.success(message)
  }
}

export const showErrorToast = (message: string) => {
  if (typeof window !== 'undefined') {
    const { toast } = require('react-hot-toast')
    toast.error(message)
  }
}

export const showLoadingToast = (message: string) => {
  if (typeof window !== 'undefined') {
    const { toast } = require('react-hot-toast')
    return toast.loading(message)
  }
}
