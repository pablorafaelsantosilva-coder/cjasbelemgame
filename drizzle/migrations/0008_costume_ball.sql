CREATE TABLE public.costume_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  costume_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  photo_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT costume_first_len CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 60),
  CONSTRAINT costume_last_len CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 80),
  CONSTRAINT costume_name_len CHECK (char_length(btrim(costume_name)) BETWEEN 1 AND 80),
  CONSTRAINT costume_desc_len CHECK (char_length(description) <= 300)
);
GRANT SELECT, INSERT, DELETE ON public.costume_entries TO authenticated;
GRANT ALL ON public.costume_entries TO service_role;
ALTER TABLE public.costume_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY costume_entries_read ON public.costume_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY costume_entries_insert ON public.costume_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND split_part(photo_path, '/', 1) = auth.uid()::text);
CREATE POLICY costume_entries_delete ON public.costume_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE public.costume_votes (
  voter_id uuid PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.costume_entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX costume_votes_entry_idx ON public.costume_votes(entry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costume_votes TO authenticated;
GRANT ALL ON public.costume_votes TO service_role;
ALTER TABLE public.costume_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY costume_votes_read_own ON public.costume_votes FOR SELECT TO authenticated USING (voter_id = auth.uid());
CREATE POLICY costume_votes_insert_own ON public.costume_votes FOR INSERT TO authenticated WITH CHECK (voter_id = auth.uid());
CREATE POLICY costume_votes_update_own ON public.costume_votes FOR UPDATE TO authenticated USING (voter_id = auth.uid()) WITH CHECK (voter_id = auth.uid());
CREATE POLICY costume_votes_delete_own ON public.costume_votes FOR DELETE TO authenticated USING (voter_id = auth.uid());

CREATE OR REPLACE FUNCTION public.validate_costume_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('costume_entries_limit'));
  IF (SELECT count(*) FROM public.costume_entries) >= 20 THEN
    RAISE EXCEPTION 'As 20 vagas do concurso já foram preenchidas.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND status = 'active') THEN
    RAISE EXCEPTION 'Conta inativa.';
  END IF;
  NEW.first_name := btrim(NEW.first_name);
  NEW.last_name := btrim(NEW.last_name);
  NEW.costume_name := btrim(NEW.costume_name);
  NEW.description := btrim(NEW.description);
  RETURN NEW;
END $$;
CREATE TRIGGER costume_entry_validate BEFORE INSERT ON public.costume_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_costume_entry();

CREATE OR REPLACE FUNCTION public.validate_costume_vote() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.costume_entries WHERE id = NEW.entry_id AND user_id = NEW.voter_id) THEN
    RAISE EXCEPTION 'Você não pode votar na sua própria fantasia.';
  END IF;
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER costume_vote_validate BEFORE INSERT OR UPDATE ON public.costume_votes
  FOR EACH ROW EXECUTE FUNCTION public.validate_costume_vote();

CREATE OR REPLACE FUNCTION public.get_costume_results()
RETURNS TABLE(entry_id uuid, votes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, count(v.voter_id) FROM public.costume_entries e
  LEFT JOIN public.costume_votes v ON v.entry_id = e.id GROUP BY e.id
$$;
REVOKE ALL ON FUNCTION public.get_costume_results() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_costume_results() TO authenticated;

CREATE POLICY costumes_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'costumes');
CREATE POLICY costumes_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'costumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY costumes_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'costumes' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));