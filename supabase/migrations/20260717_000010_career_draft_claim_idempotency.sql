create unique index if not exists talent_profiles_user_source_draft_token_key
  on public.talent_profiles (user_id, source_draft_token)
  where source_draft_token is not null;

alter table public.conversations
  add column if not exists source_draft_token text;

alter table public.messages
  add column if not exists user_id uuid references auth.users(id) on delete set null;

update public.messages m
set user_id = c.user_id
from public.conversations c
where m.conversation_id = c.id
  and m.user_id is null;

create unique index if not exists conversations_user_source_draft_token_key
  on public.conversations (user_id, source_draft_token)
  where source_draft_token is not null;

create unique index if not exists user_context_profiles_user_source_draft_token_key
  on public.user_context_profiles (user_id, source_draft_token)
  where source_draft_token is not null;

create or replace function public.claim_anonymous_career_draft(
  p_user_id uuid,
  p_draft_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_draft public.anonymous_career_drafts%rowtype;
  v_conversation_id uuid;
  v_talent_profile_id uuid;
  v_title text;
  v_message jsonb;
  v_report jsonb;
  v_report_summary jsonb;
  v_preview jsonb;
  v_skills text[];
  v_roles text[];
begin
  if p_user_id is null then
    raise exception 'missing_user_id' using errcode = '22023';
  end if;

  if p_draft_token is null or length(trim(p_draft_token)) < 8 then
    raise exception 'invalid_draft_token' using errcode = '22023';
  end if;

  select *
    into v_draft
    from public.anonymous_career_drafts
   where draft_token = p_draft_token
   for update;

  if not found then
    raise exception 'draft_not_found' using errcode = 'P0002';
  end if;

  if v_draft.expires_at <= now() then
    raise exception 'draft_expired' using errcode = '22023';
  end if;

  if v_draft.claimed_by_user_id is not null and v_draft.claimed_by_user_id <> p_user_id then
    raise exception 'draft_already_claimed' using errcode = '23505';
  end if;

  select id
    into v_talent_profile_id
    from public.talent_profiles
   where user_id = p_user_id
     and source_draft_token = v_draft.draft_token
   limit 1;

  if v_draft.claimed_by_user_id = p_user_id and v_talent_profile_id is not null then
    return jsonb_build_object(
      'ok', true,
      'alreadyClaimed', true,
      'talentProfileId', v_talent_profile_id
    );
  end if;

  v_report := coalesce(v_draft.report_json, '{}'::jsonb);
  v_report_summary := coalesce(v_draft.report_summary_json, '{}'::jsonb);
  v_preview := coalesce(v_draft.preview_json, '{}'::jsonb);

  select coalesce(array_agg(value), '{}'::text[])
    into v_skills
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_report -> 'skills') = 'array' then v_report -> 'skills'
        else '[]'::jsonb
      end
    );

  select coalesce(array_agg(value), '{}'::text[])
    into v_roles
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_report_summary -> 'suggested_roles') = 'array' then v_report_summary -> 'suggested_roles'
        when jsonb_typeof(v_report -> 'target_roles') = 'array' then v_report -> 'target_roles'
        else '[]'::jsonb
      end
    );

  select left(coalesce(message_item ->> 'content', v_report ->> 'archetype', '职业探索'), 24)
    into v_title
    from jsonb_array_elements(
      case
        when jsonb_typeof(v_draft.conversation_json) = 'array' then v_draft.conversation_json
        else '[]'::jsonb
      end
    ) as message_item
   where message_item ->> 'role' = 'user'
     and coalesce(message_item ->> 'content', '') <> ''
   limit 1;

  v_title := coalesce(nullif(v_title, ''), left(coalesce(v_report ->> 'archetype', '职业探索'), 24));

  insert into public.conversations (user_id, title, source_draft_token)
  values (p_user_id, v_title, v_draft.draft_token)
  on conflict (user_id, source_draft_token) where source_draft_token is not null
  do update set title = excluded.title
  returning id into v_conversation_id;

  delete from public.messages
   where conversation_id = v_conversation_id;

  for v_message in
    select value
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_draft.conversation_json) = 'array' then v_draft.conversation_json
          else '[]'::jsonb
        end
      )
  loop
    if v_message ? 'role'
       and v_message ? 'content'
       and coalesce(v_message ->> 'role', '') in ('user', 'assistant', 'system')
       and coalesce(v_message ->> 'content', '') <> '' then
      insert into public.messages (conversation_id, user_id, role, content)
      values (v_conversation_id, p_user_id, v_message ->> 'role', v_message ->> 'content');
    end if;
  end loop;

  insert into public.talent_profiles (
    user_id,
    source_conversation_id,
    source_draft_token,
    archetype,
    transferable_skills,
    recommended_roles,
    keywords,
    profile_json
  )
  values (
    p_user_id,
    v_conversation_id::text,
    v_draft.draft_token,
    coalesce(nullif(v_report ->> 'archetype', ''), '职业画像'),
    v_skills,
    v_roles,
    v_skills,
    v_report || jsonb_build_object('path_map_preview', v_preview)
  )
  on conflict (user_id, source_draft_token) where source_draft_token is not null
  do update set
    source_conversation_id = excluded.source_conversation_id,
    archetype = excluded.archetype,
    transferable_skills = excluded.transferable_skills,
    recommended_roles = excluded.recommended_roles,
    keywords = excluded.keywords,
    profile_json = excluded.profile_json
  returning id into v_talent_profile_id;

  insert into public.user_context_profiles (
    user_id,
    talent_profile_id,
    source_draft_token,
    current_snapshot,
    keywords
  )
  values (
    p_user_id,
    v_talent_profile_id,
    v_draft.draft_token,
    jsonb_build_object(
      'archetype', coalesce(v_report ->> 'archetype', ''),
      'summary', coalesce(v_report ->> 'summary', ''),
      'skills', coalesce(v_report -> 'skills', '[]'::jsonb),
      'suggested_roles', to_jsonb(v_roles),
      'path_map_preview', v_preview
    ),
    v_skills
  )
  on conflict (user_id)
  do update set
    talent_profile_id = excluded.talent_profile_id,
    source_draft_token = excluded.source_draft_token,
    current_snapshot = excluded.current_snapshot,
    keywords = excluded.keywords;

  update public.anonymous_career_drafts
     set claimed_by_user_id = p_user_id,
         claimed_at = coalesce(claimed_at, now())
   where id = v_draft.id;

  return jsonb_build_object(
    'ok', true,
    'alreadyClaimed', false,
    'conversationId', v_conversation_id,
    'talentProfileId', v_talent_profile_id
  );
end;
$$;
