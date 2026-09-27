import { reportError } from '@/lib/monitoring'

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
 * do the nearest thing to what React asked for instead:
 *
 * - removeChild: if the node still sits somewhere under this parent (the
 *   translator wrapped it), remove it from where it actually is. If it has
 *   left the parent (the translator replaced it), there is nothing of React's
 *   left to remove, and the translated copy stays on screen.
 * - insertBefore: insert before whichever child of this parent now holds the
 *   reference node. If the reference has left the parent, append: out of
 *   order, but present. Dropping the insert, as some versions of this
 *   workaround do, would lose the new content outright.
 *
 * Every other call goes straight to the native method, so an untranslated page
 * behaves exactly as before. This is the established workaround from
 * facebook/react#11538.
 *
 * It is the backstop, not the fix. As above, a guarded page can show stale,
 * leftover or misplaced text where it would have crashed, so each intervention
 * is reported: it marks a component the `local/no-bare-text-siblings` lint
 * rule missed.
 */

type RemoveChild = <T extends Node>(child: T) => T
type InsertBefore = <T extends Node>(node: T, child: Node | null) => T

let uninstall: (() => void) | null = null

/** One report per method per page: a translated page can hit this constantly. */
const reported = new Set<string>()

/** Enough of an element to find the component that rendered it. */
function describeNode(node: Node): string {
  if (!(node instanceof Element)) return node.nodeName
  const testId = node.getAttribute('data-testid')
  const classes = node.getAttribute('class')?.slice(0, 80)
  return [node.tagName.toLowerCase(), testId && `[data-testid=${testId}]`, classes && `.${classes}`]
    .filter(Boolean)
    .join('')
}

function recordMismatch(method: 'removeChild' | 'insertBefore', parent: Node, child: Node) {
  if (reported.has(method)) return
  reported.add(method)
  // Sampled like any other per-visitor failure: every translated visitor who
  // reaches the same component would otherwise report it.
  reportError(new Error(`Translation guard absorbed ${method} for a node that moved`), {
    level: 'warning',
    perVisitor: true,
    context: {
      parent: describeNode(parent),
      child: describeNode(child),
      childDetached: child.parentNode === null,
      // Chrome marks a translated page this way; other translators may not.
      chromeTranslated: /\btranslated-(ltr|rtl)\b/.test(document.documentElement.className),
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
