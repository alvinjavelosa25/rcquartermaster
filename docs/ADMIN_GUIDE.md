# Admin user guide

For staff who manage the catalogue and handle requests for quote. The admin is at `/admin` on the website. Sign in with the email and password an Admin created for you. Five wrong passwords lock the account for 15 minutes; an Admin can unlock it.

## Roles

| Role | Can do |
|---|---|
| **Admin** | Everything: users and roles, site settings, catalogue, RFQs, deleting records |
| **Catalogue Manager** | Create, edit, publish and unpublish products, categories, attributes, documents, images, pages; import and export products. Cannot see RFQs |
| **Sales / RFQ Viewer** | View RFQs, change status, add internal notes, download clean attachments, export RFQs to CSV. Cannot change catalogue content or the buyer's details |

Only **Published** content appears on the website, in search, in the sitemap and in downloadable files. Drafts are never public.

## Catalogue

### Categories
1. Open **Catalogue > Categories**, click **Create new**.
2. Enter a name (the URL slug is generated). Choose a **Parent** to make a subcategory (up to 4 levels). Add an image and a short description if you want them on the Categories page.
3. Click **Publish**. A category with unpublished or missing parents still gets a path, but buyers only reach it if it is published.

Renaming or moving a category updates the URLs of everything beneath it automatically. You cannot delete a category that still has subcategories or products.

### Attributes (filters such as Size or Material)
Open **Catalogue > Attributes**. Give each a label and a machine key (lowercase, for example `glove_size`). Types: text, number, yes/no, list of options. Tick **Filterable** to show it as a filter on category and search pages. Do not change a key after products use it: CSV files and URLs refer to it.

### Products
1. **Catalogue > Products > Create new.**
2. Required to publish: **SKU** (unique; spaces and case are normalised), **name**, **summary** (max 300 characters), **category**, at least one **image** (every image needs alt text).
3. Add **specifications** (approved rows shown in a table), **attribute values**, **documents**, manufacturer details and unit of measure. Use **availability**: *On request* shows a label; *Discontinued* hides "Add to RFQ" and offers an alternative request instead.
4. **Save draft** keeps it private. Use **Preview** to see it exactly as buyers will, including unpublished changes. **Publish** makes it public within a minute. **Unpublish** removes it from pages, search and the sitemap within a minute.
5. Edit a published product: changes stay in a draft version until you click **Publish changes**. The live page is unchanged until then.

Version history is under the **Versions** tab. You can restore an earlier version.

### Documents (spec sheets, certificates, SDS)
Upload a PDF in **Catalogue > Documents**, set the title, type and optional effective/expiry dates, then change **Status** to Published. Attach documents to products on the product screen. A Draft document is not downloadable by anyone but staff, even if someone knows the link. Tick **Accessible alternative** only when a tagged PDF or alternative format exists. Prefer tagged (accessible) PDFs.

### Images
Upload to **Catalogue > Images** or directly from a product. PNG, JPEG, WebP and AVIF only. Write alt text that describes what the picture shows.

## Bulk import and export (products)

Open **Catalogue > Products**; the **CSV import and export** panel sits above the list.

- **Export** downloads every product (all statuses) in the import format. Open it in Excel, edit, import again.
- **Download import template** gives the header row and an example.
- **Import**: choose the CSV, keep **Dry run** ticked first. The report lists rows to create/update and every error with its row number. Fix the file, run the dry run again, then untick Dry run to import.

Rules:
- Matching is by **SKU**: existing SKUs are updated, new ones created. Rows are independent: a bad row does not stop good rows.
- Imported products are **drafts** unless you tick **Publish imported products** *and* the row says `published`. Publishing still requires a summary, category and image.
- Columns: `sku, name, status, summary, description, category_path, additional_category_paths, manufacturer, manufacturer_part_number, unit_of_measure, availability, country_of_origin, specifications, image_filenames, document_titles` plus one `attr.<key>` column per attribute (for example `attr.size`).
- `category_path` is the category's path, for example `personal-protective-equipment/gloves` (see the Path field on the category).
- `specifications` is `Label: value | Another label: value`. Lists use ` | ` between items.
- Images and documents must already be uploaded; refer to images by file name and documents by exact title.
- No category or attribute is created automatically. Unknown ones are errors.
- Up to 2,000 rows in the admin panel. For larger files a developer runs `npm run import:csv -- file.csv dry-run`.

## Requests for quote

Open **Requests for quote > RFQs**. New requests also arrive by email at the sales inbox.

- **Find**: search by reference (`RCQ-202611-ABC234`), name, organisation, email or SKU. Filter by status or date with the list filters.
- **Open a request** to see what the buyer sent. Buyer fields are read-only. Attachments are listed with their virus-scan status.
- **Status**: New, In progress, Quoted, Closed. Every change is recorded (who and when) in the status history.
- **Notes**: add internal notes. Buyers never see them.
- **Assign**: choose who is handling the request.
- **Attachments**: open the attachment and click **Download file**. The link is valid for a few minutes. Only files that passed the scan (or were skipped when no scanner is configured, if allowed) can be downloaded.
- **Export**: the panel above the list downloads a CSV of requests filtered by status, dates and text.
- Email delivery: the System details section shows whether the sales and buyer emails were sent. Failed emails are retried automatically every 10 minutes, up to 5 times. If you see `failed`, check the sender domain with your administrator.
- Never forward attachments through unprotected channels. Requests are deleted automatically after the retention period.

## Site settings (Admin only)

**Administration > Site settings**:
- *Company* and *Contact*: names, phone, email, address lines, hours, response-time sentence shown to buyers.
- *Business identifiers*: UEI, CAGE, NAICS and certifications. **Only entries marked Verified are shown on the website.** Do not mark anything verified until the client has confirmed it.
- *RFQ*: sales inbox recipients (empty means use the environment default) and **retention days** (RFQs and attachments are deleted that many days after submission; minimum 30).

## Pages

**Content > Pages** holds About, Services, Privacy policy and Accessibility statement. Edit the text and publish. Do not change slugs (`about`, `services`, `privacy`, `accessibility`). Use real headings in order (the page title is already the main heading, so start with Heading 2).

## Users (Admin only)

**Administration > Users**: create users, pick a role, unlock locked accounts. Passwords need 12+ characters. Remove access promptly when someone leaves.

## Good practice for accessibility

- Every image: meaningful alt text.
- Link text should make sense on its own ("Download the safety data sheet", not "click here").
- Keep headings in order and use lists for lists.
- Prefer tagged PDFs; mention an accessible alternative is available on request.

## Troubleshooting

| Problem | What to check |
|---|---|
| Product published but not visible | Wait one minute; confirm category and image are set; check it is not unpublished in the Versions tab |
| Product missing from search | Search only shows published products. A developer can run `npm run reindex` |
| Import says "unknown category" | Use the category **Path** value exactly, lowercase with slashes |
| Cannot publish | The error names the missing field (summary, category or image) |
| RFQ email missing | Look at the RFQ's System details > Notifications; check spam; ask a developer about Resend |
| Locked out | An Admin can unlock the account from Users; otherwise wait 15 minutes |
