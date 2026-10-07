import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
 CREATE TABLE public.profiles(id uuid primary key, name text);
 CREATE TABLE public.user_roles(user_id uuid, role text);
 CREATE TABLE public.direct_messages(id uuid primary key, sender_id uuid, recipient_id uuid, created_at timestamptz, body text);
 CREATE TABLE public.audit_logs(admin_id uuid, action text, entity_type text, details jsonb);
 ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.direct_messages TO authenticated;
 CREATE TABLE public.unused(id int);`);
  for (let n = 1; n <= 4; n++) {
    await db.query("INSERT INTO auth.users VALUES ($1)", [id(n)]);
    await db.query("INSERT INTO public.profiles VALUES ($1,$2)", [id(n), `Pessoa ${n}`]);
  }
  await db.query("INSERT INTO public.user_roles VALUES ($1,'admin')", [id(1)]);
  await db.query("INSERT INTO public.direct_messages VALUES ($1,$2,$3,now(),$4)", [
    id(50),
    id(2),
    id(3),
    "Mensagem privada de teste",
  ]);
  await db.exec(
    await readFile(
      new URL("../drizzle/migrations/0004_admin_private_chat_review.sql", import.meta.url),
      "utf8",
    ),
  );
  const review = async (
    valid,
    admin = id(1),
    a = null,
    b = null,
    reason = "Relato de violação das regras",
  ) =>
    (
      await db.query("SELECT public.review_private_chats($1,$2,$3,$4,null,null,$5) result", [
        admin,
        valid,
        a,
        b,
        reason,
      ])
    ).rows[0].result;
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(review(true));
    await db.exec("RESET ROLE");
  }
  console.log(
    "PASS anon e usuários comuns não executam a função privilegiada, mesmo simulando senha válida",
  );
  await db.exec("SET ROLE authenticated");
  assert.equal((await db.query("SELECT * FROM public.direct_messages")).rows.length, 0);
  await assert.rejects(db.query("SELECT * FROM public.admin_chat_attempts"));
  await db.exec("RESET ROLE");
  console.log("PASS leitura direta e tabela de tentativas permanecem protegidas");
  await db.exec("SET ROLE service_role");
  assert.equal((await review(true, id(2))).error, "forbidden");
  console.log("PASS servidor também rejeita identificador de não administrador");
  for (let i = 0; i < 5; i++) assert.equal((await review(false)).error, "invalid_pin");
  assert.equal((await review(true)).error, "locked");
  console.log(
    "PASS cinco erros são persistidos e bloqueiam inclusive a senha válida por 15 minutos",
  );
  await db.exec("RESET ROLE");
  await db.exec("UPDATE public.admin_chat_attempts SET locked_until=now()-interval '1 second'");
  await db.exec("SET ROLE service_role");
  assert.equal((await review(true, id(1), null, null, "")).error, "invalid_reason");
  const list = await review(true);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].body, undefined);
  const conversation = await review(true, id(1), id(2), id(3));
  assert.equal(conversation.items[0].body, "Mensagem privada de teste");
  assert.equal((await review(true, id(1), id(2), id(4))).items.length, 0);
  console.log("PASS motivo obrigatório, lista sem conteúdo e leitura apenas do par solicitado");
  await db.exec("RESET ROLE");
  const logs = (
    await db.query("SELECT * FROM public.audit_logs WHERE action='private_chat_viewed'")
  ).rows;
  assert.equal(logs.length, 2);
  assert.equal(logs[0].details.reason, "Relato de violação das regras");
  assert.equal(JSON.stringify(logs).includes("Mensagem privada de teste"), false);
  console.log(
    "PASS consultas registram administrador, motivo e participantes, sem copiar mensagens",
  );
} finally {
  await db.close();
}
