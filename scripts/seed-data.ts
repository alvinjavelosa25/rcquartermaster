/**
 * Fictitious sample data for development, demos and automated tests.
 * None of this describes real products; do not load it into production.
 */

export interface SeedCategory {
  name: string
  description: string
  color: [number, number, number]
  children: { name: string; description: string }[]
}

export const CATEGORIES: SeedCategory[] = [
  {
    name: 'Janitorial Supplies',
    description: 'Cleaning chemicals, paper products and dispensers for facility sanitation.',
    color: [30, 100, 160],
    children: [
      { name: 'Cleaning Chemicals', description: 'Disinfectants, floor cleaners and surface cleaners.' },
      { name: 'Paper and Dispensers', description: 'Towels, tissue and dispensing systems.' },
    ],
  },
  {
    name: 'Personal Protective Equipment',
    description: 'Gloves, masks and eye protection for clinical and facility staff.',
    color: [20, 120, 90],
    children: [
      { name: 'Gloves', description: 'Exam and utility gloves.' },
      { name: 'Masks and Eye Protection', description: 'Procedure masks, respirators and eyewear.' },
    ],
  },
  {
    name: 'Facility Maintenance',
    description: 'Lighting, signage and safety products for building operations.',
    color: [150, 90, 20],
    children: [
      { name: 'Lighting', description: 'LED tubes, lamps and emergency lighting.' },
      { name: 'Safety and Signage', description: 'Caution signs, floor tape and safety markers.' },
    ],
  },
  {
    name: 'Medical-Surgical Supplies',
    description: 'Consumables for exam rooms and wound care.',
    color: [120, 40, 110],
    children: [
      { name: 'Wound Care', description: 'Dressings and gauze.' },
      { name: 'Exam Room Supplies', description: 'Exam table paper and room consumables.' },
    ],
  },
]

export const ATTRIBUTES = [
  { key: 'size', label: 'Size', type: 'enum', filterable: true, sortOrder: 1, options: ['S', 'M', 'L', 'XL'] },
  { key: 'material', label: 'Material', type: 'enum', filterable: true, sortOrder: 2, options: ['Nitrile', 'Vinyl', 'Cotton', 'Polypropylene', 'Aluminum', 'Plastic', 'Paper'] },
  { key: 'pack_quantity', label: 'Pack quantity', type: 'number', filterable: false, sortOrder: 3, unit: 'per case' },
  { key: 'sterile', label: 'Sterile', type: 'boolean', filterable: false, sortOrder: 4 },
] as const

export interface SeedDocument {
  key: string
  title: string
  type: 'spec_sheet' | 'certificate' | 'sds' | 'brochure' | 'other'
  status: 'draft' | 'published'
  effectiveDate?: string
  expiryDate?: string
}

export const DOCUMENTS: SeedDocument[] = [
  { key: 'sds-cleaner', title: 'Safety data sheet: multi-surface disinfectant cleaner (sample)', type: 'sds', status: 'published', effectiveDate: '2026-01-15' },
  { key: 'spec-gloves', title: 'Specification sheet: nitrile exam gloves (sample)', type: 'spec_sheet', status: 'published', effectiveDate: '2026-02-01' },
  { key: 'spec-led', title: 'Specification sheet: LED tube light (sample)', type: 'spec_sheet', status: 'published' },
  { key: 'cert-draft', title: 'Certificate: unreleased draft (sample, not public)', type: 'certificate', status: 'draft', expiryDate: '2027-12-31' },
]

export interface SeedProduct {
  sku: string
  name: string
  category: string // path
  summary: string
  description: string
  manufacturer: string
  mpn: string
  uom: string
  availability?: 'available' | 'on_request' | 'discontinued'
  attrs?: Record<string, string>
  specs: [string, string][]
  docs?: string[]
}

