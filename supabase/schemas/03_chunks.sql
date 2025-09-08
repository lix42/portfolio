create extension if not exists vector;

create table chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536) not null,
  tags text[],
  tags_embedding vector(1536),
  document_id uuid not null references documents(id) on delete cascade,
  type text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Add a GIN index for full-text search on content
create index if not exists chunks_content_gin_idx on chunks using gin(to_tsvector('english', content));

create index on chunks using hnsw (embedding vector_cosine_ops);

create index if not exists chunks_tags_gin_idx on chunks using gin(tags);
create index on chunks using hnsw (tags_embedding vector_cosine_ops);

create or replace function match_chunks_by_embedding (
  query_embedding vector,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  similarity float
)
language sql stable as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where embedding <=> query_embedding < 1 - match_threshold
  order by embedding <=> query_embedding asc
  limit match_count;
$$;

create or replace function match_chunks_by_tags (
  input_tags text [],
  top_k int
)
returns table (
  id uuid,
  content text,
  tags text [],
  matched_tags text []
)
language sql stable as $$
  with tag_matches as (
    select
      id,
      content,
      tags,
      array(
        select unnest(tags)
        intersect
        select unnest(input_tags)
      ) as matched_tags
    from chunks
  )
  select
    id,
    content,
    tags,
    matched_tags
  from tag_matches
  where cardinality(matched_tags) > 0
  order by cardinality(matched_tags) desc
  limit top_k;
$$;