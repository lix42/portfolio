create extension if not exists vector;

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text,
  start_time int,
  end_time int,
  title text,
  description text
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  embedding vector(1536),
  chunk_hash text unique,
  start_token int,
  end_token int,
  company_id uuid references companies(id),
  tags text[],
  project text
);

create index on documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_documents (
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
  from documents
  where embedding <=> query_embedding < 1 - match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
