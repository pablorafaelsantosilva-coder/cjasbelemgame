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
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
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
  for (let n = 1; n <= 3; n++)
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      id(n),
      `user${n}@example.com`,
    ]);
  await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [id(2)]);
  await db.query(
    "INSERT INTO public.challenges(id,title,starts_at,ends_at,status,requires_photo,requires_video,points) VALUES($1,'Teste',now()-interval '1 day',now()+interval '1 day','agendado',true,true,100)",
    [id(10)],
  );
  await user(1);
  await db.query("INSERT INTO public.submissions(id,challenge_id,user_id) VALUES($1,$2,$3)", [
    id(20),
    id(10),
    id(1),
  ]);
  const photo = `${id(1)}/${id(20)}/photo.jpg`,
    video = `${id(1)}/${id(20)}/video.mp4`;
  await check("participante não aprova nem altera os próprios pontos", async () => {
    await assert.rejects(
      db.query("SELECT public.review_submission($1,true,null)", [id(20)]),
      /Acesso negado/,
    );
    await assert.rejects(
      db.query("UPDATE public.profiles SET total_points=999 WHERE id=$1", [id(1)]),
      /permission denied/,
    );
  });
  await check("admin não aprova envio sem arquivo", async () => {
    await user(2);
    await assert.rejects(
      db.query("SELECT public.review_submission($1,true,null)", [id(20)]),
      /comprovações/,
    );
  });
  await check("participante envia apenas para sua pasta e submissão", async () => {
    await user(1);
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [photo]);
    await assert.rejects(
      db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [
        `${id(3)}/${id(20)}/fake.jpg`,
      ]),
      /row-level/,
    );
    await db.query(
      "INSERT INTO public.submission_files(submission_id,user_id,storage_path,file_type,file_size) VALUES($1,$2,$3,$4,10)",
      [id(20), id(1), photo, "image/jpeg"],
    );
  });
  await check("foto sozinha não satisfaz desafio que exige vídeo", async () => {
    await user(2);
    await assert.rejects(
      db.query("SELECT public.review_submission($1,true,null)", [id(20)]),
      /comprovações/,
    );
  });
  await user(1);
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [video]);
  await db.query(
    "INSERT INTO public.submission_files(submission_id,user_id,storage_path,file_type,file_size) VALUES($1,$2,$3,$4,10)",
    [id(20), id(1), video, "video/mp4"],
  );
  await check("admin aprova arquivos completos e concede pontos uma única vez", async () => {
    await user(2);
    await db.query("SELECT public.review_submission($1,true,null)", [id(20)]);
    await assert.rejects(
      db.query("SELECT public.review_submission($1,true,null)", [id(20)]),
      /confirmado/,
    );
    assert.equal(
      (await db.query("SELECT total_points FROM public.profiles WHERE id=$1", [id(1)])).rows[0]
        .total_points,
      100,
    );
  });
  await check(
    "arquivo aprovado não pode ser removido nem receber novos uploads pelo dono",
    async () => {
      await user(1);
      assert.equal(
        (await db.query("DELETE FROM storage.objects WHERE name=$1 RETURNING id", [photo])).rows
          .length,
        0,
      );
      assert.equal(
        (await db.query("SELECT id FROM storage.objects WHERE name=$1", [photo])).rows.length,
        1,
      );
      await assert.rejects(
        db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [
          `${id(1)}/${id(20)}/extra.jpg`,
        ]),
        /row-level/,
      );
    },
  );
  await check("terceiro não vê os arquivos nem os registros privados", async () => {
    await user(3);
    assert.equal((await db.query("SELECT * FROM storage.objects")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM public.submission_files")).rows.length, 0);
  });
  await db.exec("RESET ROLE");
  await db.query(
    "INSERT INTO public.challenges(id,title,starts_at,ends_at,status) VALUES($1,'Outro',now()-interval '1 day',now()+interval '1 day','agendado')",
    [id(11)],
  );
  await user(1);
  await db.query("INSERT INTO public.submissions(id,challenge_id,user_id) VALUES($1,$2,$3)", [
    id(21),
    id(11),
    id(1),
  ]);
  await user(2);
  await db.exec("UPDATE public.event_settings SET finished=true WHERE id=1");
  await check("evento fechado bloqueia upload direto no Storage", async () => {
    await user(1);
    await assert.rejects(
      db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [
        `${id(1)}/${id(21)}/photo.jpg`,
      ]),
      /row-level/,
    );
  });
  console.log(`${passed} verificações de segurança das comprovações passaram.`);
} finally {
  await db.close();
}
