REVOKE UPDATE, INSERT ON public.profiles FROM authenticated;
GRANT UPDATE (name, avatar_url) ON public.profiles TO authenticated;

REVOKE UPDATE ON public.submissions FROM authenticated;

CREATE OR REPLACE FUNCTION public.check_submission_create()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c public.challenges%ROWTYPE;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.status <> 'submitted' OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.rejection_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Envio inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_settings WHERE id = 1 AND finished) THEN
    RAISE EXCEPTION 'O evento foi encerrado';
  END IF;
  SELECT * INTO c FROM public.challenges WHERE id = NEW.challenge_id;
  IF NOT FOUND OR c.status <> 'agendado' OR now() < c.starts_at OR now() >= c.ends_at THEN
    RAISE EXCEPTION 'O desafio não está aberto para envios';
  END IF;
  NEW.submitted_at := now();
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER check_submission_create BEFORE INSERT ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.check_submission_create();

CREATE OR REPLACE FUNCTION public.resubmit_proof(_submission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.submissions%ROWTYPE; c public.challenges%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.submissions WHERE id = _submission_id FOR UPDATE;
  IF NOT FOUND OR s.user_id IS DISTINCT FROM auth.uid() OR s.status <> 'rejected' THEN
    RAISE EXCEPTION 'Reenvio não permitido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_settings WHERE id = 1 AND finished) THEN
    RAISE EXCEPTION 'O evento foi encerrado';
  END IF;
  SELECT * INTO c FROM public.challenges WHERE id = s.challenge_id;
  IF NOT FOUND OR NOT c.allow_resubmit OR c.status <> 'agendado' OR now() < c.starts_at OR now() >= c.ends_at THEN
    RAISE EXCEPTION 'O desafio não está aberto para reenvio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.submission_files WHERE submission_id = s.id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Envie ao menos um arquivo antes de reenviar';
  END IF;
  UPDATE public.submissions SET status = 'submitted', submitted_at = now(), reviewed_at = NULL,
    reviewed_by = NULL, rejection_reason = NULL, updated_at = now() WHERE id = s.id;
END; $$;
REVOKE ALL ON FUNCTION public.resubmit_proof(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_proof(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_proof_file()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owner_id uuid; proof_status public.submission_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT user_id, status INTO owner_id, proof_status FROM public.submissions WHERE id = NEW.submission_id;
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR owner_id IS DISTINCT FROM auth.uid()
      OR proof_status NOT IN ('submitted', 'rejected')
      OR NEW.storage_path NOT LIKE auth.uid()::text || '/' || NEW.submission_id::text || '/%'
      OR NOT (NEW.file_type LIKE 'image/%' OR NEW.file_type LIKE 'video/%') THEN
      RAISE EXCEPTION 'Arquivo de comprovação inválido';
    END IF;
    RETURN NEW;
  END IF;
  SELECT user_id, status INTO owner_id, proof_status FROM public.submissions WHERE id = OLD.submission_id;
  IF OLD.user_id IS DISTINCT FROM auth.uid() OR owner_id IS DISTINCT FROM auth.uid() OR proof_status NOT IN ('submitted', 'rejected') THEN
    RAISE EXCEPTION 'Não é permitido remover esta comprovação';
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER check_proof_file BEFORE INSERT OR DELETE ON public.submission_files
FOR EACH ROW EXECUTE FUNCTION public.check_proof_file();

DROP POLICY IF EXISTS "submissions_update_own_pending" ON public.submissions;
DROP POLICY IF EXISTS "files_insert_own" ON public.submission_files;
CREATE POLICY "files_insert_own" ON public.submission_files FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('submitted', 'rejected')
));
DROP POLICY IF EXISTS "files_delete_own" ON public.submission_files;
CREATE POLICY "files_delete_own" ON public.submission_files FOR DELETE TO authenticated
USING (user_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('submitted', 'rejected')
));