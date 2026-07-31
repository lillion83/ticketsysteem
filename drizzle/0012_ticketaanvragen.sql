CREATE TYPE "public"."betaalmethode_soort" AS ENUM('whatsapp', 'bank', 'contant', 'online');--> statement-breakpoint
ALTER TYPE "public"."reservering_status" ADD VALUE 'betaald';--> statement-breakpoint
ALTER TYPE "public"."reservering_status" ADD VALUE 'geannuleerd';--> statement-breakpoint
ALTER TYPE "public"."reservering_status" ADD VALUE 'verlopen';--> statement-breakpoint
CREATE TABLE "event_betaalmethoden" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"soort" "betaalmethode_soort" NOT NULL,
	"provider" text,
	"config" text,
	"actief" boolean DEFAULT true NOT NULL,
	"volgorde" numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "verkoop_actief" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "betaalinstructies" text;--> statement-breakpoint
ALTER TABLE "reserveringen" ADD COLUMN "betaald_op" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reserveringen" ADD COLUMN "betaalmethode" text;--> statement-breakpoint
ALTER TABLE "reserveringen" ADD COLUMN "betaalreferentie" text;--> statement-breakpoint
ALTER TABLE "reserveringen" ADD COLUMN "vervalt_op" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_betaalmethoden" ADD CONSTRAINT "event_betaalmethoden_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_betaalmethoden" ADD CONSTRAINT "event_betaalmethoden_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_betaalmethoden_organization_id_idx" ON "event_betaalmethoden" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_betaalmethoden_event_id_idx" ON "event_betaalmethoden" USING btree ("event_id");