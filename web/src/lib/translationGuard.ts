import * as Sentry from '@sentry/react'

/**
 * Keeps browser page translation from crashing React (issue #519).
 *
 * Chrome, Edge and Yandex translate a page by swapping each text node for a
 * <font> element holding the translation. React still holds the original node
 * and still believes it is a child of the element it rendered into, so the next
 * structural update calls `parent.removeChild(text)` or
 * `parent.insertBefore(node, text)` on a parent that no longer contains it. The
 * DOM throws NotFoundError, ErrorBoundary catches it, and the whole page becomes
 * the error fallback (PA-PEDIA-4, PA-PEDIA-6).
 *
 * This wraps both methods so that, in exactly the case that would throw, they
 * do the nearest correct thing instead:
 *
 * - removeChild: if the node still sits somewhere under this parent (wrapped
 *   in place), remove it from where it actually is; if it is gone entirely
 *   (replaced), there is nothing left to remove.
 * - insertBefore: insert before whichever child of this parent now holds the
 *   reference node (the <font>), or append if the reference has left the
 *   subtree. Dropping the insert, as some versions of this workaround do,
 *   would lose the new content outright.
 *
 * Every other call goes straight to the native method, so an untranslated page
 * behaves exactly as before. This is the established workaround from
 * facebook/react#11538.
 *
 * It is the backstop, not the fix: a guarded page no longer crashes, but text
 * React updates after the translator replaced it still shows the old value. The
 * `local/no-bare-text-siblings` lint rule keeps components from relying on it.
 */

type RemoveChild = <T extends Node>(child: T) => T
type InsertBefore = <T extends Node>(node: T, child: Node | null) => T

let uninstall: (() => void) | null = null

/** One breadcrumb per method per page: a translated page can hit this constantly. */
const reported = new Set<string>()

function recordMismatch(method: 'removeChild' | 'insertBefore', parent: Node, child: Node) {
  if (reported.has(method)) return
  reported.add(method)
  Sentry.addBreadcrumb({
    category: 'dom.translation-guard',
    level: 'warning',
    message: `${method} on a node the page no longer holds where React left it`,
    data: {
      parent: parent.nodeName,
      child: child.nodeName,
      detached: child.parentNode === null,
      lang: document.documentElement.lang,
    },
  })
}

/** The child of `parent` that now contains `node`, or null if `node` left the subtree. */
function childContaining(parent: Node, node: Node): Node | null {
  let current: Node | null = node
  while (current && current.parentNode !== parent) current = current.parentNode
  return current
}

/**
 * Patches Node.prototype once. Returns a function that restores the native
 * methods, for tests; the app never calls it.
 */
export function installTranslationGuard(): () => void {
  if (uninstall) return uninstall
  if (typeof Node !== 'function' || !Node.prototype) return () => {}

  const nativeRemoveChild = Node.prototype.removeChild as RemoveChild
  const nativeInsertBefore = Node.prototype.insertBefore as InsertBefore

  const removeChild: RemoveChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) return nativeRemoveChild.call(this, child) as T
    recordMismatch('removeChild', this, child)
    if (child.parentNode && this.contains(child)) {
      return nativeRemoveChild.call(child.parentNode, child) as T
    }
    return child
  }

  const insertBefore: InsertBefore = function <T extends Node>(
    this: Node,
    node: T,
    child: Node | null
  ): T {
    if (!child || child.parentNode === this) return nativeInsertBefore.call(this, node, child) as T
    recordMismatch('insertBefore', this, child)
    return nativeInsertBefore.call(this, node, childContaining(this, child)) as T
  }

  Node.prototype.removeChild = removeChild
  Node.prototype.insertBefore = insertBefore

  uninstall = () => {
    // Only restore if nothing else has re-patched on top of us since.
    if (Node.prototype.removeChild === removeChild) Node.prototype.removeChild = nativeRemoveChild
    if (Node.prototype.insertBefore === insertBefore) Node.prototype.insertBefore = nativeInsertBefore
    uninstall = null
    reported.clear()
  }
  return uninstall
}
