CREATE TYPE "public"."event_categorie" AS ENUM('Muziek', 'Tech', 'Business', 'Food & Drink', 'Health', 'Art & Design', 'Sports');--> statement-breakpoint
CREATE TABLE "event_agenda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"tijd" text NOT NULL,
	"titel" text NOT NULL,
	"subtitel" text,
	"beschrijving" text,
	"volgorde" numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"vraag" text NOT NULL,
	"antwoord" text,
	"volgorde" numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_sprekers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"naam" text NOT NULL,
	"rol" text,
	"avatar_url" text,
	"volgorde" numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "categorie" "event_categorie";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "beschrijving" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_afbeelding_url" text;--> statement-breakpoint
ALTER TABLE "event_agenda" ADD CONSTRAINT "event_agenda_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_agenda" ADD CONSTRAINT "event_agenda_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_faq" ADD CONSTRAINT "event_faq_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_faq" ADD CONSTRAINT "event_faq_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sprekers" ADD CONSTRAINT "event_sprekers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sprekers" ADD CONSTRAINT "event_sprekers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_agenda_organization_id_idx" ON "event_agenda" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_agenda_event_id_idx" ON "event_agenda" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_faq_organization_id_idx" ON "event_faq" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_faq_event_id_idx" ON "event_faq" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_sprekers_organization_id_idx" ON "event_sprekers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_sprekers_event_id_idx" ON "event_sprekers" USING btree ("event_id");