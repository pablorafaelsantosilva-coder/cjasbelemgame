-- Files remain private, even if a bucket was accidentally made public in the dashboard.
UPDATE storage.buckets SET public = false WHERE id = 'proofs';

DROP POLICY IF EXISTS proofs_insert_own ON storage.objects;
CREATE POLICY proofs_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.submissions s JOIN public.challenges c ON c.id = s.challenge_id
    WHERE s.id::text = (storage.foldername(name))[2] AND s.user_id = auth.uid()
      AND s.status IN ('submitted', 'rejected') AND c.status = 'agendado'
      AND now() >= c.starts_at AND now() < c.ends_at
      AND (s.status <> 'rejected' OR c.allow_resubmit)
  )
  AND EXISTS (SELECT 1 FROM public.event_settings WHERE id = 1 AND NOT finished)
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
);
DROP POLICY IF EXISTS proofs_delete_own ON storage.objects;
CREATE POLICY proofs_delete_own ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.submissions s
    WHERE s.id::text = (storage.foldername(name))[2] AND s.user_id = auth.uid()
      AND s.status IN ('submitted', 'rejected'))
);

CREATE FUNCTION public.check_approval_proofs() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE photo_required boolean; video_required boolean; has_file boolean; has_photo boolean; has_video boolean;
BEGIN
  IF NEW.status <> 'confirmed' OR OLD.status = 'confirmed' THEN RETURN NEW; END IF;
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas a organização pode confirmar envios'; END IF;
  SELECT requires_photo, requires_video INTO photo_required, video_required FROM public.challenges WHERE id = NEW.challenge_id;
  SELECT count(*) > 0, COALESCE(bool_or(f.file_type LIKE 'image/%'), false), COALESCE(bool_or(f.file_type LIKE 'video/%'), false)
    INTO has_file, has_photo, has_video
  FROM public.submission_files f JOIN storage.objects o ON o.bucket_id = 'proofs' AND o.name = f.storage_path
  WHERE f.submission_id = NEW.id AND f.user_id = NEW.user_id;
  IF NOT has_file OR (photo_required AND NOT has_photo) OR (video_required AND NOT has_video) THEN
    RAISE EXCEPTION 'Confira os arquivos: faltam as comprovações exigidas pelo desafio';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.check_approval_proofs() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER check_approval_proofs BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.check_approval_proofs();

-- Support file lookup/approval joins and the common owner/RLS filters.
CREATE INDEX IF NOT EXISTS submission_files_submission_idx ON public.submission_files(submission_id);
CREATE INDEX IF NOT EXISTS submission_files_user_idx ON public.submission_files(user_id);
CREATE INDEX IF NOT EXISTS points_transactions_user_created_idx ON public.points_transactions(user_id, created_at DESC);
