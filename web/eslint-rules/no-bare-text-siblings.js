import ts from 'typescript'

/**
 * Flags JSX text that React would render as its own DOM text node beside other
 * children.
 *
 * Browser page translation (Chrome, Edge, Yandex) swaps every text node on the
 * page for a <font> wrapper. React keeps a reference to the original node and
 * still believes it is a child of the element it rendered into, so the next
 * time a sibling is inserted before it, or the text itself is removed, React
 * calls insertBefore/removeChild against a parent that no longer holds the node
 * and throws NotFoundError (PA-PEDIA-4, PA-PEDIA-6, issue #519).
 *
 * Text that is the ONLY child of an element is immune: React writes it with
 * `textContent` instead of tracking a separate node. So the fix is always to
 * make each run of text the sole child of something:
 *
 *   <p>Showing {n} units</p>          →  <p>{`Showing ${n} units`}</p>
 *   <button><Icon />Save</button>     →  <button><Icon /><span>Save</span></button>
 *   {cond && ' (hidden)'}             →  {cond && <span> (hidden)</span>}
 *
 * Whether an `{expression}` renders text is decided from its TypeScript type,
 * so `{unit.name}` is caught but `{cond && <Badge />}` is not. Whitespace-only
 * text (`{' '}`) is allowed: translators leave it alone. A fragment has no
 * element of its own, so its text is flagged even when alone, and so is a lone
 * array of strings, which React renders one text node per item.
 *
 * Out of reach: a component that returns a bare string, and ReactNode slots
 * that receive an array at runtime. The runtime check in
 * src/tests/integration/translation.test.tsx covers what this cannot see.
 *
 * web/src/lib/translationGuard.ts stops the crash app-wide; this rule keeps
 * components from depending on it, because a guarded page still shows stale
 * text wherever React updated a node the translator had already replaced.
 */

const TEXT_FLAGS = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike

/** @param {ts.Type} type @param {ts.TypeChecker} checker @param {Set<ts.Type>} seen */
function canRenderText(type, checker, seen = new Set()) {
  if (seen.has(type)) return false
  seen.add(type)

  // An untyped value might be text; make the author say which it is.
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return true
  if (type.isTypeParameter()) {
    const constraint = checker.getBaseConstraintOfType(type)
    return !constraint || constraint === type || canRenderText(constraint, checker, seen)
  }
  // `str && <X />` types as `"" | Element`, but React renders nothing for an
  // empty string, and translators skip whitespace, so neither can be detached.
  if (type.isStringLiteral() && type.value.trim() === '') return false
  if (type.flags & TEXT_FLAGS) return true
  if (type.isUnion() || type.isIntersection()) {
    return type.types.some((t) => canRenderText(t, checker, seen))
  }
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return checker.getTypeArguments(/** @type {ts.TypeReference} */ (type)).some((t) =>
      canRenderText(t, checker, seen)
    )
  }
  // ReactNode includes Iterable<ReactNode>, which renders each item.
  if (type.symbol?.name === 'Iterable') {
    const [arg] = checker.getTypeArguments(/** @type {ts.TypeReference} */ (type))
    return arg ? canRenderText(arg, checker, seen) : false
  }
  return false
}

/**
 * An array of text renders one text node per item even as an element's only
 * child; textContent is used only for a lone string or number. ReactNode's own
 * Iterable member is left out: it would flag every `{children}` slot.
 */
/** @param {ts.Type} type @param {ts.TypeChecker} checker */
function isTextArray(type, checker) {
  if (type.isUnion()) return type.types.some((t) => isTextArray(t, checker))
  if (type.isTypeParameter()) {
    const constraint = checker.getBaseConstraintOfType(type)
    return !!constraint && constraint !== type && isTextArray(constraint, checker)
  }
  return (
    (checker.isArrayType(type) || checker.isTupleType(type)) &&
    checker.getTypeArguments(/** @type {ts.TypeReference} */ (type)).some((t) => canRenderText(t, checker))
  )
}

function isWhitespaceLiteral(expression) {
  if (expression.type === 'Literal') {
    return typeof expression.value === 'string' && expression.value.trim() === ''
  }
  if (expression.type === 'TemplateLiteral' && expression.expressions.length === 0) {
    return expression.quasis.every((q) => q.value.cooked?.trim() === '')
  }
  return false
}

/** Children that produce a DOM node. Whitespace JSX text and `{/* comments *\/}` do not. */
function renderedChildren(children) {
  return children.filter((child) => {
    if (child.type === 'JSXText') return child.value.trim() !== ''
    if (child.type === 'JSXExpressionContainer') return child.expression.type !== 'JSXEmptyExpression'
    return true
  })
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow JSX text rendered as a separate DOM text node beside sibling children, which crashes React under browser page translation',
    },
    schema: [],
    messages: {
      bareText:
        'Text beside sibling nodes crashes React under browser page translation (issue #519). Make it the only child of an element: wrap it in <span>, or merge adjacent text into one template literal.',
    },
  },

  create(context) {
    const services = context.sourceCode.parserServices
    if (!services?.program) {
      throw new Error('no-bare-text-siblings needs type information (parserOptions.projectService).')
    }
    const checker = services.program.getTypeChecker()

    function rendersText(child) {
      if (child.type === 'JSXText') return true
      if (child.type !== 'JSXExpressionContainer') return false
      if (isWhitespaceLiteral(child.expression)) return false
      return canRenderText(services.getTypeAtLocation(child.expression), checker)
    }

    function report(node) {
      context.report({ node, messageId: 'bareText' })
    }

    function check(node) {
      const children = renderedChildren(node.children)
      // A fragment has no element to take textContent, so even a lone text child
      // lands beside whatever surrounds the component at its call site.
      if (children.length >= 2 || node.type === 'JSXFragment') {
        children.filter(rendersText).forEach(report)
        return
      }
      const [only] = children
      if (
        only?.type === 'JSXExpressionContainer' &&
        isTextArray(services.getTypeAtLocation(only.expression), checker)
      ) {
        report(only)
      }
    }

    return { JSXElement: check, JSXFragment: check }
  },
}
