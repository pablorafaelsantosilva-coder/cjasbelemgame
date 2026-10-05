CREATE TABLE public.submission_chat_shares (
  submission_id uuid PRIMARY KEY REFERENCES public.submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.submission_chat_shares TO authenticated;
GRANT UPDATE (hidden) ON public.submission_chat_shares TO authenticated;
GRANT ALL ON public.submission_chat_shares TO service_role;
ALTER TABLE public.submission_chat_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_shares_read ON public.submission_chat_shares FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin() OR (NOT hidden AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.status = 'confirmed')));
CREATE POLICY chat_shares_insert ON public.submission_chat_shares FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND NOT hidden AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('submitted', 'rejected')));
CREATE POLICY chat_shares_delete ON public.submission_chat_shares FOR DELETE TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('submitted', 'rejected')));
CREATE POLICY chat_shares_moderate ON public.submission_chat_shares FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE OR REPLACE FUNCTION public.validate_submission_chat_share() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.submissions%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin() OR NEW.submission_id IS DISTINCT FROM OLD.submission_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Moderação não permitida'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO s FROM public.submissions WHERE id = OLD.submission_id;
    IF s.id IS NULL THEN RETURN OLD; END IF;
    IF OLD.user_id IS DISTINCT FROM auth.uid() OR s.user_id IS DISTINCT FROM auth.uid() OR s.status NOT IN ('submitted', 'rejected') THEN RAISE EXCEPTION 'Não é permitido retirar este compartilhamento'; END IF;
    RETURN OLD;
  END IF;
  SELECT * INTO s FROM public.submissions WHERE id = NEW.submission_id;
  IF NEW.user_id IS DISTINCT FROM auth.uid() OR s.user_id IS DISTINCT FROM auth.uid() OR s.status NOT IN ('submitted', 'rejected') OR NEW.hidden THEN RAISE EXCEPTION 'Compartilhamento não autorizado'; END IF;
  NEW.created_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER validate_submission_chat_share BEFORE INSERT OR UPDATE OR DELETE ON public.submission_chat_shares FOR EACH ROW EXECUTE FUNCTION public.validate_submission_chat_share();
CREATE OR REPLACE FUNCTION public.get_chat_shared_media(_before timestamptz DEFAULT NULL, _limit integer DEFAULT 40)
RETURNS TABLE(submission_id uuid, author_id uuid, author_name text, challenge_title text, created_at timestamptz, file_ids uuid[], file_paths text[], file_types text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.user_id, left(p.name, 80), c.title, s.reviewed_at,
    array_agg(f.id ORDER BY f.created_at), array_agg(f.storage_path ORDER BY f.created_at), array_agg(f.file_type ORDER BY f.created_at)
  FROM public.submission_chat_shares sh
  JOIN public.submissions s ON s.id = sh.submission_id AND s.user_id = sh.user_id AND s.status = 'confirmed'
  JOIN public.profiles p ON p.id = s.user_id
  JOIN public.challenges c ON c.id = s.challenge_id
  JOIN public.submission_files f ON f.submission_id = s.id
  WHERE auth.uid() IS NOT NULL AND NOT sh.hidden AND s.reviewed_at IS NOT NULL AND (_before IS NULL OR s.reviewed_at < _before)
  GROUP BY s.id, s.user_id, p.name, c.title, s.reviewed_at
  ORDER BY s.reviewed_at DESC, s.id DESC
  LIMIT LEAST(GREATEST(_limit, 1), 40);
$$;
REVOKE ALL ON FUNCTION public.get_chat_shared_media(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_shared_media(timestamptz, integer) TO authenticated;
CREATE INDEX submission_chat_shares_visible_idx ON public.submission_chat_shares (submission_id) WHERE NOT hidden;
CREATE INDEX submissions_confirmed_media_idx ON public.submissions (reviewed_at DESC, id DESC) WHERE status = 'confirmed';