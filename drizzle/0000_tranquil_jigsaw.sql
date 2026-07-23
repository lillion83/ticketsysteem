CREATE TYPE "public"."scan_resultaat" AS ENUM('groen', 'rood_al_gebruikt', 'rood_ongeldig', 'rood_ingetrokken', 'rood_verkeerd_event', 'groen_re_entry');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"naam" text NOT NULL,
	"datum_start" timestamp with time zone NOT NULL,
	"datum_eind" timestamp with time zone NOT NULL,
	"locatie" text,
	"re_entry_toegestaan" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'concept' NOT NULL,
	"aangemaakt_op" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"naam" text NOT NULL,
	"contactpersoon" text,
	"telefoon" text,
	"aangemaakt_op" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"vervalt_op" timestamp with time zone,
	"ingetrokken_op" timestamp with time zone,
	"laatste_sync" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"scanner_sessie_id" uuid,
	"tijdstip_client" timestamp with time zone,
	"tijdstip_server" timestamp with time zone DEFAULT now() NOT NULL,
	"resultaat" "scan_resultaat" NOT NULL,
	"client_scan_uuid" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"naam" text NOT NULL,
	"prijs_srd" numeric(12, 2) NOT NULL,
	"inkoopprijs_srd" numeric(12, 2) NOT NULL,
	"aantal_beschikbaar" numeric NOT NULL,
	"aantal_verkocht" numeric DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"koper_naam" text,
	"koper_telefoon" text,
	"koper_email" text,
	"verkocht_op" timestamp with time zone,
	"verkocht_door_user_id" uuid,
	"verkoopkanaal" text,
	"geleverd_via" text,
	"geleverd_op" timestamp with time zone,
	"gebruikt_op" timestamp with time zone,
	"gebruikt_door" uuid,
	"ingetrokken_op" timestamp with time zone,
	"ingetrokken_reden" text
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_sessions" ADD CONSTRAINT "scanner_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_sessions" ADD CONSTRAINT "scanner_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_scanner_sessie_id_scanner_sessions_id_fk" FOREIGN KEY ("scanner_sessie_id") REFERENCES "public"."scanner_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD CONSTRAINT "ticket_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_ticket_types_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_organization_id_idx" ON "events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scanner_sessions_organization_id_idx" ON "scanner_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scanner_sessions_event_id_idx" ON "scanner_sessions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scans_client_scan_uuid_idx" ON "scans" USING btree ("client_scan_uuid");--> statement-breakpoint
CREATE INDEX "scans_organization_id_idx" ON "scans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scans_ticket_id_idx" ON "scans" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "scans_event_id_idx" ON "scans" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ticket_types_organization_id_idx" ON "ticket_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ticket_types_event_id_idx" ON "ticket_types" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_code_idx" ON "tickets" USING btree ("code");--> statement-breakpoint
CREATE INDEX "tickets_organization_id_idx" ON "tickets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tickets_event_id_idx" ON "tickets" USING btree ("event_id");