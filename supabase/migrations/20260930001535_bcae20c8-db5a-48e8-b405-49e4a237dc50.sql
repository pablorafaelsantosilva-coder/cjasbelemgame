CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT UPDATE (hidden) ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_read_visible ON public.chat_messages FOR SELECT TO authenticated USING (NOT hidden OR public.is_admin());
CREATE POLICY chat_write_own ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND NOT hidden);
CREATE POLICY chat_admin_moderate ON public.chat_messages FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE INDEX chat_messages_recent_idx ON public.chat_messages (created_at DESC, id DESC) WHERE NOT hidden;
CREATE INDEX chat_messages_author_recent_idx ON public.chat_messages (author_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.validate_chat_message() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE display_name text;
BEGIN
  IF NEW.author_id IS DISTINCT FROM auth.uid() OR NEW.hidden THEN RAISE EXCEPTION 'Mensagem não autorizada'; END IF;
  SELECT name INTO display_name FROM public.profiles WHERE id = auth.uid() AND status = 'active';
  IF display_name IS NULL THEN RAISE EXCEPTION 'Participante indisponível'; END IF;
  NEW.body := btrim(NEW.body);
  IF length(NEW.body) < 1 OR length(NEW.body) > 500 THEN RAISE EXCEPTION 'A mensagem deve ter de 1 a 500 caracteres'; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_messages WHERE author_id = auth.uid() AND created_at > now() - interval '2 seconds') THEN
    RAISE EXCEPTION 'Aguarde um instante antes de enviar outra mensagem';
  END IF;
  NEW.author_name := left(display_name, 80);
  NEW.created_at := now(); NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_chat_message BEFORE INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.validate_chat_message();
CREATE OR REPLACE FUNCTION public.touch_chat_message() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER touch_chat_message BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.touch_chat_message();
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;