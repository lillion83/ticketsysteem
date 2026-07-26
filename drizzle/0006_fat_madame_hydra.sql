ALTER TABLE "tickets" ADD COLUMN "koper_user_id" uuid;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_koper_user_id_user_id_fk" FOREIGN KEY ("koper_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tickets_koper_user_id_idx" ON "tickets" USING btree ("koper_user_id");