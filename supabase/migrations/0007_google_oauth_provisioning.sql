-- ============================================================
--  Chronicle AI — Google OAuth Profile Provisioning
--  Migration: 0007_google_oauth_provisioning
--
--  Idempotency: `create or replace function` is safe to re-run.
--
--  Context: migration 0001's handle_new_user() trigger already fires
--  automatically for every new row in auth.users, regardless of sign-up
--  method (email/password or OAuth) — Supabase Auth creates the same
--  auth.users row shape either way, so no NEW trigger is needed for
--  Google Sign-In to provision a profile at all. This migration only
--  IMPROVES what that existing trigger populates.
--
--  The original handle_new_user() only ever read raw_user_meta_data's
--  'display_name' key, which is set for email/password sign-up (see
--  authService.signUp() in src/lib/supabase/auth.ts, which explicitly
--  passes options.data.display_name). Google-authenticated users have NO
--  'display_name' key at all — Google's OIDC claims surface as
--  'full_name' (or 'name') and 'avatar_url' (or 'picture') instead,
--  confirmed against Supabase's own documented raw_user_meta_data shape
--  for Google sign-ins. Without this fix, every Google user would
--  correctly get a profile row (the trigger doesn't fail — display_name
--  is nullable, per migration 0001), but with display_name left null and
--  avatar_url never populated at all — a real, if non-blocking,
--  completeness gap for "automatic account provisioning."
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );
  return new;
end;
$$ language plpgsql security definer;

comment on function public.handle_new_user() is
  'Auto-provisions a profiles row for every new auth.users row, regardless of sign-up method. display_name/avatar_url are populated from whichever metadata key the sign-up method actually provides: display_name (email/password, set explicitly by authService.signUp) or full_name/name + avatar_url/picture (Google OAuth, provided automatically by Google OIDC claims). Both are nullable -- a provider that supplies neither still provisions successfully with null values, never blocking sign-up.';
