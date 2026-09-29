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
  IF public.is_admin() THEN RETURN OLD; END IF;
  SELECT user_id, status INTO owner_id, proof_status FROM public.submissions WHERE id = OLD.submission_id;
  IF OLD.user_id IS DISTINCT FROM auth.uid() OR owner_id IS DISTINCT FROM auth.uid() OR proof_status NOT IN ('submitted', 'rejected') THEN
    RAISE EXCEPTION 'Não é permitido remover esta comprovação';
  END IF;
  RETURN OLD;
END; $$;