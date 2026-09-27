/**
 * Simulates Chrome / Edge / Yandex page translation in jsdom (issue #519).
 *
 * Note: This file exports test utilities alongside a test-only component, and
 * Fast Refresh never runs in tests.
 */
/* eslint-disable react-refresh/only-export-components */

import { Component, type ReactNode } from 'react'

/**
 * How the translator swaps out a text node. Both leave React holding a node
 * that is no longer a child of the element React rendered it into:
 *
 * - `wrap`: the original node moves inside the <font>.
 * - `replace`: the <font> gets a new, translated text node and the original is
 *   detached, as Chrome does.
 */
export type TranslationMode = 'wrap' | 'replace'

const translatorFonts = new WeakSet<Node>()

/**
 * One translation pass over every non-blank text node under `root`, including
 * `root` itself. Returns how many nodes it swapped out.
 */
export function simulateBrowserTranslation(root: Node, mode: TranslationMode = 'wrap'): number {
  const doc = root.ownerDocument ?? (root as Document)
  // A TreeWalker never yields its own root, and the live observer hands us bare text nodes.
  const texts: Text[] = root.nodeType === Node.TEXT_NODE ? [root as Text] : []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) texts.push(walker.currentNode as Text)

  let swapped = 0
  for (const text of texts) {
    if (!text.data.trim() || !text.parentNode || translatorFonts.has(text.parentNode)) continue
    const font = doc.createElement('font')
    translatorFonts.add(font)
    text.replaceWith(font)
    font.appendChild(mode === 'wrap' ? text : doc.createTextNode(text.data))
    swapped++
  }
  return swapped
}

/**
 * Translates `root` now and keeps translating text as React adds it, the way a
 * live translator follows DOM changes. Returns a function that stops observing.
 */
export function startLiveTranslation(root: Node, mode: TranslationMode = 'wrap'): () => void {
  simulateBrowserTranslation(root, mode)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.isConnected && root.contains(node)) simulateBrowserTranslation(node, mode)
      })
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/** Every <font> the simulation has inserted under `root`, for live translation. */
export function translatedNodeCount(root: ParentNode): number {
  return Array.from(root.querySelectorAll('font')).filter((f) => translatorFonts.has(f)).length
}

/** Renders the caught error in place, so a test can see that React threw. */
export class CaptureBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return <div data-testid="boundary-tripped">{this.state.error.message}</div>
    }
    return this.props.children
  }
}
