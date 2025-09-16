set check_function_bodies = off;

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
    where tags && input_tags
  )
  select
    id,
    content,
    tags,
    matched_tags,
    document_id
  from tag_matches
  order by cardinality(matched_tags) desc
  limit top_k;
$function$
;