export const PRODUCTS: SeedProduct[] = [
  {
    sku: 'JAN-CHEM-1001', name: 'Multi-Surface Disinfectant Cleaner, 1 gal', category: 'janitorial-supplies/cleaning-chemicals',
    summary: 'Ready-to-use disinfectant cleaner for hard, non-porous surfaces.', description: 'Ready-to-use cleaner for daily use on counters, bedrails and fixtures. Sample product used for demonstration.',
    manufacturer: 'Sample Chemical Co.', mpn: 'SC-1001', uom: 'EA', attrs: { pack_quantity: '4' }, specs: [['Container size', '1 gal'], ['Form', 'Liquid, ready to use']], docs: ['sds-cleaner'],
  },
  {
    sku: 'JAN-CHEM-1002', name: 'Neutral Floor Cleaner Concentrate, 1 gal', category: 'janitorial-supplies/cleaning-chemicals',
    summary: 'Low-residue neutral pH floor cleaner concentrate.', description: 'Dilutable floor cleaner for sealed floors. Sample product used for demonstration.',
    manufacturer: 'Sample Chemical Co.', mpn: 'SC-1002', uom: 'EA', attrs: { pack_quantity: '4' }, specs: [['Container size', '1 gal'], ['pH', 'Neutral']],
  },
  {
    sku: 'JAN-CHEM-1003', name: 'Glass and Stainless Steel Cleaner, 32 oz', category: 'janitorial-supplies/cleaning-chemicals',
    summary: 'Streak-free cleaner for glass and stainless steel.', description: 'Trigger-spray cleaner for windows, mirrors and appliances. Sample product used for demonstration.',
    manufacturer: 'Sample Chemical Co.', mpn: 'SC-1003', uom: 'EA', attrs: { pack_quantity: '12' }, specs: [['Container size', '32 oz']],
  },
  {
    sku: 'JAN-PAP-2001', name: 'Hardwound Paper Towel Roll, White, 800 ft', category: 'janitorial-supplies/paper-and-dispensers',
    summary: 'White hardwound roll towels for high-traffic restrooms.', description: 'Roll towels for compatible dispensers. Sample product used for demonstration.',
    manufacturer: 'Sample Paper Mills', mpn: 'SP-2001', uom: 'CS', attrs: { material: 'Paper', pack_quantity: '6' }, specs: [['Roll length', '800 ft'], ['Rolls per case', '6']],
  },
  {
    sku: 'JAN-PAP-2002', name: 'Two-Ply Bath Tissue, 500 Sheets', category: 'janitorial-supplies/paper-and-dispensers',
    summary: 'Soft two-ply bath tissue in standard rolls.', description: 'Standard household-size rolls. Sample product used for demonstration.',
    manufacturer: 'Sample Paper Mills', mpn: 'SP-2002', uom: 'CS', attrs: { material: 'Paper', pack_quantity: '80' }, specs: [['Sheets per roll', '500'], ['Rolls per case', '80']],
  },
  {
    sku: 'JAN-DSP-2003', name: 'Touch-Free Paper Towel Dispenser', category: 'janitorial-supplies/paper-and-dispensers',
    summary: 'Battery-powered touch-free roll towel dispenser.', description: 'Wall-mounted dispenser with adjustable sheet length. Sample product used for demonstration.',
    manufacturer: 'Sample Dispensers Inc.', mpn: 'SD-2003', uom: 'EA', attrs: { material: 'Plastic' }, specs: [['Power', '4 D-cell batteries'], ['Mounting', 'Wall']],
  },
  {
    sku: 'PPE-GLV-3001', name: 'Nitrile Exam Gloves, Powder-Free, Medium', category: 'personal-protective-equipment/gloves',
    summary: 'Powder-free nitrile exam gloves, box of 100.', description: 'Textured fingertips for grip. Sample product used for demonstration.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-3001-M', uom: 'BX', attrs: { size: 'M', material: 'Nitrile', pack_quantity: '10' }, specs: [['Gloves per box', '100'], ['Thickness', '4 mil']], docs: ['spec-gloves', 'cert-draft'],
  },
  {
    sku: 'PPE-GLV-3002', name: 'Nitrile Exam Gloves, Powder-Free, Large', category: 'personal-protective-equipment/gloves',
    summary: 'Powder-free nitrile exam gloves, box of 100.', description: 'Textured fingertips for grip. Sample product used for demonstration.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-3001-L', uom: 'BX', attrs: { size: 'L', material: 'Nitrile', pack_quantity: '10' }, specs: [['Gloves per box', '100'], ['Thickness', '4 mil']], docs: ['spec-gloves'],
  },
  {
    sku: 'PPE-GLV-3003', name: 'Nitrile Exam Gloves, Powder-Free, X-Large', category: 'personal-protective-equipment/gloves',
    summary: 'Powder-free nitrile exam gloves, box of 100.', description: 'Textured fingertips for grip. Sample product used for demonstration.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-3001-XL', uom: 'BX', attrs: { size: 'XL', material: 'Nitrile', pack_quantity: '10' }, specs: [['Gloves per box', '100'], ['Thickness', '4 mil']], docs: ['spec-gloves'],
  },
  {
    sku: 'PPE-GLV-3004', name: 'Vinyl Exam Gloves, Medium', category: 'personal-protective-equipment/gloves',
    summary: 'Vinyl exam gloves for short-duration tasks.', description: 'Loose-fit vinyl gloves. Sample product used for demonstration.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-3004-M', uom: 'BX', availability: 'on_request', attrs: { size: 'M', material: 'Vinyl', pack_quantity: '10' }, specs: [['Gloves per box', '100']],
  },
  {
    sku: 'PPE-MSK-4001', name: 'Procedure Face Mask with Ear Loops, Box of 50', category: 'personal-protective-equipment/masks-and-eye-protection',
    summary: 'Three-layer procedure mask with ear loops.', description: 'Lightweight mask with a flexible nose wire. Sample product used for demonstration.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-4001', uom: 'BX', attrs: { material: 'Polypropylene', pack_quantity: '10' }, specs: [['Masks per box', '50'], ['Layers', '3']],
  },
  {
    sku: 'PPE-RSP-4002', name: 'Disposable Particulate Respirator, Flat-Fold, Box of 20', category: 'personal-protective-equipment/masks-and-eye-protection',
    summary: 'Flat-fold disposable respirator with adjustable nose clip.', description: 'Sample product used for demonstration only; no performance claims are made.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-4002', uom: 'BX', attrs: { material: 'Polypropylene', pack_quantity: '12' }, specs: [['Respirators per box', '20']],
  },
  {
    sku: 'PPE-EYE-4003', name: 'Anti-Fog Safety Glasses, Clear Lens', category: 'personal-protective-equipment/masks-and-eye-protection',
    summary: 'Lightweight wraparound safety glasses with anti-fog lens.', description: 'Sample product used for demonstration.',
    manufacturer: 'Sample Protective Co.', mpn: 'SP-4003', uom: 'EA', attrs: { material: 'Plastic', size: 'M' }, specs: [['Lens', 'Clear, anti-fog']],
  },
  {
    sku: 'FAC-LTG-5001', name: 'LED Tube Light, 4 ft, 4000K', category: 'facility-maintenance/lighting',
    summary: 'Ballast-bypass LED replacement tube, 4000K neutral white.', description: 'Direct-wire LED tube replacement. Sample product used for demonstration.',
    manufacturer: 'Sample Lighting', mpn: 'SL-5001', uom: 'CS', attrs: { material: 'Aluminum', pack_quantity: '25' }, specs: [['Length', '4 ft'], ['Color temperature', '4000K']], docs: ['spec-led'],
  },
  {
    sku: 'FAC-LTG-5002', name: 'LED Exit Sign with Battery Backup', category: 'facility-maintenance/lighting',
    summary: 'Red LED exit sign with rechargeable backup battery.', description: 'Sample product used for demonstration. This item is shown as discontinued.',
    manufacturer: 'Sample Lighting', mpn: 'SL-5002', uom: 'EA', availability: 'discontinued', attrs: { material: 'Plastic' }, specs: [['Mounting', 'Ceiling or wall']],
  },
  {
    sku: 'FAC-LTG-5003', name: 'LED A19 Lamp, 9W, Case of 12', category: 'facility-maintenance/lighting',
    summary: 'Dimmable 9W LED lamp, warm white.', description: 'Replacement lamp for standard fixtures. Sample product used for demonstration.',
    manufacturer: 'Sample Lighting', mpn: 'SL-5003', uom: 'CS', attrs: { pack_quantity: '12' }, specs: [['Wattage', '9W'], ['Base', 'E26']],
  },
  {
    sku: 'FAC-SGN-6001', name: 'Wet Floor Caution Sign, Two-Sided', category: 'facility-maintenance/safety-and-signage',
    summary: 'Folding two-sided caution sign in bilingual text.', description: 'Self-standing folding sign. Sample product used for demonstration.',
    manufacturer: 'Sample Safety', mpn: 'SS-6001', uom: 'EA', attrs: { material: 'Plastic' }, specs: [['Height', '25 in']],
  },
  {
    sku: 'FAC-SAF-6002', name: 'Anti-Slip Floor Tape, 2 in x 60 ft', category: 'facility-maintenance/safety-and-signage',
    summary: 'Textured adhesive tape for stairs and ramps.', description: 'Pressure-sensitive anti-slip tape. Sample product used for demonstration.',
    manufacturer: 'Sample Safety', mpn: 'SS-6002', uom: 'RL', attrs: { pack_quantity: '1' }, specs: [['Width', '2 in'], ['Length', '60 ft']],
  },
  {
    sku: 'MED-WND-7001', name: 'Sterile Gauze Pads, 4 in x 4 in, Box of 25', category: 'medical-surgical-supplies/wound-care',
    summary: 'Sterile 12-ply gauze pads, individually wrapped.', description: 'General-purpose dressing pads. Sample product used for demonstration.',
    manufacturer: 'Sample Medical', mpn: 'SM-7001', uom: 'BX', attrs: { material: 'Cotton', sterile: 'true', pack_quantity: '24' }, specs: [['Size', '4 in x 4 in'], ['Pads per box', '25']],
  },
  {
    sku: 'MED-EXM-8001', name: 'Exam Table Paper, 21 in x 225 ft, Case of 12', category: 'medical-surgical-supplies/exam-room-supplies',
    summary: 'Smooth white exam table paper rolls.', description: 'Standard width rolls for exam tables. Sample product used for demonstration.',
    manufacturer: 'Sample Medical', mpn: 'SM-8001', uom: 'CS', attrs: { material: 'Paper', sterile: 'false', pack_quantity: '12' }, specs: [['Width', '21 in'], ['Length', '225 ft']],
  },
]

