-- Only the trusted server may call this RPC. Participant RLS remains unchanged.
CREATE TABLE public.admin_chat_attempts (
  admin_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failures integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
ALTER TABLE public.admin_chat_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_chat_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_chat_attempts TO service_role;

CREATE FUNCTION public.review_private_chats(
  _admin uuid, _pin_valid boolean, _a uuid DEFAULT NULL, _b uuid DEFAULT NULL,
  _before timestamptz DEFAULT NULL, _before_id uuid DEFAULT NULL, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE attempts public.admin_chat_attempts; result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _admin AND role = 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_admin::text, 917));
  INSERT INTO public.admin_chat_attempts(admin_id) VALUES (_admin) ON CONFLICT DO NOTHING;
  SELECT * INTO attempts FROM public.admin_chat_attempts WHERE admin_id = _admin FOR UPDATE;
  IF attempts.locked_until > clock_timestamp() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'locked');
  END IF;
  IF attempts.locked_until IS NOT NULL THEN
    UPDATE public.admin_chat_attempts SET failures = 0, locked_until = NULL WHERE admin_id = _admin;
  END IF;
  IF _pin_valid IS DISTINCT FROM true THEN
    UPDATE public.admin_chat_attempts SET failures = failures + 1,
      locked_until = CASE WHEN failures + 1 >= 5 THEN clock_timestamp() + interval '15 minutes' ELSE NULL END
    WHERE admin_id = _admin;
    INSERT INTO public.audit_logs(admin_id, action, entity_type) VALUES (_admin, 'private_chat_password_failed', 'direct_messages');
    -- Return normally so failed attempts are committed rather than rolled back.
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pin');
  END IF;
  UPDATE public.admin_chat_attempts SET failures = 0, locked_until = NULL WHERE admin_id = _admin;
  IF _reason IS NULL OR length(btrim(_reason)) NOT BETWEEN 10 AND 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;
  IF (_a IS NULL) <> (_b IS NULL) OR (_a IS NOT NULL AND _a = _b) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_pair');
  END IF;
  IF _a IS NULL THEN
    WITH latest AS (
      SELECT DISTINCT ON (least(sender_id, recipient_id), greatest(sender_id, recipient_id)) *
      FROM public.direct_messages
      ORDER BY least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at DESC, id DESC
    ), page AS (
      SELECT m.id, m.sender_id, m.recipient_id, m.created_at, p.name sender_name, q.name recipient_name
      FROM latest m JOIN public.profiles p ON p.id=m.sender_id JOIN public.profiles q ON q.id=m.recipient_id
      WHERE _before IS NULL OR (m.created_at, m.id) < (_before, _before_id)
      ORDER BY m.created_at DESC, m.id DESC LIMIT 50
    ) SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id DESC), '[]'::jsonb) INTO result FROM page;
  ELSE
    WITH page AS (
      SELECT m.id, m.sender_id, m.recipient_id, m.created_at, m.body, p.name sender_name, q.name recipient_name
      FROM public.direct_messages m JOIN public.profiles p ON p.id=m.sender_id JOIN public.profiles q ON q.id=m.recipient_id
      WHERE ((m.sender_id=_a AND m.recipient_id=_b) OR (m.sender_id=_b AND m.recipient_id=_a))
        AND (_before IS NULL OR (m.created_at, m.id) < (_before, _before_id))
      ORDER BY m.created_at DESC, m.id DESC LIMIT 50
    ) SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC, id DESC), '[]'::jsonb) INTO result FROM page;
  END IF;
  INSERT INTO public.audit_logs(admin_id, action, entity_type, details)
    VALUES (_admin, CASE WHEN _a IS NULL THEN 'private_chat_list_viewed' ELSE 'private_chat_viewed' END,
      'direct_messages', jsonb_build_object('reason', btrim(_reason), 'participant_a', _a, 'participant_b', _b, 'rows', jsonb_array_length(result)));
  RETURN jsonb_build_object('ok', true, 'items', result);
END; $$;
REVOKE ALL ON FUNCTION public.review_private_chats(uuid, boolean, uuid, uuid, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_private_chats(uuid, boolean, uuid, uuid, timestamptz, uuid, text) TO service_role;
