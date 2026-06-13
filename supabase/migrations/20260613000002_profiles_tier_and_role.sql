-- Add subscription_tier and role columns to profiles (were in TS types but never migrated)
alter table public.profiles
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists role text not null default 'user';
