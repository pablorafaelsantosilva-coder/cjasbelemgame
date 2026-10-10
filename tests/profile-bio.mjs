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

  await db.exec(
    await readFile(new URL("../drizzle/migrations/0009_profile_bio.sql", import.meta.url), "utf8"),
  );
  for (let n = 1; n <= 2; n++)
    await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
      id(n),
      `test${n}@example.com`,
    ]);
  await user(1);
  const bio = "Belém 🌴\nFé e boas amizades ✨";
  await db.query("UPDATE public.profiles SET bio=$1 WHERE id=$2", [bio, id(1)]);
  assert.equal(
    (await db.query("SELECT public.get_participant_bio($1) bio", [id(1)])).rows[0].bio,
    bio,
  );
  await assert.rejects(
    db.query("UPDATE public.profiles SET bio=$1 WHERE id=$2", ["a".repeat(151), id(1)]),
    /check constraint/,
  );
  await db.query("UPDATE public.profiles SET bio=$1 WHERE id=$2", ["🌴".repeat(150), id(1)]);
  await user(2);
  assert.equal(
    (await db.query("SELECT public.get_participant_bio($1) bio", [id(1)])).rows[0].bio,
    "🌴".repeat(150),
  );
  assert.equal(
    (await db.query("UPDATE public.profiles SET bio='alterada' WHERE id=$1 RETURNING id", [id(1)]))
      .rows.length,
    0,
  );
  assert.equal(
    (await db.query("SELECT email FROM public.profiles WHERE id=$1", [id(1)])).rows.length,
    0,
  );
  await db.exec("RESET ROLE; SET ROLE anon");
  await assert.rejects(
    db.query("SELECT public.get_participant_bio($1)", [id(1)]),
    /permission denied/,
  );
  await user(1);
  await db.query("UPDATE public.profiles SET bio='' WHERE id=$1", [id(1)]);
  assert.equal(
    (await db.query("SELECT public.get_participant_bio($1) bio", [id(1)])).rows[0].bio,
    "",
  );
  console.log(
    "PASS salvar/remover bio, emojis, limite no banco, leitura restrita, edição própria e e-mail privado",
  );
} finally {
  await db.close();
}
