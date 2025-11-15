import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { FactionProvider } from '@/contexts/FactionContext'

/**
 * Custom render function that wraps components with necessary providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
  skipRouter?: boolean
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialEntries = ['/'], skipRouter = false, ...renderOptions } = options || {}

  function Wrapper({ children }: { children: React.ReactNode }) {
    if (skipRouter) {
      return <FactionProvider>{children}</FactionProvider>
    }
    return (
      <BrowserRouter>
        <FactionProvider>{children}</FactionProvider>
      </BrowserRouter>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/**
 * Render component with FactionProvider only (no router)
 */
export function renderWithFactionProvider(
  ui: ReactElement,
  options?: RenderOptions
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <FactionProvider>{children}</FactionProvider>
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

/**
 * Wait for async operations to complete
 */
export async function waitForLoadingToFinish() {
  // Small delay to allow state updates to propagate
  await new Promise(resolve => setTimeout(resolve, 0))
}

/**
 * Re-export commonly used testing utilities
 */
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
