-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create conversations table
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create messages table
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null, -- 'user' or 'assistant'
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Policies for conversations
create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- Policies for messages
create policy "Users can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where id = public.messages.conversation_id
      and user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where id = public.messages.conversation_id
      and user_id = auth.uid()
    )
  );
