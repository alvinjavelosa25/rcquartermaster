import type { GlobalConfig } from 'payload'
import { adminOnly, anyStaff } from '@/access'
import { revalidateCatalogue } from '@/lib/cache'

/**
 * Site-wide settings. Staff-only through the API. The public site reads display fields through
 * src/lib/data/settings.ts, so sensitive values (RFQ recipients, retention) never reach the browser.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site settings',
  admin: { group: 'Administration' },
  access: { read: anyStaff, update: adminOnly },
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidateCatalogue()
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Company',
          fields: [
            {
              name: 'companyName',
              type: 'text',
              required: true,
              defaultValue: 'RC Quartermaster LLC',
            },
            { name: 'legalName', type: 'text' },
            {
              name: 'tagline',
              type: 'text',
              defaultValue:
                'Facility supplies, equipment and services for government and healthcare buyers.',
            },
            {
              name: 'homeHeadline',
              type: 'text',
              defaultValue: 'Find approved supplies. Request a quote.',
            },
            {
              name: 'homeSubheadline',
              type: 'textarea',
              defaultValue:
                'Browse approved products for VA medical centres, federal facilities and healthcare systems, review specifications and submit one request for quote.',
            },
          ],
        },
        {
          label: 'Contact',
          fields: [
            { name: 'phone', type: 'text' },
            { name: 'email', type: 'email' },
            { name: 'addressLines', type: 'textarea', admin: { description: 'One line per row.' } },
            {
              name: 'hours',
              type: 'text',
              defaultValue: 'Monday to Friday, 8:00 am to 5:00 pm Eastern',
            },
            {
              name: 'responseTime',
              type: 'text',
              defaultValue: 'We respond to requests within 1 business day.',
            },
          ],
        },
        {
          label: 'Business identifiers',
          description:
            'Shown on the About page and in the site footer only when marked as verified. Enter only information the client has confirmed.',
          fields: [
            {
              name: 'identifiers',
              type: 'array',
              labels: { singular: 'Identifier', plural: 'Identifiers' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'label',
                      type: 'text',
                      required: true,
                      admin: { description: 'For example UEI, CAGE code, NAICS.' },
                    },
                    { name: 'value', type: 'text', required: true },
                    {
                      name: 'verified',
                      type: 'checkbox',
                      defaultValue: false,
                      admin: {
                        description: 'Confirmed by the client. Unverified items are hidden.',
                      },
                    },
                  ],
                },
              ],
            },
            {
              name: 'certifications',
              type: 'array',
              labels: { singular: 'Certification', plural: 'Certifications and designations' },
              fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'description', type: 'textarea' },
                { name: 'verified', type: 'checkbox', defaultValue: false },
              ],
            },
            { name: 'capabilityStatement', type: 'relationship', relationTo: 'documents' },
          ],
        },
        {
          label: 'RFQ',
          fields: [
            {
              name: 'rfqRecipients',
              type: 'array',
              labels: { singular: 'Recipient', plural: 'Sales inbox recipients' },
              admin: { description: 'When empty, the RFQ_NOTIFY_TO environment variable is used.' },
              fields: [{ name: 'email', type: 'email', required: true }],
            },
            {
              name: 'retentionDays',
              type: 'number',
              required: true,
              defaultValue: 730,
              min: 30,
              admin: {
                description:
                  'RFQs and their attachments are deleted this many days after submission.',
              },
            },
          ],
        },
      ],
    },
  ],
}
