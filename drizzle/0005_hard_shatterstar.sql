CREATE TYPE "public"."reservering_status" AS ENUM('nieuw', 'afgehandeld', 'afgewezen');--> statement-breakpoint
CREATE TABLE "reserveringen" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"naam" text NOT NULL,
	"email" text,
	"telefoon" text,
	"aantal" numeric DEFAULT '1' NOT NULL,
	"opmerking" text,
	"status" "reservering_status" DEFAULT 'nieuw' NOT NULL,
	"aangemaakt_op" timestamp with time zone DEFAULT now() NOT NULL,
	"afgehandeld_op" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "reserveringen" ADD CONSTRAINT "reserveringen_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserveringen" ADD CONSTRAINT "reserveringen_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reserveringen" ADD CONSTRAINT "reserveringen_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reserveringen_organization_id_idx" ON "reserveringen" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reserveringen_event_id_idx" ON "reserveringen" USING btree ("event_id");