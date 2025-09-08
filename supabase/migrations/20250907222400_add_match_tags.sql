drop function if exists "public"."match_chunks"(query_embedding vector, match_threshold double precision, match_count integer);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.match_chunks_by_embedding(query_embedding vector, match_threshold double precision, match_count integer)
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
  order by embedding <=> query_embedding asc
  limit match_count;
$function$
;

CREATE OR REPLACE FUNCTION public.match_chunks_by_tags(input_tags text[], top_k integer)
 RETURNS TABLE(id uuid, content text, tags text[], matched_tags text[])
 LANGUAGE plpgsql
AS $function$
begin
  return query
  select i.id,
    i.content,
    i.tags,
    array(
      select unnest(i.tags)
      intersect
      select unnest(input_tags)
    ) as matched_tags,
    cardinality(
      array(
        select unnest(i.tags)
        intersect
        select unnest(input_tags)
      )
    ) as match_count
  from chunks i
  where cardinality(
      array(
        select unnest(i.tags)
        intersect
        select unnest(input_tags)
      )
    ) > 0
  order by match_count desc
  limit top_k;
end;
$function$
;


