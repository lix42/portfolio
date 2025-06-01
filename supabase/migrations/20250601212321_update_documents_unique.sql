alter table "public"."documents" alter column "project" set not null;

CREATE UNIQUE INDEX documents_project_key ON public.documents USING btree (project);

alter table "public"."documents" add constraint "documents_project_key" UNIQUE using index "documents_project_key";


