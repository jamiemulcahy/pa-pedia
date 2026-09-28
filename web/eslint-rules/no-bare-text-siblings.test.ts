// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'
import rule from './no-bare-text-siblings.js'

const webRoot = new URL('..', import.meta.url).pathname
const FIXTURE = 'lint-fixture.tsx'

// Type-aware, so fixtures go through a real TypeScript program. A fixture is
// never on disk, which is what allowDefaultProject is for; tsconfig.app.json
// supplies the JSX and React types.
const eslint = new ESLint({
  cwd: webRoot,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.tsx'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: { allowDefaultProject: [FIXTURE], defaultProject: 'tsconfig.app.json' },
          tsconfigRootDir: webRoot,
        },
      },
      plugins: { local: { rules: { 'no-bare-text-siblings': rule } } },
      rules: { 'local/no-bare-text-siblings': 'error' },
    },
  ],
})

/** Lints `jsx` as the return value of a component, and returns the flagged source snippets. */
async function flagged(jsx: string): Promise<string[]> {
  const code = `import type { ReactElement, ReactNode } from 'react'
declare const n: number
declare const s: string
declare const names: string[]
declare const flag: boolean
declare const children: ReactNode
declare const untyped: any
declare function Icon(): ReactNode
export function Fixture<T extends ReactNode, E extends ReactElement>(generic: T, element: E) {
  return (${jsx})
}
`
  const [result] = await eslint.lintText(code, { filePath: FIXTURE })
  const fatal = result.messages.find((m) => m.fatal)
  if (fatal) throw new Error(fatal.message)
  const lines = code.split('\n')
  return result.messages.map((m) =>
    lines[m.line - 1].slice(m.column - 1, m.endLine === m.line ? m.endColumn! - 1 : undefined).trim()
  )
}

describe('local/no-bare-text-siblings', { timeout: 60_000 }, () => {
  it.each([
    ['a lone text child', '<p>Hello</p>'],
    ['a lone expression child', '<p>{`Showing ${n} units`}</p>'],
    ['text wrapped beside an element', '<button><Icon /><span>Save</span></button>'],
    ['whitespace between elements', "<p><b>a</b>{' '}<i>b</i></p>"],
    ['a string guarding an element', '<p><b>a</b>{s && <i />}</p>'],
    ['an element list beside an element', '<ul><li>a</li>{names.map((x) => <li key={x}>{x}</li>)}</ul>'],
    ['a conditional element beside an element', '<p>{flag ? <b /> : <i />}<Icon /></p>'],
    ['a comment beside text', '<p>{/* note */}Hello</p>'],
    ['a lone string expression', '<p>{s}</p>'],
    ['a lone element list', '<ul>{names.map((x) => <li key={x}>{x}</li>)}</ul>'],
    ['a lone ReactNode slot', '<div>{children}</div>'],
    ['an element-constrained generic beside an element', '<p><b />{element}</p>'],
  ])('allows %s', async (_, jsx) => {
    expect(await flagged(jsx)).toEqual([])
  })

  it.each([
    ['JSX text beside an element', '<button><Icon />Save</button>', ['Save']],
    ['text split around a value', '<p>Showing {n} units</p>', ['Showing', '{n}', 'units']],
    ['a conditional string', '<p><b>a</b>{flag && " (hidden)"}</p>', ['{flag && " (hidden)"}']],
    ['a number guarding an element', '<p><b>a</b>{n && <i />}</p>', ['{n && <i />}']],
    ['ReactNode children', '<button><Icon />{children}</button>', ['{children}']],
    ['an array of strings', '<p><b>a</b>{names}</p>', ['{names}']],
    ['an untyped value', '<p><b>a</b>{untyped}</p>', ['{untyped}']],
    ['text in a fragment', '<><Icon />Save</>', ['Save']],
    ['lone text in a fragment', '<>{s}</>', ['{s}']],
    ['a lone array of strings', '<p>{names}</p>', ['{names}']],
    ['a text-capable generic beside an element', '<p><b />{generic}</p>', ['{generic}']],
  ])('flags %s', async (_, jsx, expected) => {
    expect(await flagged(jsx)).toEqual(expected)
  })
})
