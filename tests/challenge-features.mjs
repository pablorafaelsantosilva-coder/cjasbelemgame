import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function user(n) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id(n)]);
  await db.exec("SET ROLE authenticated");
}
let passed = 0;
async function check(name, fn) {
  await fn();
  console.log("PASS " + name);
  passed++;
}
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean DEFAULT false,file_size_limit bigint);
 INSERT INTO storage.buckets VALUES('proofs',false,52428800);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,created_at timestamptz DEFAULT now());
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
 CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;`);
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(folder)).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = (await readFile(new URL(file, folder), "utf8")).replace(
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;",
      "",
    );
    await db.exec(sql);
  }

  for (const name of [
    "0000_consented_challenge_media_in_chat",
    "0005_challenge_reminders",
    "0006_first_photo_bonus",
    "0007_challenge_chat_photos",
  ])
    await db.exec(
      await readFile(new URL(`../drizzle/migrations/${name}.sql`, import.meta.url), "utf8"),
    );
  for (let n = 1; n <= 4; n++)
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      id(n),
      `user${n}@example.com`,
    ]);
  await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [id(4)]);
  for (let n = 10; n <= 17; n++)
    await db.query(
      "INSERT INTO public.challenges(id,title,starts_at,ends_at,status,requires_photo,requires_video,points) VALUES($1,'Teste',now()-interval '1 hour',now()+interval '5 minutes','agendado',true,false,100)",
      [id(n)],
    );
  await user(1);
  await check(
    "lembrete só pertence ao usuário; mutação direta e acesso anônimo bloqueados",
    async () => {
      await db.query("SELECT public.set_challenge_reminder($1,true)", [id(10)]);
      await assert.rejects(
        db.query("INSERT INTO public.challenge_reminders VALUES($1,$2,'start',null)", [
          id(2),
          id(11),
        ]),
      );
      await user(2);
      assert.equal((await db.query("SELECT * FROM public.challenge_reminders")).rows.length, 0);
      await db.exec("RESET ROLE; SET ROLE anon");
      await assert.rejects(db.query("SELECT public.deliver_my_challenge_reminders()"));
      await user(1);
    },
  );
  await check("lembrete vencendo entrega uma única notificação com link", async () => {
    let result = (await db.query("SELECT public.deliver_my_challenge_reminders() value")).rows[0]
      .value;
    assert.equal(result.delivered, 1);
    assert.equal(result.unread, 1);
    assert.equal(
      (await db.query("SELECT challenge_id FROM public.notifications")).rows[0].challenge_id,
      id(10),
    );
    result = (await db.query("SELECT public.deliver_my_challenge_reminders() value")).rows[0].value;
    assert.equal(result.delivered, 0);
    await db.query("SELECT public.set_challenge_reminder($1,true)", [id(10)]);
    assert.equal(
      (await db.query("SELECT public.deliver_my_challenge_reminders() value")).rows[0].value
        .delivered,
      0,
    );
  });
  await check(
    "cancelamento, agendamento futuro e evento encerrado não enviam lembrete",
    async () => {
      await db.query("SELECT public.set_challenge_reminder($1,true)", [id(11)]);
      await db.query("SELECT public.set_challenge_reminder($1,false)", [id(11)]);
      await db.exec("RESET ROLE");
      await db.query(
        "UPDATE public.challenges SET starts_at=now()+interval '1 minute',ends_at=now()+interval '1 hour' WHERE id=$1",
        [id(11)],
      );
      await user(1);
      await db.query("SELECT public.set_challenge_reminder($1,true)", [id(11)]);
      assert.equal(
        (await db.query("SELECT public.deliver_my_challenge_reminders() value")).rows[0].value
          .delivered,
        0,
      );
      await db.exec("RESET ROLE; UPDATE public.event_settings SET finished=true WHERE id=1");
      await assert.rejects(db.query("SELECT public.set_challenge_reminder($1,true)", [id(12)]));
      assert.equal(
        (await db.query("SELECT public.deliver_my_challenge_reminders() value")).rows[0].value
          .delivered,
        0,
      );
      await db.exec("UPDATE public.event_settings SET finished=false WHERE id=1");
      await db.query(
        "UPDATE public.challenges SET starts_at=now()-interval '1 minute' WHERE id=$1",
        [id(11)],
      );
      await user(1);
      assert.equal(
        (await db.query("SELECT public.deliver_my_challenge_reminders() value")).rows[0].value
          .delivered,
        1,
      );
    },
  );
  async function submit(who, challenge, submission, photo = true) {
    await user(who);
    await db.query("INSERT INTO public.submissions(id,challenge_id,user_id) VALUES($1,$2,$3)", [
      id(submission),
      id(challenge),
      id(who),
    ]);
    if (photo) await upload(who, submission);
  }
  async function upload(who, submission) {
    await user(who);
    const path = `${id(who)}/${id(submission)}/photo.jpg`;
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [path]);
    await db.query(
      "INSERT INTO public.submission_files(submission_id,user_id,storage_path,file_type,file_size,received_at) VALUES($1,$2,$3,'image/jpeg',10,'2000-01-01')",
      [id(submission), id(who), path],
    );
    const receipt = (
      await db.query("SELECT received_at FROM public.submission_files WHERE submission_id=$1", [
        id(submission),
      ])
    ).rows[0].received_at;
    assert.ok(new Date(receipt).getFullYear() > 2020, "client cannot forge the receipt");
  }
  async function review(submission, approve) {
    await user(4);
    return db.query("SELECT public.review_submission($1,$2,'Teste')", [id(submission), approve]);
  }
  async function bonuses(challenge) {
    await user(4);
    return (
      await db.query(
        "SELECT * FROM public.points_transactions WHERE challenge_id=$1 AND type='first_photo_bonus'",
        [id(challenge)],
      )
    ).rows;
  }
  await check(
    "aprovação fora de ordem aguarda a primeira foto; pontos sem duplicação",
    async () => {
      await submit(1, 12, 21);
      await submit(2, 12, 22);
      await review(22, true);
      assert.equal((await bonuses(12)).length, 0);
      await review(21, true);
      const b = await bonuses(12);
      assert.equal(b.length, 1);
      assert.equal(b[0].user_id, id(1));
      assert.equal(b[0].points, 10);
      await assert.rejects(review(21, true), /já confirmado/);
      assert.equal((await bonuses(12)).length, 1);
      assert.equal(
        (await db.query("SELECT total_points FROM public.profiles WHERE id=$1", [id(1)])).rows[0]
          .total_points,
        110,
      );
    },
  );
  await check("primeira foto rejeitada libera bônus ao próximo envio aprovado", async () => {
    await submit(1, 13, 31);
    await submit(2, 13, 32);
    await review(32, true);
    await review(31, false);
    assert.equal((await bonuses(13))[0].user_id, id(2));
  });
  await check("reserva sem foto não ganha prioridade sobre upload concluído", async () => {
    await submit(1, 14, 41, false);
    await submit(2, 14, 42);
    await upload(1, 41);
    await review(41, true);
    assert.equal((await bonuses(14)).length, 0);
    await review(42, true);
    assert.equal((await bonuses(14))[0].user_id, id(2));
  });
  await check(
    "participante não aprova, não altera bônus e não registra arquivo inexistente",
    async () => {
      await submit(3, 15, 51, false);
      await assert.rejects(
        db.query("SELECT public.review_submission($1,true,null)", [id(51)]),
        /Acesso negado/,
      );
      const updated = await db.query(
        "UPDATE public.challenges SET first_photo_bonus=1000 WHERE id=$1 RETURNING id",
        [id(15)],
      );
      assert.equal(updated.rows.length, 0);
      await assert.rejects(
        db.query(
          "INSERT INTO public.submission_files(submission_id,user_id,storage_path,file_type,file_size) VALUES($1,$2,$3,'image/jpeg',10)",
          [id(51), id(3), `${id(3)}/${id(51)}/missing.jpg`],
        ),
        /Aguarde/,
      );
      await assert.rejects(review(51, true), /comprovações/);
    },
  );
  await check("reenvio perde a prioridade da foto antiga", async () => {
    await submit(1, 16, 61);
    await review(61, false);
    await submit(2, 16, 62);
    await user(1);
    await db.query("SELECT public.resubmit_proof($1)", [id(61)]);
    await review(61, true);
    assert.equal((await bonuses(16)).length, 0);
    await review(62, true);
    assert.equal((await bonuses(16))[0].user_id, id(2));
  });
  await check(
    "fotos no chat exigem opção do desafio, consentimento e aprovação; vídeos ficam privados",
    async () => {
      await submit(1, 17, 71);
      await assert.rejects(
        db.query("INSERT INTO public.submission_chat_shares(submission_id,user_id) VALUES($1,$2)", [
          id(71),
          id(1),
        ]),
        /row-level/,
      );
      await user(4);
      await db.query("UPDATE public.challenges SET share_photos_in_chat=true WHERE id=$1", [
        id(17),
      ]);
      await user(1);
      await db.query(
        "INSERT INTO public.submission_chat_shares(submission_id,user_id) VALUES($1,$2)",
        [id(71), id(1)],
      );
      const video = `${id(1)}/${id(71)}/video.mp4`;
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [video]);
      await db.query(
        "INSERT INTO public.submission_files(submission_id,user_id,storage_path,file_type,file_size) VALUES($1,$2,$3,'video/mp4',10)",
        [id(71), id(1), video],
      );
      await user(3);
      assert.equal((await db.query("SELECT * FROM public.get_chat_shared_media()")).rows.length, 0);
      await review(71, true);
      await submit(2, 17, 72);
      await review(72, true);
      await user(3);
      const visible = (await db.query("SELECT * FROM public.get_chat_shared_media()")).rows;
      assert.equal(visible.length, 1);
      assert.equal(visible[0].submission_id, id(71));
      assert.deepEqual(visible[0].file_types, ["image/jpeg"]);
      await user(4);
      await db.query("UPDATE public.challenges SET share_photos_in_chat=false WHERE id=$1", [
        id(17),
      ]);
      await user(3);
      assert.equal((await db.query("SELECT * FROM public.get_chat_shared_media()")).rows.length, 0);
    },
  );
  console.log(`${passed} cenários aprovados.`);
} finally {
  await db.close();
}
