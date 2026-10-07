-- Existing challenges retain their announced scoring; enable the bonus in the admin editor.
ALTER TABLE public.challenges ADD COLUMN first_photo_bonus integer NOT NULL DEFAULT 0 CHECK(first_photo_bonus BETWEEN 0 AND 10000);
ALTER TABLE public.challenges ALTER COLUMN first_photo_bonus SET DEFAULT 10;
ALTER TABLE public.submission_files ADD COLUMN received_at timestamptz;
-- Existing uploads use the storage server's receipt time, never a client supplied date.
UPDATE public.submission_files f SET received_at=o.created_at
FROM storage.objects o WHERE o.bucket_id='proofs' AND o.name=f.storage_path;
CREATE FUNCTION public.stamp_proof_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE challenge uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
  NEW.received_at := OLD.received_at;
  RETURN NEW;
 END IF;
 SELECT challenge_id INTO challenge FROM public.submissions WHERE id=NEW.submission_id;
 -- Serialize new receipts and reviews for this challenge.
 PERFORM 1 FROM public.challenges WHERE id=challenge FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='proofs' AND name=NEW.storage_path) THEN
  RAISE EXCEPTION 'Aguarde o envio do arquivo antes de registrar a comprovação';
 END IF;
 NEW.received_at := clock_timestamp();
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.stamp_proof_receipt() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER stamp_proof_receipt BEFORE INSERT OR UPDATE ON public.submission_files
FOR EACH ROW EXECUTE FUNCTION public.stamp_proof_receipt();
CREATE UNIQUE INDEX one_first_photo_bonus_per_challenge ON public.points_transactions(challenge_id) WHERE type='first_photo_bonus';
CREATE INDEX photo_receipts_submission_idx ON public.submission_files(submission_id,received_at) WHERE file_type LIKE 'image/%';

CREATE OR REPLACE FUNCTION public.review_submission(_submission_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record; c record; first_photo record; bonus_id uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT * INTO c FROM public.challenges WHERE id=(SELECT challenge_id FROM public.submissions WHERE id=_submission_id) FOR UPDATE;
 SELECT * INTO s FROM public.submissions WHERE id=_submission_id FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Envio não encontrado'; END IF;
 IF s.status='confirmed' THEN RAISE EXCEPTION 'Envio já confirmado'; END IF;
 IF _approve THEN
  UPDATE public.submissions SET status='confirmed',reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=NULL,updated_at=now() WHERE id=_submission_id;
  INSERT INTO public.points_transactions(user_id,challenge_id,points,type,description,created_by)
  VALUES(s.user_id,s.challenge_id,c.points,'challenge','Desafio confirmado: '||c.title,auth.uid());
  INSERT INTO public.notifications(user_id,title,message,type,challenge_id)
  VALUES(s.user_id,'🎉 Atividade confirmada!','Você recebeu +'||c.points||' pontos por "'||c.title||'".','confirmed',c.id);
 ELSE
  UPDATE public.submissions SET status='rejected',reviewed_at=now(),reviewed_by=auth.uid(),rejection_reason=_reason,updated_at=now() WHERE id=_submission_id;
  INSERT INTO public.notifications(user_id,title,message,type,challenge_id)
  VALUES(s.user_id,'❌ Atividade não confirmada','Motivo: '||COALESCE(_reason,'não informado'),'rejected',c.id);
 END IF;
 -- The first valid receipt wins, even when administrators review later arrivals first.
 -- Earlier pending photos reserve their place until approved or rejected.
 IF c.first_photo_bonus > 0 AND NOT EXISTS(SELECT 1 FROM public.points_transactions WHERE challenge_id=c.id AND type='first_photo_bonus') THEN
  SELECT sub.id,sub.user_id,sub.status, greatest(sub.submitted_at,min(f.received_at)) AS receipt
  INTO first_photo FROM public.submissions sub
  JOIN public.submission_files f ON f.submission_id=sub.id AND f.user_id=sub.user_id
  JOIN storage.objects o ON o.bucket_id='proofs' AND o.name=f.storage_path
  WHERE sub.challenge_id=c.id AND sub.status IN ('submitted','confirmed')
   AND f.file_type LIKE 'image/%' AND f.received_at IS NOT NULL
  GROUP BY sub.id,sub.user_id,sub.status,sub.submitted_at
  ORDER BY receipt,sub.id LIMIT 1;
  IF first_photo.status='confirmed' THEN
   INSERT INTO public.points_transactions(user_id,challenge_id,points,type,description,created_by)
   VALUES(first_photo.user_id,c.id,c.first_photo_bonus,'first_photo_bonus','Primeira foto válida: '||c.title,auth.uid())
   ON CONFLICT DO NOTHING RETURNING id INTO bonus_id;
   IF bonus_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,challenge_id)
    VALUES(first_photo.user_id,'🏆 Bônus da primeira foto!','Sua foto válida chegou primeiro em "'||c.title||'". Você ganhou +'||c.first_photo_bonus||' pontos extras.','first_photo_bonus',c.id);
    INSERT INTO public.audit_logs(admin_id,action,entity_type,entity_id,details)
    VALUES(auth.uid(),'first_photo_bonus_awarded','challenge',c.id,jsonb_build_object('user_id',first_photo.user_id,'submission_id',first_photo.id,'points',c.first_photo_bonus,'received_at',first_photo.receipt));
   END IF;
  END IF;
 END IF;
 INSERT INTO public.audit_logs(admin_id,action,entity_type,entity_id,details)
 VALUES(auth.uid(),CASE WHEN _approve THEN 'submission_confirmed' ELSE 'submission_rejected' END,'submission',_submission_id,
  jsonb_build_object('challenge',c.title,'user_id',s.user_id,'reason',_reason));
END; $$;
REVOKE ALL ON FUNCTION public.review_submission(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_submission(uuid,boolean,text) TO authenticated;