export const PAGES = {
  about: {
    title: 'About RC Quartermaster',
    intro: 'Placeholder content. Replace with the approved capability statement before launch.',
    blocks: [
      { type: 'h2', text: 'Who we serve' },
      { type: 'p', text: 'RC Quartermaster LLC supplies facility products, equipment and services to government and healthcare buyers, including VA medical centres, federal facilities and healthcare systems.' },
      { type: 'h2', text: 'What we do' },
      { type: 'ul', items: ['Source and supply approved facility products', 'Provide quotations for single items and recurring needs', 'Support procurement teams with specifications and documents'] },
      { type: 'p', text: 'Business identifiers and certifications are shown below once confirmed.' },
    ],
  },
  services: {
    title: 'Services',
    intro: 'Placeholder content. Replace with the approved service descriptions.',
    blocks: [
      { type: 'h2', text: 'Product sourcing' },
      { type: 'p', text: 'Tell us what you need and we will source and quote it, including items that are not in the online catalogue.' },
      { type: 'h2', text: 'Recurring supply' },
      { type: 'p', text: 'Standing quotations for products you reorder regularly.' },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    intro: 'Draft for legal review. This text must be reviewed and approved before launch.',
    blocks: [
      { type: 'h2', text: 'What we collect' },
      { type: 'p', text: 'When you submit a request for quote we collect the details you enter (name, organisation, facility, role, email, phone, delivery details, instructions and any files you attach).' },
      { type: 'h2', text: 'How we use it' },
      { type: 'p', text: 'We use these details only to prepare and send your quotation and to follow up on your request. We do not sell personal information.' },
      { type: 'h2', text: 'Security and sharing' },
      { type: 'p', text: 'Requests and attachments are stored on managed services and are accessible only to authorised staff. Uploaded files are stored privately. Do not submit controlled unclassified, classified or patient information.' },
      { type: 'h2', text: 'How long we keep it' },
      { type: 'p', text: 'Requests and attachments are deleted automatically after the retention period configured by the business (currently 24 months).' },
      { type: 'h2', text: 'Analytics' },
      { type: 'p', text: 'We measure site use with privacy-friendly analytics. Request details are never sent to analytics providers.' },
    ],
  },
  accessibility: {
    title: 'Accessibility statement',
    intro: 'We aim for this website to meet WCAG 2.2 Level AA and to be usable with assistive technology.',
    blocks: [
      { type: 'h2', text: 'Our commitment' },
      { type: 'p', text: 'RC Quartermaster LLC is committed to making this website accessible to everyone, including people who use screen readers, keyboards, voice control or magnification. Procurement teams may request a Section 508 Accessibility Conformance Report.' },
      { type: 'h2', text: 'Known limitations' },
      { type: 'ul', items: ['Some manufacturer PDF documents may not be fully tagged. Contact us for an accessible alternative.', 'The staff administration area is outside the scope of this public statement.'] },
      { type: 'h2', text: 'Feedback and alternative formats' },
      { type: 'p', text: 'If you have trouble using any part of this site or need information in another format, please contact us using the details on the Contact page. We aim to respond within 2 business days.' },
      { type: 'p', text: 'This statement was prepared as part of the site build and will be updated after the pre-launch accessibility audit.' },
    ],
  },
} as const
