/**
 * Seed script: `npm run seed`
 * Loads fictitious sample data (4 categories, 20 products, documents, pages, dev users). Idempotent.
 * Refuses to run against a production environment unless --force is passed.
 */
import sharp from 'sharp'
import type { Payload } from 'payload'
import { getEnv } from '../src/env'
import { getPayloadClient } from '../src/lib/payload'
import { buildLexical, type SimpleBlock } from '../src/lib/richtext'
import { ATTRIBUTES, CATEGORIES, DOCUMENTS, PAGES, PRODUCTS } from './seed-data'

const env = getEnv()
if (env.SITE_ENV_RESOLVED === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to seed a production environment. Pass --force if you really mean it.')
  process.exit(1)
}

const payload: Payload = await getPayloadClient()
const password = process.env.SEED_PASSWORD ?? 'ChangeMe-12345!'

const log = (msg: string) => console.log(`[seed] ${msg}`)

async function findOne(collection: 'categories' | 'products' | 'media' | 'documents' | 'pages' | 'attribute-definitions' | 'users', where: object) {
  const res = await payload.find({ collection, where: where as never, limit: 1, depth: 0, overrideAccess: true, draft: false, pagination: false })
  return res.docs[0] as { id: number } | undefined
}

/** Minimal valid one-page PDF containing a line of text. */
function makePdf(text: string): Buffer {
  const safe = text.replace(/[()\\]/g, ' ').replace(/[^\x20-\x7e]/g, '')
  const stream = `BT /F1 14 Tf 72 720 Td (${safe}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

async function placeholderPng([r, g, b]: [number, number, number]): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="rgb(${r},${g},${b})"/><circle cx="400" cy="300" r="170" fill="rgba(255,255,255,0.35)"/><rect x="300" y="220" width="200" height="160" rx="14" fill="rgba(255,255,255,0.75)"/></svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

// ---- Users (non-production only) -------------------------------------------------------------
if (env.SITE_ENV_RESOLVED !== 'production') {
  for (const [email, name, role] of [
    ['admin@example.com', 'Admin User', 'admin'],
    ['catalogue@example.com', 'Catalogue Manager', 'catalogue_manager'],
    ['sales@example.com', 'Sales User', 'sales'],
  ] as const) {
    if (!(await findOne('users', { email: { equals: email } }))) {
      await payload.create({ collection: 'users', data: { email, name, role, password }, overrideAccess: true })
      log(`user ${email} (${role})`)
    }
  }
}

// ---- Settings --------------------------------------------------------------------------------
const settings = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })
if (!settings.phone && !settings.email) {
  await payload.updateGlobal({
    slug: 'site-settings',
    data: { phone: '(301) 555-0100', email: 'sales@example.com', hours: 'Monday to Friday, 8:00 am to 5:00 pm Eastern', retentionDays: 730 },
    overrideAccess: true,
  })
  log('site settings (sample contact details)')
}

// ---- Attributes ------------------------------------------------------------------------------
const attributeIds = new Map<string, number>()
for (const a of ATTRIBUTES) {
  const existing = await findOne('attribute-definitions', { key: { equals: a.key } })
  if (existing) {
    attributeIds.set(a.key, existing.id)
    continue
  }
  const created = await payload.create({
    collection: 'attribute-definitions',
    overrideAccess: true,
    data: {
      key: a.key, label: a.label, type: a.type, filterable: a.filterable, sortOrder: a.sortOrder,
      unit: 'unit' in a ? a.unit : undefined,
      options: 'options' in a ? a.options.map((o) => ({ value: o, label: o })) : undefined,
    },
  })
  attributeIds.set(a.key, created.id)
  log(`attribute ${a.key}`)
}

// ---- Media -----------------------------------------------------------------------------------
const mediaByTopPath = new Map<string, number>()
for (const cat of CATEGORIES) {
  const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const filename = `seed-${slug}.png`
  let media = await findOne('media', { filename: { equals: filename } })
  if (!media) {
    const data = await placeholderPng(cat.color)
    media = await payload.create({
      collection: 'media',
      overrideAccess: true,
      data: { alt: `Sample illustration for ${cat.name} products` },
      file: { data, mimetype: 'image/png', name: filename, size: data.length },
    })
    log(`media ${filename}`)
  }
  mediaByTopPath.set(slug, media.id)
}

// ---- Categories ------------------------------------------------------------------------------
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const categoryIds = new Map<string, number>()
let sortOrder = 0
for (const cat of CATEGORIES) {
  const topSlug = slugify(cat.name)
  let top = await findOne('categories', { path: { equals: topSlug } })
  if (!top) {
    top = await payload.create({
      collection: 'categories', overrideAccess: true,
      data: { name: cat.name, description: cat.description, image: mediaByTopPath.get(topSlug), sortOrder: sortOrder++, _status: 'published' },
    })
    log(`category ${topSlug}`)
  }
  categoryIds.set(topSlug, top.id)
  for (const child of cat.children) {
    const path = `${topSlug}/${slugify(child.name)}`
    let sub = await findOne('categories', { path: { equals: path } })
    if (!sub) {
      sub = await payload.create({
        collection: 'categories', overrideAccess: true,
        data: { name: child.name, description: child.description, parent: top.id, _status: 'published' },
      })
      log(`category ${path}`)
    }
    categoryIds.set(path, sub.id)
  }
}

// ---- Documents -------------------------------------------------------------------------------
const documentIds = new Map<string, number>()
for (const d of DOCUMENTS) {
  let doc = await findOne('documents', { title: { equals: d.title } })
  if (!doc) {
    const data = makePdf(d.title)
    doc = await payload.create({
      collection: 'documents', overrideAccess: true,
      data: { title: d.title, type: d.type, status: d.status, effectiveDate: d.effectiveDate, expiryDate: d.expiryDate, accessibleAlternative: false },
      file: { data, mimetype: 'application/pdf', name: `${d.key}.pdf`, size: data.length },
    })
    log(`document ${d.key}`)
  }
  documentIds.set(d.key, doc.id)
}

// ---- Products --------------------------------------------------------------------------------
let created = 0
for (const p of PRODUCTS) {
  if (await findOne('products', { sku: { equals: p.sku } })) continue
  const top = p.category.split('/')[0]!
  await payload.create({
    collection: 'products',
    overrideAccess: true,
    data: {
      sku: p.sku, name: p.name, summary: p.summary,
      description: buildLexical([{ type: 'p', text: p.description }]) as never,
      category: categoryIds.get(p.category),
      manufacturer: p.manufacturer, manufacturerPartNumber: p.mpn, unitOfMeasure: p.uom,
      availability: p.availability ?? 'available',
      specifications: p.specs.map(([label, value]) => ({ label, value })),
      attributes: Object.entries(p.attrs ?? {}).map(([key, value]) => ({ attribute: attributeIds.get(key)!, value })),
      images: [{ image: mediaByTopPath.get(top)! }],
      documents: (p.docs ?? []).map((k) => documentIds.get(k)!).filter(Boolean),
      _status: 'published',
    },
  })
  created += 1
}
log(`products created: ${created} (total in seed: ${PRODUCTS.length})`)

// ---- Pages -----------------------------------------------------------------------------------
for (const [slug, page] of Object.entries(PAGES)) {
  if (await findOne('pages', { slug: { equals: slug } })) continue
  await payload.create({
    collection: 'pages', overrideAccess: true,
    data: { title: page.title, slug, intro: page.intro, content: buildLexical(page.blocks as unknown as SimpleBlock[]) as never, _status: 'published' },
  })
  log(`page ${slug}`)
}

log('done')
process.exit(0)
