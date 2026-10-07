CREATE TABLE public.challenge_reminders (
 user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
 challenge_id uuid NOT NULL REFERENCES public.challenges ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('start','ending')),
 delivered_at timestamptz,
 PRIMARY KEY(user_id,challenge_id)
);
ALTER TABLE public.challenge_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.challenge_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.challenge_reminders TO authenticated;
GRANT ALL ON public.challenge_reminders TO service_role;
CREATE POLICY reminder_owner ON public.challenge_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.notifications ADD COLUMN challenge_id uuid REFERENCES public.challenges ON DELETE SET NULL;
CREATE FUNCTION public.set_challenge_reminder(_challenge uuid, _enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.challenges;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 IF NOT _enabled THEN
  DELETE FROM public.challenge_reminders WHERE user_id=auth.uid() AND challenge_id=_challenge;
  RETURN;
 END IF;
 SELECT * INTO c FROM public.challenges WHERE id=_challenge;
 IF c.id IS NULL OR c.status <> 'agendado' OR c.ends_at <= now()
  OR NOT EXISTS (SELECT 1 FROM public.event_settings WHERE id=1 AND NOT finished)
  OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active')
 THEN RAISE EXCEPTION 'Este desafio não está disponível para lembrete'; END IF;
 INSERT INTO public.challenge_reminders(user_id,challenge_id,kind)
 VALUES(auth.uid(),_challenge,CASE WHEN c.starts_at > now() THEN 'start' ELSE 'ending' END)
 ON CONFLICT(user_id,challenge_id) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.set_challenge_reminder(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_challenge_reminder(uuid,boolean) TO authenticated;
CREATE FUNCTION public.deliver_my_challenge_reminders() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; delivered integer := 0; unread integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 FOR r IN
  SELECT cr.challenge_id, cr.kind, c.title FROM public.challenge_reminders cr
  JOIN public.challenges c ON c.id=cr.challenge_id
  WHERE cr.user_id=auth.uid() AND cr.delivered_at IS NULL
   AND c.status='agendado' AND c.ends_at > now()
   AND now() >= CASE WHEN cr.kind='start' THEN c.starts_at ELSE c.ends_at - interval '10 minutes' END
   AND EXISTS(SELECT 1 FROM public.event_settings WHERE id=1 AND NOT finished)
   AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='active')
  FOR UPDATE OF cr SKIP LOCKED
 LOOP
  INSERT INTO public.notifications(user_id,title,message,type,challenge_id)
  VALUES(auth.uid(),CASE WHEN r.kind='start' THEN 'Desafio aberto!' ELSE 'O prazo está acabando!' END,
   r.title || CASE WHEN r.kind='start' THEN ' já está disponível. Participe antes do encerramento.' ELSE ' encerra em até 10 minutos. Confira o prazo.' END,
   'challenge_reminder',r.challenge_id);
  UPDATE public.challenge_reminders SET delivered_at=now() WHERE user_id=auth.uid() AND challenge_id=r.challenge_id;
  delivered := delivered+1;
 END LOOP;
 SELECT count(*) INTO unread FROM public.notifications WHERE user_id=auth.uid() AND NOT read;
 RETURN jsonb_build_object('unread',unread,'delivered',delivered);
END; $$;
REVOKE ALL ON FUNCTION public.deliver_my_challenge_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deliver_my_challenge_reminders() TO authenticated;
