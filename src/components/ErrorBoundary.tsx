import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? 'Unknown error' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[JaraWork] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#fdf6ef',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <p style={{ fontWeight: 700, fontSize: 18, color: '#1a1a1a' }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 13, color: '#888', maxWidth: 320 }}>
            {this.state.message}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }) }}
            style={{
              marginTop: 8,
              padding: '10px 28px',
              borderRadius: 14,
              background: '#e8700a',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
