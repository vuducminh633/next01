
--> statement-breakpoint
CREATE TABLE "drill_core_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"sample_code" text,
	"hole_id" text,
	"depth_from" double precision,
	"depth_to" double precision,
	"rock_type" text,
	"compressive_strength" double precision,
	"tensile_strength" double precision,
	"friction_angle_deg" integer,
	"friction_angle_min" integer,
	"cohesion" double precision,
	"density" double precision,
	"specific_gravity" double precision,
	"coefficient" double precision,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
