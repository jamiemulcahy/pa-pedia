/**
 * Test helper utilities for rendering components with providers.
 *
 * Note: This file exports test utilities and helper functions, not React components.
 * Fast Refresh is not needed for test files as they run in the test environment,
 * not in the browser during development.
 */
/* eslint-disable react-refresh/only-export-components */

import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
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
  const { skipRouter = false, ...renderOptions } = options || {}

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
 *
 * Note: We explicitly list all exports instead of using `export *` to maintain
 * React Fast Refresh compatibility. Fast Refresh needs to verify that re-exported
 * items are not components to properly handle hot module replacement.
 */
export {
  // Core rendering
  render,
  // Screen queries
  screen,
  // Wait utilities
  waitFor,
  waitForElementToBeRemoved,
  // Query utilities
  within,
  // Event utilities
  fireEvent,
  // Cleanup
  cleanup,
  // Act utility
  act,
  // Type utilities
  type RenderResult,
  type RenderOptions
} from '@testing-library/react'

export { default as userEvent } from '@testing-library/user-event'
