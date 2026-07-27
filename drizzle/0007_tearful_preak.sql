CREATE TYPE "public"."gebruiker_rol" AS ENUM('admin', 'organisator', 'koper');--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "rol" "gebruiker_rol" DEFAULT 'koper' NOT NULL;