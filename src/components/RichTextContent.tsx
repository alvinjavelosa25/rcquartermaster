import { LinkJSXConverter, RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { SerializedLinkNode } from '@payloadcms/richtext-lexical'

type InternalDoc = { relationTo?: string; value?: { slug?: string; path?: string } | number | string }

function internalDocToHref({ linkNode }: { linkNode: SerializedLinkNode }): string {
  const doc = (linkNode.fields as { doc?: InternalDoc }).doc
  const v = doc && typeof doc.value === 'object' ? doc.value : undefined
  if (doc?.relationTo === 'products' && v?.slug) return `/products/${v.slug}`
  if (doc?.relationTo === 'categories' && v?.path) return `/categories/${v.path}`
  if (doc?.relationTo === 'pages' && v?.slug) return `/${v.slug}`
  return '/'
}

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
})

/** Renders Lexical rich text as React elements (no raw HTML injection). */
export function RichTextContent({ data }: { data: unknown }) {
  if (!data) return null
  return (
    <div className="prose-site">
      <RichText data={data as SerializedEditorState} converters={converters} />
    </div>
  )
}
