CREATE OR REPLACE FUNCTION public.delete_challenge(_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE c record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c IS NULL THEN RAISE EXCEPTION 'Desafio não encontrado'; END IF;

  UPDATE public.profiles p
  SET total_points = GREATEST(0, p.total_points - agg.pts), updated_at = now()
  FROM (
    SELECT user_id, SUM(points) AS pts
    FROM public.points_transactions
    WHERE challenge_id = _challenge_id
    GROUP BY user_id
  ) agg
  WHERE p.id = agg.user_id;

  DELETE FROM public.points_transactions WHERE challenge_id = _challenge_id;
  DELETE FROM public.submission_files WHERE submission_id IN (SELECT id FROM public.submissions WHERE challenge_id = _challenge_id);
  DELETE FROM public.submissions WHERE challenge_id = _challenge_id;
  DELETE FROM public.challenges WHERE id = _challenge_id;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'challenge_deleted', 'challenge', _challenge_id, jsonb_build_object('title', c.title));
END; $$;

CREATE OR REPLACE FUNCTION public.reset_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  DELETE FROM public.points_transactions;
  UPDATE public.profiles SET total_points = 0, updated_at = now() WHERE total_points <> 0;
  INSERT INTO public.audit_logs (admin_id, action, entity_type, details)
  VALUES (auth.uid(), 'leaderboard_reset', 'event', '{}'::jsonb);
END; $$;

REVOKE ALL ON FUNCTION public.delete_challenge(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_leaderboard() TO authenticated;