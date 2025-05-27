create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  content_hash text unique not null,
  company_id uuid not null references companies(id),
  tags text[],
  project text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Create a GIN index on tags for efficient array search
create index if not exists documents_tags_gin_idx on documents using gin(tags);
