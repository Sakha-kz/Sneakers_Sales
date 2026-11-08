'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}
interface State {
  failed: boolean
}
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }
  static getDerivedStateFromError(): State {
    return { failed: true }
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Keep the fallback isolated from the rest of the storefront. */
  }
  render() {
    return this.state.failed
      ? (this.props.fallback ?? <div className='error-state'>The experience could not load. Refresh to try again.</div>)
      : this.props.children
  }
}
