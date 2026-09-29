ALTER FUNCTION public.resubmit_proof(uuid) SECURITY INVOKER;
GRANT UPDATE (status, submitted_at, reviewed_at, reviewed_by, rejection_reason, updated_at) ON public.submissions TO authenticated;
CREATE POLICY "submissions_resubmit_own" ON public.submissions FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND status = 'rejected')
WITH CHECK (user_id = auth.uid() AND status = 'submitted');

CREATE OR REPLACE FUNCTION public.check_submission_resubmit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c public.challenges%ROWTYPE;
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF OLD.user_id IS DISTINCT FROM auth.uid() OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.id IS DISTINCT FROM OLD.id OR NEW.challenge_id IS DISTINCT FROM OLD.challenge_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR OLD.status <> 'rejected' OR NEW.status <> 'submitted'
    OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL OR NEW.rejection_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Reenvio não permitido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.event_settings WHERE id = 1 AND finished) THEN
    RAISE EXCEPTION 'O evento foi encerrado';
  END IF;
  SELECT * INTO c FROM public.challenges WHERE id = OLD.challenge_id;
  IF NOT FOUND OR NOT c.allow_resubmit OR c.status <> 'agendado' OR now() < c.starts_at OR now() >= c.ends_at THEN
    RAISE EXCEPTION 'O desafio não está aberto para reenvio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.submission_files WHERE submission_id = OLD.id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Envie ao menos um arquivo antes de reenviar';
  END IF;
  NEW.submitted_at := now(); NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER check_submission_resubmit BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.check_submission_resubmit();