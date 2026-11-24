import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'catalogue_manager', 'sales');
  CREATE TYPE "public"."enum_categories_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__categories_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_attribute_definitions_type" AS ENUM('text', 'number', 'boolean', 'enum');
  CREATE TYPE "public"."enum_products_availability" AS ENUM('available', 'on_request', 'discontinued');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__products_v_version_availability" AS ENUM('available', 'on_request', 'discontinued');
  CREATE TYPE "public"."enum__products_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_documents_type" AS ENUM('spec_sheet', 'certificate', 'sds', 'brochure', 'other');
  CREATE TYPE "public"."enum_documents_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_rfqs_status" AS ENUM('new', 'in_progress', 'quoted', 'closed');
  CREATE TYPE "public"."enum_rfqs_notifications_sales_email_status" AS ENUM('pending', 'sent', 'failed');
  CREATE TYPE "public"."enum_rfqs_notifications_buyer_email_status" AS ENUM('pending', 'sent', 'failed');
  CREATE TYPE "public"."enum_rfq_attachments_scan_status" AS ENUM('pending', 'clean', 'infected', 'error', 'skipped');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'sales' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"slug" varchar,
  	"parent_id" integer,
  	"path" varchar,
  	"depth" numeric,
  	"sort_order" numeric DEFAULT 0,
  	"description" varchar,
  	"image_id" integer,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_categories_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_parent_id" integer,
  	"version_path" varchar,
  	"version_depth" numeric,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_description" varchar,
  	"version_image_id" integer,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__categories_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "attribute_definitions_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "attribute_definitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"key" varchar NOT NULL,
  	"type" "enum_attribute_definitions_type" DEFAULT 'text' NOT NULL,
  	"unit" varchar,
  	"filterable" boolean DEFAULT false,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_specifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"unit" varchar
  );
  
  CREATE TABLE "products_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"attribute_id" integer,
  	"value" varchar
  );
  
  CREATE TABLE "products_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"name" varchar,
  	"slug" varchar,
  	"summary" varchar,
  	"description" jsonb,
  	"category_id" integer,
  	"manufacturer" varchar,
  	"manufacturer_part_number" varchar,
  	"unit_of_measure" varchar,
  	"availability" "enum_products_availability" DEFAULT 'available',
  	"country_of_origin" varchar,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"approved_by_id" integer,
  	"approved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_products_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"documents_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "_products_v_version_specifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"unit" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"attribute_id" integer,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_version_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_sku" varchar,
  	"version_name" varchar,
  	"version_slug" varchar,
  	"version_summary" varchar,
  	"version_description" jsonb,
  	"version_category_id" integer,
  	"version_manufacturer" varchar,
  	"version_manufacturer_part_number" varchar,
  	"version_unit_of_measure" varchar,
  	"version_availability" "enum__products_v_version_availability" DEFAULT 'available',
  	"version_country_of_origin" varchar,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_approved_by_id" integer,
  	"version_approved_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__products_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "_products_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"documents_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  CREATE TABLE "documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"type" "enum_documents_type" DEFAULT 'spec_sheet' NOT NULL,
  	"status" "enum_documents_status" DEFAULT 'draft' NOT NULL,
  	"version_label" varchar,
  	"effective_date" timestamp(3) with time zone,
  	"expiry_date" timestamp(3) with time zone,
  	"accessible_alternative" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "rfqs_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"sku" varchar,
  	"name" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"unit_of_measure" varchar,
  	"product_id" integer
  );
  
  CREATE TABLE "rfqs_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" varchar NOT NULL,
  	"author_id" integer,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "rfqs_status_history" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"from" varchar,
  	"to" varchar,
  	"by_id" integer,
  	"at" timestamp(3) with time zone
  );
  
  CREATE TABLE "rfqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"reference" varchar NOT NULL,
  	"status" "enum_rfqs_status" DEFAULT 'new' NOT NULL,
  	"assigned_to_id" integer,
  	"buyer_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"organisation" varchar NOT NULL,
  	"facility" varchar,
  	"buyer_role" varchar,
  	"needed_by" timestamp(3) with time zone,
  	"solicitation_number" varchar,
  	"delivery_details" varchar,
  	"special_instructions" varchar,
  	"general_description" varchar,
  	"item_skus" varchar,
  	"privacy_acknowledged_at" timestamp(3) with time zone,
  	"retention_expires_at" timestamp(3) with time zone,
  	"idempotency_key" varchar,
  	"notifications_sales_email_status" "enum_rfqs_notifications_sales_email_status" DEFAULT 'pending',
  	"notifications_buyer_email_status" "enum_rfqs_notifications_buyer_email_status" DEFAULT 'pending',
  	"notifications_attempts" numeric DEFAULT 0,
  	"notifications_last_attempt_at" timestamp(3) with time zone,
  	"notifications_last_error" varchar,
  	"client_meta_ip_hash" varchar,
  	"client_meta_user_agent" varchar,
  	"client_meta_turnstile_verified" boolean,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "rfq_attachments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"rfq_id" integer NOT NULL,
  	"original_name" varchar NOT NULL,
  	"storage_key" varchar NOT NULL,
  	"declared_mime" varchar,
  	"detected_kind" varchar,
  	"size_bytes" numeric,
  	"sha256" varchar,
  	"scan_status" "enum_rfq_attachments_scan_status" DEFAULT 'pending' NOT NULL,
  	"scanned_at" timestamp(3) with time zone,
  	"scan_detail" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"intro" varchar,
  	"content" jsonb,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_intro" varchar,
  	"version_content" jsonb,
  	"version_seo_title" varchar,
  	"version_seo_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "search_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"summary" varchar,
  	"body" varchar,
  	"manufacturer" varchar,
  	"availability" varchar,
  	"category_ids" jsonb,
  	"category_path" varchar,
  	"category_name" varchar,
  	"attributes" jsonb,
  	"image" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"tsv" "tsvector" GENERATED ALWAYS AS ((
            setweight(to_tsvector('english', coalesce(sku, '') || ' ' || coalesce(name, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(manufacturer, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(body, '')), 'C')
          )) STORED
  );
  
  CREATE TABLE "rate_limits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"bucket" varchar NOT NULL,
  	"count" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"categories_id" integer,
  	"attribute_definitions_id" integer,
  	"products_id" integer,
  	"media_id" integer,
  	"documents_id" integer,
  	"rfqs_id" integer,
  	"rfq_attachments_id" integer,
  	"pages_id" integer,
  	"search_documents_id" integer,
  	"rate_limits_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_identifiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL,
  	"verified" boolean DEFAULT false
  );
  
  CREATE TABLE "site_settings_certifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"description" varchar,
  	"verified" boolean DEFAULT false
  );
  
  CREATE TABLE "site_settings_rfq_recipients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"company_name" varchar DEFAULT 'RC Quartermaster LLC' NOT NULL,
  	"legal_name" varchar,
  	"tagline" varchar DEFAULT 'Facility supplies, equipment and services for government and healthcare buyers.',
  	"home_headline" varchar DEFAULT 'Find approved supplies. Request a quote.',
  	"home_subheadline" varchar DEFAULT 'Browse approved products for VA medical centres, federal facilities and healthcare systems, review specifications and submit one request for quote.',
  	"phone" varchar,
  	"email" varchar,
  	"address_lines" varchar,
  	"hours" varchar DEFAULT 'Monday to Friday, 8:00 am to 5:00 pm Eastern',
  	"response_time" varchar DEFAULT 'We respond to requests within 1 business day.',
  	"capability_statement_id" integer,
  	"retention_days" numeric DEFAULT 730 NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_parent_id_categories_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_image_id_media_id_fk" FOREIGN KEY ("version_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attribute_definitions_options" ADD CONSTRAINT "attribute_definitions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_specifications" ADD CONSTRAINT "products_specifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_attributes" ADD CONSTRAINT "products_attributes_attribute_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_attributes" ADD CONSTRAINT "products_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_specifications" ADD CONSTRAINT "_products_v_version_specifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_attributes" ADD CONSTRAINT "_products_v_version_attributes_attribute_id_attribute_definitions_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_version_attributes" ADD CONSTRAINT "_products_v_version_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_images" ADD CONSTRAINT "_products_v_version_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_version_images" ADD CONSTRAINT "_products_v_version_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_parent_id_products_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_approved_by_id_users_id_fk" FOREIGN KEY ("version_approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rfqs_items" ADD CONSTRAINT "rfqs_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rfqs_items" ADD CONSTRAINT "rfqs_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rfqs_notes" ADD CONSTRAINT "rfqs_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rfqs_notes" ADD CONSTRAINT "rfqs_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rfqs_status_history" ADD CONSTRAINT "rfqs_status_history_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rfqs_status_history" ADD CONSTRAINT "rfqs_status_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "rfq_attachments" ADD CONSTRAINT "rfq_attachments_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_documents" ADD CONSTRAINT "search_documents_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attribute_definitions_fk" FOREIGN KEY ("attribute_definitions_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documents_fk" FOREIGN KEY ("documents_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rfqs_fk" FOREIGN KEY ("rfqs_id") REFERENCES "public"."rfqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rfq_attachments_fk" FOREIGN KEY ("rfq_attachments_id") REFERENCES "public"."rfq_attachments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_documents_fk" FOREIGN KEY ("search_documents_id") REFERENCES "public"."search_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rate_limits_fk" FOREIGN KEY ("rate_limits_id") REFERENCES "public"."rate_limits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_identifiers" ADD CONSTRAINT "site_settings_identifiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_certifications" ADD CONSTRAINT "site_settings_certifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rfq_recipients" ADD CONSTRAINT "site_settings_rfq_recipients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_capability_statement_id_documents_id_fk" FOREIGN KEY ("capability_statement_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE UNIQUE INDEX "categories_path_idx" ON "categories" USING btree ("path");
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories__status_idx" ON "categories" USING btree ("_status");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_parent_idx" ON "_categories_v" USING btree ("version_parent_id");
  CREATE INDEX "_categories_v_version_version_path_idx" ON "_categories_v" USING btree ("version_path");
  CREATE INDEX "_categories_v_version_version_image_idx" ON "_categories_v" USING btree ("version_image_id");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_version_version__status_idx" ON "_categories_v" USING btree ("version__status");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_latest_idx" ON "_categories_v" USING btree ("latest");
  CREATE INDEX "attribute_definitions_options_order_idx" ON "attribute_definitions_options" USING btree ("_order");
  CREATE INDEX "attribute_definitions_options_parent_id_idx" ON "attribute_definitions_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "attribute_definitions_key_idx" ON "attribute_definitions" USING btree ("key");
  CREATE INDEX "attribute_definitions_updated_at_idx" ON "attribute_definitions" USING btree ("updated_at");
  CREATE INDEX "attribute_definitions_created_at_idx" ON "attribute_definitions" USING btree ("created_at");
  CREATE INDEX "products_specifications_order_idx" ON "products_specifications" USING btree ("_order");
  CREATE INDEX "products_specifications_parent_id_idx" ON "products_specifications" USING btree ("_parent_id");
  CREATE INDEX "products_attributes_order_idx" ON "products_attributes" USING btree ("_order");
  CREATE INDEX "products_attributes_parent_id_idx" ON "products_attributes" USING btree ("_parent_id");
  CREATE INDEX "products_attributes_attribute_idx" ON "products_attributes" USING btree ("attribute_id");
  CREATE INDEX "products_images_order_idx" ON "products_images" USING btree ("_order");
  CREATE INDEX "products_images_parent_id_idx" ON "products_images" USING btree ("_parent_id");
  CREATE INDEX "products_images_image_idx" ON "products_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "products_sku_idx" ON "products" USING btree ("sku");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "products_manufacturer_part_number_idx" ON "products" USING btree ("manufacturer_part_number");
  CREATE INDEX "products_approved_by_idx" ON "products" USING btree ("approved_by_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products__status_idx" ON "products" USING btree ("_status");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_categories_id_idx" ON "products_rels" USING btree ("categories_id");
  CREATE INDEX "products_rels_documents_id_idx" ON "products_rels" USING btree ("documents_id");
  CREATE INDEX "products_rels_products_id_idx" ON "products_rels" USING btree ("products_id");
  CREATE INDEX "_products_v_version_specifications_order_idx" ON "_products_v_version_specifications" USING btree ("_order");
  CREATE INDEX "_products_v_version_specifications_parent_id_idx" ON "_products_v_version_specifications" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_attributes_order_idx" ON "_products_v_version_attributes" USING btree ("_order");
  CREATE INDEX "_products_v_version_attributes_parent_id_idx" ON "_products_v_version_attributes" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_attributes_attribute_idx" ON "_products_v_version_attributes" USING btree ("attribute_id");
  CREATE INDEX "_products_v_version_images_order_idx" ON "_products_v_version_images" USING btree ("_order");
  CREATE INDEX "_products_v_version_images_parent_id_idx" ON "_products_v_version_images" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_images_image_idx" ON "_products_v_version_images" USING btree ("image_id");
  CREATE INDEX "_products_v_parent_idx" ON "_products_v" USING btree ("parent_id");
  CREATE INDEX "_products_v_version_version_sku_idx" ON "_products_v" USING btree ("version_sku");
  CREATE INDEX "_products_v_version_version_slug_idx" ON "_products_v" USING btree ("version_slug");
  CREATE INDEX "_products_v_version_version_category_idx" ON "_products_v" USING btree ("version_category_id");
  CREATE INDEX "_products_v_version_version_manufacturer_part_number_idx" ON "_products_v" USING btree ("version_manufacturer_part_number");
  CREATE INDEX "_products_v_version_version_approved_by_idx" ON "_products_v" USING btree ("version_approved_by_id");
  CREATE INDEX "_products_v_version_version_updated_at_idx" ON "_products_v" USING btree ("version_updated_at");
  CREATE INDEX "_products_v_version_version_created_at_idx" ON "_products_v" USING btree ("version_created_at");
  CREATE INDEX "_products_v_version_version__status_idx" ON "_products_v" USING btree ("version__status");
  CREATE INDEX "_products_v_created_at_idx" ON "_products_v" USING btree ("created_at");
  CREATE INDEX "_products_v_updated_at_idx" ON "_products_v" USING btree ("updated_at");
  CREATE INDEX "_products_v_latest_idx" ON "_products_v" USING btree ("latest");
  CREATE INDEX "_products_v_rels_order_idx" ON "_products_v_rels" USING btree ("order");
  CREATE INDEX "_products_v_rels_parent_idx" ON "_products_v_rels" USING btree ("parent_id");
  CREATE INDEX "_products_v_rels_path_idx" ON "_products_v_rels" USING btree ("path");
  CREATE INDEX "_products_v_rels_categories_id_idx" ON "_products_v_rels" USING btree ("categories_id");
  CREATE INDEX "_products_v_rels_documents_id_idx" ON "_products_v_rels" USING btree ("documents_id");
  CREATE INDEX "_products_v_rels_products_id_idx" ON "_products_v_rels" USING btree ("products_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "documents_updated_at_idx" ON "documents" USING btree ("updated_at");
  CREATE INDEX "documents_created_at_idx" ON "documents" USING btree ("created_at");
  CREATE UNIQUE INDEX "documents_filename_idx" ON "documents" USING btree ("filename");
  CREATE INDEX "rfqs_items_order_idx" ON "rfqs_items" USING btree ("_order");
  CREATE INDEX "rfqs_items_parent_id_idx" ON "rfqs_items" USING btree ("_parent_id");
  CREATE INDEX "rfqs_items_product_idx" ON "rfqs_items" USING btree ("product_id");
  CREATE INDEX "rfqs_notes_order_idx" ON "rfqs_notes" USING btree ("_order");
  CREATE INDEX "rfqs_notes_parent_id_idx" ON "rfqs_notes" USING btree ("_parent_id");
  CREATE INDEX "rfqs_notes_author_idx" ON "rfqs_notes" USING btree ("author_id");
  CREATE INDEX "rfqs_status_history_order_idx" ON "rfqs_status_history" USING btree ("_order");
  CREATE INDEX "rfqs_status_history_parent_id_idx" ON "rfqs_status_history" USING btree ("_parent_id");
  CREATE INDEX "rfqs_status_history_by_idx" ON "rfqs_status_history" USING btree ("by_id");
  CREATE UNIQUE INDEX "rfqs_reference_idx" ON "rfqs" USING btree ("reference");
  CREATE INDEX "rfqs_status_idx" ON "rfqs" USING btree ("status");
  CREATE INDEX "rfqs_assigned_to_idx" ON "rfqs" USING btree ("assigned_to_id");
  CREATE INDEX "rfqs_email_idx" ON "rfqs" USING btree ("email");
  CREATE INDEX "rfqs_organisation_idx" ON "rfqs" USING btree ("organisation");
  CREATE INDEX "rfqs_retention_expires_at_idx" ON "rfqs" USING btree ("retention_expires_at");
  CREATE UNIQUE INDEX "rfqs_idempotency_key_idx" ON "rfqs" USING btree ("idempotency_key");
  CREATE INDEX "rfqs_updated_at_idx" ON "rfqs" USING btree ("updated_at");
  CREATE INDEX "rfqs_created_at_idx" ON "rfqs" USING btree ("created_at");
  CREATE INDEX "rfq_attachments_rfq_idx" ON "rfq_attachments" USING btree ("rfq_id");
  CREATE INDEX "rfq_attachments_updated_at_idx" ON "rfq_attachments" USING btree ("updated_at");
  CREATE INDEX "rfq_attachments_created_at_idx" ON "rfq_attachments" USING btree ("created_at");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE UNIQUE INDEX "search_documents_product_idx" ON "search_documents" USING btree ("product_id");
  CREATE INDEX "search_documents_sku_idx" ON "search_documents" USING btree ("sku");
  CREATE INDEX "search_documents_updated_at_idx" ON "search_documents" USING btree ("updated_at");
  CREATE INDEX "search_documents_created_at_idx" ON "search_documents" USING btree ("created_at");
  CREATE INDEX "search_documents_tsv_idx" ON "search_documents" USING gin ("tsv");
  CREATE INDEX "search_documents_category_ids_idx" ON "search_documents" USING gin ("category_ids");
  CREATE UNIQUE INDEX "rate_limits_bucket_idx" ON "rate_limits" USING btree ("bucket");
  CREATE INDEX "rate_limits_updated_at_idx" ON "rate_limits" USING btree ("updated_at");
  CREATE INDEX "rate_limits_created_at_idx" ON "rate_limits" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_attribute_definitions_id_idx" ON "payload_locked_documents_rels" USING btree ("attribute_definitions_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("documents_id");
  CREATE INDEX "payload_locked_documents_rels_rfqs_id_idx" ON "payload_locked_documents_rels" USING btree ("rfqs_id");
  CREATE INDEX "payload_locked_documents_rels_rfq_attachments_id_idx" ON "payload_locked_documents_rels" USING btree ("rfq_attachments_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_search_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("search_documents_id");
  CREATE INDEX "payload_locked_documents_rels_rate_limits_id_idx" ON "payload_locked_documents_rels" USING btree ("rate_limits_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_identifiers_order_idx" ON "site_settings_identifiers" USING btree ("_order");
  CREATE INDEX "site_settings_identifiers_parent_id_idx" ON "site_settings_identifiers" USING btree ("_parent_id");
  CREATE INDEX "site_settings_certifications_order_idx" ON "site_settings_certifications" USING btree ("_order");
  CREATE INDEX "site_settings_certifications_parent_id_idx" ON "site_settings_certifications" USING btree ("_parent_id");
  CREATE INDEX "site_settings_rfq_recipients_order_idx" ON "site_settings_rfq_recipients" USING btree ("_order");
  CREATE INDEX "site_settings_rfq_recipients_parent_id_idx" ON "site_settings_rfq_recipients" USING btree ("_parent_id");
  CREATE INDEX "site_settings_capability_statement_idx" ON "site_settings" USING btree ("capability_statement_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "attribute_definitions_options" CASCADE;
  DROP TABLE "attribute_definitions" CASCADE;
  DROP TABLE "products_specifications" CASCADE;
  DROP TABLE "products_attributes" CASCADE;
  DROP TABLE "products_images" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "_products_v_version_specifications" CASCADE;
  DROP TABLE "_products_v_version_attributes" CASCADE;
  DROP TABLE "_products_v_version_images" CASCADE;
  DROP TABLE "_products_v" CASCADE;
  DROP TABLE "_products_v_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "documents" CASCADE;
  DROP TABLE "rfqs_items" CASCADE;
  DROP TABLE "rfqs_notes" CASCADE;
  DROP TABLE "rfqs_status_history" CASCADE;
  DROP TABLE "rfqs" CASCADE;
  DROP TABLE "rfq_attachments" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "search_documents" CASCADE;
  DROP TABLE "rate_limits" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_identifiers" CASCADE;
  DROP TABLE "site_settings_certifications" CASCADE;
  DROP TABLE "site_settings_rfq_recipients" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_categories_status";
  DROP TYPE "public"."enum__categories_v_version_status";
  DROP TYPE "public"."enum_attribute_definitions_type";
  DROP TYPE "public"."enum_products_availability";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum__products_v_version_availability";
  DROP TYPE "public"."enum__products_v_version_status";
  DROP TYPE "public"."enum_documents_type";
  DROP TYPE "public"."enum_documents_status";
  DROP TYPE "public"."enum_rfqs_status";
  DROP TYPE "public"."enum_rfqs_notifications_sales_email_status";
  DROP TYPE "public"."enum_rfqs_notifications_buyer_email_status";
  DROP TYPE "public"."enum_rfq_attachments_scan_status";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_version_status";`)
}
