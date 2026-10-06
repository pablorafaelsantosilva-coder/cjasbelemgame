-- Replies in the general room retain only a reference. Hidden text is never copied.
ALTER TABLE public.chat_messages ADD COLUMN reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL;
CREATE INDEX chat_messages_reply_idx ON public.chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE FUNCTION public.validate_chat_reply() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chat_messages WHERE id = NEW.reply_to_id AND NOT hidden
  ) THEN RAISE EXCEPTION 'A mensagem original não está mais disponível'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_chat_reply() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_chat_reply BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_chat_reply();

-- Direct messages are immutable and visible only to their sender and recipient.
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.direct_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.direct_messages TO authenticated;
GRANT INSERT (id, sender_id, recipient_id, body, reply_to_id) ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
CREATE POLICY direct_messages_read ON public.direct_messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY direct_messages_send ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);
CREATE INDEX direct_messages_pair_idx ON public.direct_messages(sender_id, recipient_id, created_at DESC, id DESC);
CREATE INDEX direct_messages_recipient_idx ON public.direct_messages(recipient_id, created_at DESC, id DESC);

CREATE FUNCTION public.validate_direct_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.sender_id IS DISTINCT FROM auth.uid() OR NEW.sender_id = NEW.recipient_id THEN
    RAISE EXCEPTION 'Mensagem não autorizada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.sender_id AND status = 'active')
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.recipient_id AND status = 'active') THEN
    RAISE EXCEPTION 'Participante indisponível para conversar';
  END IF;
  NEW.body := btrim(NEW.body);
  IF length(NEW.body) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Escreva de 1 a 2000 caracteres'; END IF;
  IF NEW.reply_to_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.direct_messages m WHERE m.id = NEW.reply_to_id
    AND ((m.sender_id = NEW.sender_id AND m.recipient_id = NEW.recipient_id)
      OR (m.sender_id = NEW.recipient_id AND m.recipient_id = NEW.sender_id))
  ) THEN RAISE EXCEPTION 'A resposta deve pertencer à mesma conversa'; END IF;
  -- Serialize sends from the same account to make the rate limit effective.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.sender_id::text, 173));
  IF EXISTS (SELECT 1 FROM public.direct_messages WHERE sender_id = NEW.sender_id AND created_at > clock_timestamp() - interval '1 second') THEN
    RAISE EXCEPTION 'Aguarde um instante antes de enviar outra mensagem';
  END IF;
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_direct_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_direct_message BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.validate_direct_message();

-- Directory returns only public display information, never email or auth records.
CREATE FUNCTION public.get_chat_people(_search text DEFAULT '', _limit integer DEFAULT 40)
RETURNS TABLE(id uuid, name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, left(p.name, 80), p.avatar_url FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid() AND p.status = 'active'
    AND EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.status = 'active')
    AND strpos(lower(p.name), lower(left(btrim(COALESCE(_search, '')), 80))) > 0
  ORDER BY p.name, p.id LIMIT LEAST(GREATEST(COALESCE(_limit, 40), 1), 100);
$$;
REVOKE ALL ON FUNCTION public.get_chat_people(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_people(text, integer) TO authenticated;

CREATE FUNCTION public.get_direct_inbox()
RETURNS TABLE(peer_id uuid, peer_name text, peer_avatar_url text, peer_active boolean,
  last_body text, last_at timestamptz, last_sender_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT m.*, CASE WHEN m.sender_id = auth.uid() THEN m.recipient_id ELSE m.sender_id END AS peer
    FROM public.direct_messages m WHERE auth.uid() IS NOT NULL AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
  ), latest AS (
    SELECT DISTINCT ON (peer) * FROM mine ORDER BY peer, created_at DESC, id DESC
  )
  SELECT l.peer, left(p.name, 80), p.avatar_url, p.status = 'active', left(l.body, 120), l.created_at, l.sender_id
  FROM latest l JOIN public.profiles p ON p.id = l.peer ORDER BY l.created_at DESC, l.id DESC;
$$;
REVOKE ALL ON FUNCTION public.get_direct_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_direct_inbox() TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END $$;
