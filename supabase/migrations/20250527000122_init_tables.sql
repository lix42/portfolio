create extension if not exists "vector" with schema "public" version '0.8.0';

create table "public"."chunks" (
    "id" uuid not null default gen_random_uuid(),
    "content" text not null,
    "embedding" vector(1536) not null,
    "document_id" uuid not null,
    "type" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


create table "public"."companies" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "start_time" date not null,
    "end_time" date,
    "title" text not null,
    "description" text not null
);


create table "public"."documents" (
    "id" uuid not null default gen_random_uuid(),
    "content" text not null,
    "content_hash" text not null,
    "company_id" uuid not null,
    "tags" text[],
    "project" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


CREATE INDEX chunks_content_gin_idx ON public.chunks USING gin (to_tsvector('english'::regconfig, content));

CREATE INDEX chunks_embedding_idx ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');

CREATE UNIQUE INDEX chunks_pkey ON public.chunks USING btree (id);

CREATE UNIQUE INDEX companies_name_key ON public.companies USING btree (name);

CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id);

CREATE UNIQUE INDEX documents_content_hash_key ON public.documents USING btree (content_hash);

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

CREATE INDEX documents_tags_gin_idx ON public.documents USING gin (tags);

alter table "public"."chunks" add constraint "chunks_pkey" PRIMARY KEY using index "chunks_pkey";

alter table "public"."companies" add constraint "companies_pkey" PRIMARY KEY using index "companies_pkey";

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

alter table "public"."chunks" add constraint "chunks_document_id_fkey" FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE not valid;

alter table "public"."chunks" validate constraint "chunks_document_id_fkey";

alter table "public"."companies" add constraint "companies_name_key" UNIQUE using index "companies_name_key";

alter table "public"."documents" add constraint "documents_company_id_fkey" FOREIGN KEY (company_id) REFERENCES companies(id) not valid;

alter table "public"."documents" validate constraint "documents_company_id_fkey";

alter table "public"."documents" add constraint "documents_content_hash_key" UNIQUE using index "documents_content_hash_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where embedding <=> query_embedding < 1 - match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$function$
;

grant delete on table "public"."chunks" to "anon";

grant insert on table "public"."chunks" to "anon";

grant references on table "public"."chunks" to "anon";

grant select on table "public"."chunks" to "anon";

grant trigger on table "public"."chunks" to "anon";

grant truncate on table "public"."chunks" to "anon";

grant update on table "public"."chunks" to "anon";

grant delete on table "public"."chunks" to "authenticated";

grant insert on table "public"."chunks" to "authenticated";

grant references on table "public"."chunks" to "authenticated";

grant select on table "public"."chunks" to "authenticated";

grant trigger on table "public"."chunks" to "authenticated";

grant truncate on table "public"."chunks" to "authenticated";

grant update on table "public"."chunks" to "authenticated";

grant delete on table "public"."chunks" to "service_role";

grant insert on table "public"."chunks" to "service_role";

grant references on table "public"."chunks" to "service_role";

grant select on table "public"."chunks" to "service_role";

grant trigger on table "public"."chunks" to "service_role";

grant truncate on table "public"."chunks" to "service_role";

grant update on table "public"."chunks" to "service_role";

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant references on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant trigger on table "public"."companies" to "anon";

grant truncate on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."companies" to "authenticated";

grant insert on table "public"."companies" to "authenticated";

grant references on table "public"."companies" to "authenticated";

grant select on table "public"."companies" to "authenticated";

grant trigger on table "public"."companies" to "authenticated";

grant truncate on table "public"."companies" to "authenticated";

grant update on table "public"."companies" to "authenticated";

grant delete on table "public"."companies" to "service_role";

grant insert on table "public"."companies" to "service_role";

grant references on table "public"."companies" to "service_role";

grant select on table "public"."companies" to "service_role";

grant trigger on table "public"."companies" to "service_role";

grant truncate on table "public"."companies" to "service_role";

grant update on table "public"."companies" to "service_role";

grant delete on table "public"."documents" to "anon";

grant insert on table "public"."documents" to "anon";

grant references on table "public"."documents" to "anon";

grant select on table "public"."documents" to "anon";

grant trigger on table "public"."documents" to "anon";

grant truncate on table "public"."documents" to "anon";

grant update on table "public"."documents" to "anon";

grant delete on table "public"."documents" to "authenticated";

grant insert on table "public"."documents" to "authenticated";

grant references on table "public"."documents" to "authenticated";

grant select on table "public"."documents" to "authenticated";

grant trigger on table "public"."documents" to "authenticated";

grant truncate on table "public"."documents" to "authenticated";

grant update on table "public"."documents" to "authenticated";

grant delete on table "public"."documents" to "service_role";

grant insert on table "public"."documents" to "service_role";

grant references on table "public"."documents" to "service_role";

grant select on table "public"."documents" to "service_role";

grant trigger on table "public"."documents" to "service_role";

grant truncate on table "public"."documents" to "service_role";

grant update on table "public"."documents" to "service_role";


