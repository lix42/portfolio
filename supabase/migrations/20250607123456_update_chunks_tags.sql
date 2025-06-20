alter table "public"."chunks" add column "tags" text[];
alter table "public"."chunks" add column "tags_embedding" vector(1536);
create index if not exists "chunks_tags_gin_idx" on "public"."chunks" using gin (tags);
create index "chunks_tags_embedding_idx" on "public"."chunks" using hnsw (tags_embedding vector_cosine_ops);
