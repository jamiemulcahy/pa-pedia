/**
 * Simulates Chrome / Edge / Yandex page translation in jsdom (issue #519).
 *
 * The translator moves every non-blank text node into a <font> element that
 * takes its place. React keeps pointing at the original node and still thinks
 * its parent is the element it rendered into, which is what makes a later
 * removeChild/insertBefore throw NotFoundError.
 */

const translatorFonts = new WeakSet<Node>()

function wrapTextNodes(root: Node): number {
  const doc = root.ownerDocument ?? (root as Document)
  // A TreeWalker never yields its own root, and the observer hands us bare text nodes.
  const texts: Text[] = root.nodeType === Node.TEXT_NODE ? [root as Text] : []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) texts.push(walker.currentNode as Text)

  let wrapped = 0
  for (const text of texts) {
    if (!text.data.trim() || !text.parentNode || translatorFonts.has(text.parentNode)) continue
    const font = doc.createElement('font')
    translatorFonts.add(font)
    text.replaceWith(font)
    font.appendChild(text)
    wrapped++
  }
  return wrapped
}

/** One translation pass over everything currently under `root`. Returns how many nodes it moved. */
export function simulateBrowserTranslation(root: Node): number {
  return wrapTextNodes(root)
}

/**
 * Translates `root` now and keeps translating text as React adds it, the way a
 * live translator follows DOM changes. Returns a function that stops observing.
 */
export function startLiveTranslation(root: Node): () => void {
  wrapTextNodes(root)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node.isConnected && root.contains(node)) wrapTextNodes(node)
      })
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => observer.disconnect()
}

/** Every <font> the simulation has inserted under `root`. */
export function translatedNodeCount(root: ParentNode): number {
  return Array.from(root.querySelectorAll('font')).filter((f) => translatorFonts.has(f)).length
}
