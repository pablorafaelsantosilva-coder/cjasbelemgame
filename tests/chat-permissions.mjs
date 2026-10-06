// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module,
// or install it temporarily with npm install --no-save --package-lock=false @electric-sql/pglite.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let passed = 0;
async function check(name, fn) {
  await fn();
  console.log(`PASS ${name}`);
  passed++;
}
async function user(n) {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [n ? id(n) : ""]);
  await db.exec(n ? "SET ROLE authenticated" : "SET ROLE anon");
}
async function ageMessages() {
  await db.exec(
    "RESET ROLE; UPDATE public.direct_messages SET created_at = now() - interval '5 seconds'",
  );
}
async function send(sender, recipient, body, reply = null) {
  return (
    await db.query(
      "INSERT INTO public.direct_messages(sender_id,recipient_id,body,reply_to_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [id(sender), id(recipient), body, reply],
    )
  ).rows[0];
}
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id), name text, avatar_url text, status text, email text, admin boolean DEFAULT false);
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.profiles TO authenticated;
    CREATE POLICY profile_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT admin FROM public.profiles WHERE id=auth.uid()),false) $$;
  `);
  for (let n = 1; n <= 5; n++) {
    await db.query("INSERT INTO auth.users VALUES ($1)", [id(n)]);
    await db.query(
      "INSERT INTO public.profiles(id,name,status,email,admin) VALUES($1,$2,$3,$4,$5)",
      [id(n), `Pessoa ${n}`, n === 4 ? "inactive" : "active", `private${n}@example.com`, n === 5],
    );
  }
  const initial = await readFile(
    new URL(
      "../supabase/migrations/20260930001535_bcae20c8-db5a-48e8-b405-49e4a237dc50.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // Publication delivery is exercised by the hosted Supabase, not this embedded database.
  await db.exec(
    initial.replace("ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;", ""),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261006033000_private_chat_and_replies.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await user(1);
  const first = await send(1, 2, "  Mensagem privada  ");
  await check("autor correto, texto normalizado e data atribuída pelo banco", async () => {
    assert.equal(first.body, "Mensagem privada");
    assert.equal(first.sender_id, id(1));
    assert.ok(first.created_at);
  });
  await check("destinatário lê a mensagem e pode responder", async () => {
    await user(2);
    assert.equal((await db.query("SELECT * FROM public.direct_messages")).rows.length, 1);
    const reply = await send(2, 1, "Resposta", first.id);
    assert.equal(reply.reply_to_id, first.id);
  });
  await check("terceiro não lê tabela, citação nem caixa de entrada alheia", async () => {
    await user(3);
    assert.equal((await db.query("SELECT * FROM public.direct_messages")).rows.length, 0);
    assert.equal(
      (await db.query("SELECT * FROM public.direct_messages WHERE id=$1", [first.id])).rows.length,
      0,
    );
    assert.equal((await db.query("SELECT * FROM public.get_direct_inbox()")).rows.length, 0);
  });
  await check("administrador do evento também não lê privados de terceiros", async () => {
    await user(5);
    assert.equal((await db.query("SELECT * FROM public.direct_messages")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM public.get_direct_inbox()")).rows.length, 0);
  });
  await check("remetente forjado é rejeitado", async () => {
    await user(3);
    await assert.rejects(send(1, 2, "Forjada"), /autorizada|row-level/);
  });
  await check("resposta de outra conversa é rejeitada", async () => {
    await user(3);
    await assert.rejects(send(3, 2, "Vazar citação", first.id), /mesma conversa/);
  });
  await check("envio a si mesmo e a pessoa inativa são rejeitados", async () => {
    await user(1);
    await assert.rejects(send(1, 1, "Eu"), /autorizada/);
    await assert.rejects(send(1, 4, "Inativa"), /indisponível/);
  });
  await check("usuário inativo não pode enviar", async () => {
    await user(4);
    await assert.rejects(send(4, 1, "Inativo"), /indisponível/);
  });
  await check("texto vazio e acima do limite são rejeitados", async () => {
    await user(3);
    await assert.rejects(send(3, 2, "   "), /caracteres/);
    await assert.rejects(send(3, 2, "x".repeat(2001)), /caracteres/);
  });
  await check("mensagens não podem ser editadas, removidas ou ter data forjada", async () => {
    await user(1);
    await assert.rejects(
      db.query("UPDATE public.direct_messages SET body='editado' WHERE id=$1", [first.id]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("DELETE FROM public.direct_messages WHERE id=$1", [first.id]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO public.direct_messages(sender_id,recipient_id,body,created_at) VALUES($1,$2,$3,now())",
        [id(1), id(2), "forjada"],
      ),
      /permission denied/,
    );
  });
  await check("limite de frequência é aplicado no banco", async () => {
    await user(3);
    await send(3, 1, "Primeira");
    await assert.rejects(send(3, 1, "Muito rápida"), /Aguarde/);
  });
  await check("diretório retorna só nome, id e avatar de ativos", async () => {
    await user(1);
    const rows = (await db.query("SELECT * FROM public.get_chat_people()")).rows;
    assert.ok(rows.length);
    assert.deepEqual(Object.keys(rows[0]).sort(), ["avatar_url", "id", "name"]);
    assert.ok(rows.every((p) => p.id !== id(1) && p.id !== id(4)));
    assert.equal(
      (await db.query("SELECT * FROM public.get_chat_people('Pessoa 2')")).rows.length,
      1,
    );
  });
  await check("caixa de entrada contém apenas os próprios interlocutores", async () => {
    await user(1);
    const rows = (await db.query("SELECT * FROM public.get_direct_inbox()")).rows;
    assert.deepEqual(rows.map((r) => r.peer_id).sort(), [id(2), id(3)]);
  });
  await check("acesso anônimo é bloqueado", async () => {
    await user(null);
    await assert.rejects(db.query("SELECT * FROM public.direct_messages"), /permission denied/);
    await assert.rejects(db.query("SELECT * FROM public.get_direct_inbox()"), /permission denied/);
    await assert.rejects(db.query("SELECT * FROM public.get_chat_people()"), /permission denied/);
  });
  await user(1);
  const group = (
    await db.query("INSERT INTO public.chat_messages(author_id,body) VALUES($1,$2) RETURNING id", [
      id(1),
      "Mensagem no grupo",
    ])
  ).rows[0];
  await check("resposta no grupo preserva referência e autor é validado", async () => {
    await user(2);
    const row = (
      await db.query(
        "INSERT INTO public.chat_messages(author_id,body,reply_to_id) VALUES($1,$2,$3) RETURNING *",
        [id(2), "Resposta no grupo", group.id],
      )
    ).rows[0];
    assert.equal(row.reply_to_id, group.id);
    assert.equal(row.author_name, "Pessoa 2");
  });
  await check(
    "ocultar original remove a citação das consultas e bloqueia novas respostas",
    async () => {
      await user(5);
      await db.query("UPDATE public.chat_messages SET hidden=true WHERE id=$1", [group.id]);
      await user(3);
      assert.equal(
        (await db.query("SELECT * FROM public.chat_messages WHERE id=$1", [group.id])).rows.length,
        0,
      );
      await assert.rejects(
        db.query("INSERT INTO public.chat_messages(author_id,body,reply_to_id) VALUES($1,$2,$3)", [
          id(3),
          "Resposta oculta",
          group.id,
        ]),
        /disponível/,
      );
    },
  );
  console.log(`${passed} verificações de permissão passaram.`);
} finally {
  await db.close();
}
