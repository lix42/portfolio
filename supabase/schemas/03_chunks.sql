create extension if not exists vector;

create table chunks (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536) not null,
  document_id uuid not null references documents(id) on delete cascade,
  type text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Add a GIN index for full-text search on content
create index if not exists chunks_content_gin_idx on chunks using gin(to_tsvector('english', content));

create index on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_chunks (
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
  order by embedding <=> query_embedding
  limit match_count;
$$;
