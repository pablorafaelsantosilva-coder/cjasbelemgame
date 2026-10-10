ALTER TABLE public.profiles ADD COLUMN bio text NOT NULL DEFAULT '' CHECK(char_length(bio) <= 150);
GRANT UPDATE(bio) ON public.profiles TO authenticated;
-- Return only the bio, never the participant's private profile fields.
CREATE FUNCTION public.get_participant_bio(_user_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.bio FROM public.profiles p WHERE p.id=_user_id
 AND auth.uid() IS NOT NULL
 AND (p.id=auth.uid() OR (p.status='active' AND EXISTS(
  SELECT 1 FROM public.profiles me WHERE me.id=auth.uid() AND me.status='active'
 )));
$$;
REVOKE ALL ON FUNCTION public.get_participant_bio(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_participant_bio(uuid) TO authenticated;
