drop index if exists "public"."chunks_embedding_idx";

CREATE INDEX chunks_embedding_idx ON public.chunks USING hnsw (embedding vector_cosine_ops);

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
  order by embedding <=> query_embedding asc
  limit match_count;
$function$
;


