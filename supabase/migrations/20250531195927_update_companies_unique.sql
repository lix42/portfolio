alter table "public"."companies" drop constraint "companies_name_key";

drop index if exists "public"."companies_name_key";

alter table "public"."companies" add constraint "companies_name_start_time_key" UNIQUE (name, start_time);