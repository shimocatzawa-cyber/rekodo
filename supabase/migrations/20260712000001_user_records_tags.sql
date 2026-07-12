alter table user_records
  add column if not exists tags text[] not null default '{}';

create index if not exists user_records_tags_gin on user_records using gin(tags);
