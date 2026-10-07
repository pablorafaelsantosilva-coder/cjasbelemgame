-- Preserve existing opt-in shares; new challenges start with sharing disabled.
ALTER TABLE public.challenges ADD COLUMN share_photos_in_chat boolean NOT NULL DEFAULT true;
ALTER TABLE public.challenges ALTER COLUMN share_photos_in_chat SET DEFAULT false;
ALTER POLICY chat_shares_insert ON public.submission_chat_shares
WITH CHECK (user_id = auth.uid() AND NOT hidden AND EXISTS (
 SELECT 1 FROM public.submissions s JOIN public.challenges c ON c.id=s.challenge_id
 WHERE s.id=submission_id AND s.user_id=auth.uid() AND s.status IN ('submitted','rejected') AND c.share_photos_in_chat
));
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
  WHERE auth.uid() IS NOT NULL AND c.share_photos_in_chat AND f.file_type LIKE 'image/%' AND NOT sh.hidden AND s.reviewed_at IS NOT NULL AND (_before IS NULL OR s.reviewed_at < _before)
  GROUP BY s.id, s.user_id, p.name, c.title, s.reviewed_at
  ORDER BY s.reviewed_at DESC, s.id DESC
  LIMIT LEAST(GREATEST(_limit, 1), 40);
$$;
REVOKE ALL ON FUNCTION public.get_chat_shared_media(timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_shared_media(timestamptz, integer) TO authenticated;
