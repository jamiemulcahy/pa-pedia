import { useState } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import * as Sentry from '@sentry/react'
import { installTranslationGuard } from '../translationGuard'
import { simulateBrowserTranslation } from '@/tests/translation'

vi.mock('@sentry/react', () => ({ addBreadcrumb: vi.fn() }))

let uninstall: (() => void) | null = null

afterEach(() => {
  uninstall?.()
  uninstall = null
  vi.clearAllMocks()
})

function guard() {
  uninstall = installTranslationGuard()
}

/** A parent holding `text` wrapped in a <font>, as the translator leaves it. */
function translatedParent(text = 'hello') {
  const parent = document.createElement('div')
  const node = document.createTextNode(text)
  parent.appendChild(node)
  simulateBrowserTranslation(parent)
  return { parent, node, font: parent.firstChild as HTMLElement }
}

describe('installTranslationGuard', () => {
  it('leaves ordinary DOM calls untouched', () => {
    guard()
    const parent = document.createElement('div')
    const a = parent.appendChild(document.createElement('a'))
    const b = document.createElement('b')

    expect(parent.insertBefore(b, a)).toBe(b)
    expect(parent.insertBefore(document.createElement('i'), null)).toBeInstanceOf(HTMLElement)
    expect(parent.removeChild(a)).toBe(a)
    expect(Array.from(parent.childNodes, (n) => n.nodeName)).toEqual(['B', 'I'])
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
  })

  it('removes a wrapped node from the wrapper that now holds it', () => {
    guard()
    const { parent, node, font } = translatedParent()

    expect(parent.removeChild(node)).toBe(node)
    expect(node.parentNode).toBeNull()
    expect(font.childNodes).toHaveLength(0)
  })

  it('treats removing a node the translator already replaced as done', () => {
    guard()
    const parent = document.createElement('div')
    const node = parent.appendChild(document.createTextNode('hello'))
    node.replaceWith(document.createElement('font'))

    expect(parent.removeChild(node)).toBe(node)
    expect(parent.childNodes).toHaveLength(1)
  })

  it('does not remove a node that lives under a different parent', () => {
    guard()
    const parent = document.createElement('div')
    const elsewhere = document.createElement('div')
    const node = elsewhere.appendChild(document.createTextNode('hello'))

    expect(parent.removeChild(node)).toBe(node)
    expect(node.parentNode).toBe(elsewhere)
  })

  it('inserts before the wrapper when the reference node was wrapped', () => {
    guard()
    const { parent, node, font } = translatedParent()
    const icon = document.createElement('span')

    expect(parent.insertBefore(icon, node)).toBe(icon)
    expect(Array.from(parent.childNodes)).toEqual([icon, font])
  })

  it('appends when the reference node has left the parent entirely', () => {
    guard()
    const parent = document.createElement('div')
    const first = parent.appendChild(document.createElement('b'))
    const detached = document.createTextNode('gone')
    const icon = document.createElement('span')

    parent.insertBefore(icon, detached)
    expect(Array.from(parent.childNodes)).toEqual([first, icon])
  })

  it('records one breadcrumb per method, not one per call', () => {
    guard()
    const a = translatedParent()
    const b = translatedParent()
    a.parent.removeChild(a.node)
    b.parent.removeChild(b.node)
    translatedParent().parent.insertBefore(document.createElement('i'), a.node)

    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(2)
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'dom.translation-guard', level: 'warning' })
    )
  })

  it('is idempotent and restores the native methods', () => {
    const native = { remove: Node.prototype.removeChild, insert: Node.prototype.insertBefore }
    const first = installTranslationGuard()
    expect(installTranslationGuard()).toBe(first)
    expect(Node.prototype.removeChild).not.toBe(native.remove)

    first()
    expect(Node.prototype.removeChild).toBe(native.remove)
    expect(Node.prototype.insertBefore).toBe(native.insert)
  })
})

/**
 * The shape the lint rule forbids, kept here on purpose: a bare text node
 * beside siblings that appear and disappear. It is what crashed PA-PEDIA-4
 * (insertBefore) and PA-PEDIA-6 (removeChild).
 */
function Exposed() {
  const [on, setOn] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOn((v) => !v)}>
        toggle
      </button>
      <p data-testid="exposed">
        {on && <b>icon</b>}
        label{on && ' (on)'}
      </p>
    </div>
  )
}

describe('React under simulated translation', () => {
  it('throws NotFoundError without the guard (control)', () => {
    render(<Exposed />)
    simulateBrowserTranslation(screen.getByTestId('exposed'))

    // React rethrows commit-phase DOM errors from act() when nothing catches them.
    const errors: unknown[] = []
    const onError = (e: ErrorEvent) => {
      errors.push(e.error)
      e.preventDefault()
    }
    window.addEventListener('error', onError)
    try {
      act(() => screen.getByRole('button').click())
    } catch (e) {
      errors.push(e)
    } finally {
      window.removeEventListener('error', onError)
    }
    expect(errors.map(String).join('\n')).toMatch(/NotFoundError|not a child|can not be found/i)
  })

  it('keeps rendering with the guard installed', () => {
    guard()
    render(<Exposed />)
    simulateBrowserTranslation(screen.getByTestId('exposed'))

    act(() => screen.getByRole('button').click())
    expect(screen.getByTestId('exposed')).toHaveTextContent('icon')
    expect(screen.getByTestId('exposed')).toHaveTextContent('(on)')

    act(() => screen.getByRole('button').click())
    expect(screen.getByTestId('exposed')).not.toHaveTextContent('icon')
    expect(screen.getByTestId('exposed')).not.toHaveTextContent('(on)')
  })
})
