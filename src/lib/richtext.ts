/** Minimal helpers for Lexical rich text state (as stored by Payload). */

type LexicalNode = {
  type?: string
  text?: string
  tag?: string
  children?: LexicalNode[]
  [key: string]: unknown
}

export type LexicalState = { root: LexicalNode & { children: LexicalNode[] } }

/** Extract plain text from a Lexical state (used for search indexing and meta descriptions). */
export function lexicalToText(state: unknown): string {
  const root = (state as LexicalState | null | undefined)?.root
  if (!root) return ''
  const parts: string[] = []
  const walk = (node: LexicalNode) => {
    if (typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child)
      if (['paragraph', 'heading', 'listitem', 'quote'].includes(node.type ?? '')) parts.push('\n')
    }
  }
  walk(root)
  return parts
    .join(' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

const textNode = (text: string): LexicalNode => ({
  type: 'text',
  version: 1,
  text,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
})

const block = (
  type: string,
  children: LexicalNode[],
  extra: Record<string, unknown> = {},
): LexicalNode => ({
  type,
  version: 1,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  ...extra,
})

export type SimpleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2' | 'h3'; text: string }
  | { type: 'ul'; items: string[] }

/** Build a valid Lexical state from simple blocks (used by seed data and tests). */
export function buildLexical(blocks: SimpleBlock[]): LexicalState {
  const children = blocks.map((b): LexicalNode => {
    if (b.type === 'p')
      return block('paragraph', [textNode(b.text)], { textFormat: 0, textStyle: '' })
    if (b.type === 'ul') {
      return block(
        'list',
        b.items.map((item, i) => block('listitem', [textNode(item)], { value: i + 1 })),
        { listType: 'bullet', start: 1, tag: 'ul' },
      )
    }
    return block('heading', [textNode(b.text)], { tag: b.type })
  })
  return { root: { type: 'root', version: 1, direction: 'ltr', format: '', indent: 0, children } }
}
