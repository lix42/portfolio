create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time date not null,
  end_time date,
  title text not null,
  description text not null,
  unique (name, start_time)
);
