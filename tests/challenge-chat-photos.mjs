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

  for (const name of [
    "0000_consented_challenge_media_in_chat",
    "0008_restore_challenge_chat_photos",
  ])
    await db.exec(
      await readFile(new URL(`../drizzle/migrations/${name}.sql`, import.meta.url), "utf8"),
    );
  for (let n = 1; n <= 3; n++)
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      id(n),
      `test${n}@example.com`,
    ]);
  await db.query("INSERT INTO public.user_roles(user_id,role) VALUES($1,'admin')", [id(2)]);
  await db.query(
    "INSERT INTO public.challenges(id,title,starts_at,ends_at,status,requires_photo,requires_video) VALUES($1,'Foto',now()-interval '1 hour',now()+interval '1 hour','agendado',true,false)",
    [id(10)],
  );
  await user(1);
  await db.query("INSERT INTO public.submissions(id,challenge_id,user_id) VALUES($1,$2,$3)", [
    id(20),
    id(10),
    id(1),
  ]);
  for (const type of ["image/jpeg", "video/mp4"]) {
    const path = `${id(1)}/${id(20)}/${type.startsWith("image") ? "foto.jpg" : "video.mp4"}`;
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('proofs',$1)", [path]);
    await db.query(
      "INSERT INTO public.submission_files(submission_id,user_id,storage_path,file_type,file_size) VALUES($1,$2,$3,$4,10)",
      [id(20), id(1), path, type],
    );
  }
  await assert.rejects(
    db.query("INSERT INTO public.submission_chat_shares(submission_id,user_id) VALUES($1,$2)", [
      id(20),
      id(1),
    ]),
    /row-level/,
  );
  await user(2);
  await db.query("UPDATE public.challenges SET share_photos_in_chat=true WHERE id=$1", [id(10)]);
  await user(1);
  await db.query("INSERT INTO public.submission_chat_shares(submission_id,user_id) VALUES($1,$2)", [
    id(20),
    id(1),
  ]);
  await user(3);
  assert.equal((await db.query("SELECT * FROM public.get_chat_shared_media()")).rows.length, 0);
  await user(2);
  await db.query("SELECT public.review_submission($1,true,null)", [id(20)]);
  await user(3);
  const rows = (await db.query("SELECT * FROM public.get_chat_shared_media()")).rows;
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].file_types, ["image/jpeg"]);
  await user(2);
  await db.query("UPDATE public.challenges SET share_photos_in_chat=false WHERE id=$1", [id(10)]);
  await user(3);
  assert.equal((await db.query("SELECT * FROM public.get_chat_shared_media()")).rows.length, 0);
  console.log("PASS opção do desafio, autorização, aprovação, filtro de fotos e desativação");
} finally {
  await db.close();
}
