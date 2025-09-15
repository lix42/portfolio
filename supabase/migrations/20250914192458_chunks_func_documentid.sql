drop function if exists "public"."match_chunks_by_embedding"(query_embedding vector, match_threshold double precision, match_count integer);

drop function if exists "public"."match_chunks_by_tags"(input_tags text[], top_k integer);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_chunks_by_embedding(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, content text, similarity double precision, document_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity,
    document_id
  from chunks
  where embedding <=> query_embedding < 1 - match_threshold
  order by embedding <=> query_embedding asc
  limit match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.match_chunks_by_tags(input_tags text[], top_k integer)
 RETURNS TABLE(id uuid, content text, tags text[], matched_tags text[], document_id uuid)
 LANGUAGE sql
 STABLE
AS $function$
  with tag_matches as (
    select
      id,
      content,
      tags,
      array(
        select unnest(tags)
        intersect
        select unnest(input_tags)
      ) as matched_tags,
      document_id
    from chunks
  )
  select
    id,
    content,
    tags,
    matched_tags,
    document_id
  from tag_matches
  where cardinality(matched_tags) > 0
  order by cardinality(matched_tags) desc
  limit top_k;
$function$
;


