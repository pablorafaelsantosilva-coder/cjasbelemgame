
DROP VIEW IF EXISTS public.leaderboard;

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (id uuid, name text, avatar_url text, total_points integer, rank_position bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.avatar_url, p.total_points,
         RANK() OVER (ORDER BY p.total_points DESC, p.created_at ASC)
  FROM public.profiles p
  WHERE p.status = 'active'
  ORDER BY p.total_points DESC, p.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.review_submission(uuid, boolean, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.review_submission(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.adjust_points(uuid, integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.adjust_points(uuid, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.apply_points() FROM anon, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, public;

CREATE POLICY "proofs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "proofs_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "proofs_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
