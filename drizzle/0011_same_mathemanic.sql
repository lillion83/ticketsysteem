ALTER TABLE "events" ALTER COLUMN "categorie" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."event_categorie";--> statement-breakpoint
CREATE TYPE "public"."event_categorie" AS ENUM('Muziek & Concerten', 'Nightlife', 'Cultuur & Festival', 'Food & Drinks', 'Business & Netwerk', 'Sport & Outdoor', 'Workshops', 'Familie & Kids');--> statement-breakpoint
UPDATE "events" SET "categorie" = CASE "categorie"
  WHEN 'Muziek' THEN 'Muziek & Concerten'
  WHEN 'Tech' THEN 'Business & Netwerk'
  WHEN 'Business' THEN 'Business & Netwerk'
  WHEN 'Food & Drink' THEN 'Food & Drinks'
  WHEN 'Health' THEN 'Sport & Outdoor'
  WHEN 'Art & Design' THEN 'Cultuur & Festival'
  WHEN 'Sports' THEN 'Sport & Outdoor'
  ELSE NULL
END WHERE "categorie" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "categorie" SET DATA TYPE "public"."event_categorie" USING "categorie"::"public"."event_categorie";
