// Runs entirely against mocked Supabase responses; never creates real users or sends emails.
// Requires playwright and a Chromium binary. Set PLAYWRIGHT_MODULE and CHROMIUM_PATH if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const path = require("node:path");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "../.env"), "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
const artifacts = process.env.TEST_ARTIFACTS || require("node:os").tmpdir();
const base = process.env.TEST_URL || "http://127.0.0.1:5173";
const host = new URL(env.VITE_SUPABASE_URL).hostname;
const uid = "00000000-0000-4000-8000-000000000001";
const peer2 = "00000000-0000-4000-8000-000000000002";
const peer3 = "00000000-0000-4000-8000-000000000003";
const user = {
  id: uid,
  email: "teste@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};
const enc = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const session = {
  access_token:
    enc({ alg: "HS256", typ: "JWT" }) +
    "." +
    enc({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" }) +
    ".mock",
  refresh_token: "mock-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const first = {
  id: "00000000-0000-4000-8000-000000000010",
  sender_id: peer2,
  recipient_id: uid,
  body: "Oi! Vamos ao desafio?",
  reply_to_id: null,
  created_at: "2026-10-06T01:00:00Z",
};
let failDirect = false;
let legacyChat = false,
  admin = false,
  groupSent = [];
let loginError = "invalid_credentials",
  recoverRequests = 0,
  sent = [];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--use-gl=disabled",
      "--no-zygote",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.routeWebSocket("**/*", (socket) => socket.close());
  await context.route("**/*", async (route) => {
    const req = route.request(),
      u = new URL(req.url());
    if (u.origin === base && !u.pathname.includes("_serverFn/")) return route.continue();
    if (u.hostname !== host) return route.abort();
    let result = [],
      status = 200;
    if (u.pathname.endsWith("/auth/v1/signup")) result = { user, session: null };
    else if (u.pathname.endsWith("/auth/v1/resend")) result = {};
    else if (u.pathname.endsWith("/auth/v1/recover")) {
      recoverRequests++;
      result = {};
    } else if (u.pathname.endsWith("/auth/v1/token")) {
      status = 400;
      result = { code: loginError, error_code: loginError, msg: "Mock authentication error" };
    } else if (u.pathname.endsWith("/auth/v1/user")) result = user;
    else if (u.pathname.endsWith("/user_roles")) result = admin ? { role: "admin" } : null;
    else if (u.pathname.endsWith("/profiles"))
      result = {
        id: uid,
        name: "Pessoa Teste",
        email: user.email,
        status: "active",
        avatar_url: null,
        total_points: 0,
      };
    else if (u.pathname.endsWith("/get_direct_inbox"))
      result = [
        {
          peer_id: peer2,
          peer_name: "Ana Silva",
          peer_avatar_url: null,
          peer_active: true,
          last_body: "Oi! Vamos ao desafio?",
          last_at: first.created_at,
          last_sender_id: peer2,
        },
      ];
    else if (u.pathname.endsWith("/get_chat_people"))
      result = [
        { id: peer2, name: "Ana Silva", avatar_url: null },
        { id: peer3, name: "Bruno Santos", avatar_url: null },
      ];
    else if (u.pathname.endsWith("/direct_messages")) {
      if (req.method() === "POST") {
        const payload = req.postDataJSON();
        if (failDirect) {
          status = 400;
          result = { code: "P0001", message: "Falha simulada de envio" };
        } else {
          sent.push(payload);
          result = {};
        }
      } else
        result = u.searchParams.get("sender_id")?.includes(peer3)
          ? []
          : [
              first,
              ...sent
                .filter((m) => m.recipient_id === peer2)
                .map((m, i) => ({
                  ...m,
                  id: `00000000-0000-4000-8000-${String(i + 50).padStart(12, "0")}`,
                  created_at: "2026-10-06T02:00:00Z",
                })),
            ].sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (u.pathname.endsWith("/chat_messages"))
      result = [
        {
          id: "00000000-0000-4000-8000-000000000020",
          author_id: peer2,
          author_name: "Ana Silva",
          body: "Olá, pessoal!",
          hidden: false,
          reply_to_id: null,
          created_at: first.created_at,
        },
      ];
    if (u.pathname.endsWith("/chat_messages") && req.method() === "POST") {
      groupSent.push(req.postDataJSON());
      result = {};
      if (legacyChat && Object.hasOwn(groupSent.at(-1), "reply_to_id")) {
        status = 400;
        result = { code: "PGRST204", message: "Could not find reply_to_id" };
      }
    }
    if (
      legacyChat &&
      u.pathname.endsWith("/chat_messages") &&
      req.method() !== "POST" &&
      u.searchParams.get("select")?.includes("reply_to_id")
    ) {
      status = 400;
      result = { code: "42703", message: "column chat_messages.reply_to_id does not exist" };
    }
    if (
      legacyChat &&
      ["/direct_messages", "/get_direct_inbox", "/get_chat_people"].some((path) =>
        u.pathname.endsWith(path),
      )
    ) {
      status = 404;
      result = { code: "PGRST202", message: "Function not found" };
    }
    if (u.pathname.endsWith("/get_leaderboard"))
      result = [
        { id: peer2, name: "Ana Silva", avatar_url: null, total_points: 150, rank_position: 1 },
        { id: uid, name: "Pessoa Teste", avatar_url: null, total_points: 100, rank_position: 2 },
        { id: peer3, name: "Bruno Santos", avatar_url: null, total_points: 70, rank_position: 3 },
      ];
    if (u.pathname.endsWith("/event_settings"))
      result = { id: 1, name: "CJAS Belém Game", finished: false };
    if (u.pathname.endsWith("/challenges"))
      result = [
        {
          id: first.id,
          title: "Um gesto de bondade",
          description: "Compartilhe um bom momento",
          instructions: "Registre sua participação",
          status: "agendado",
          type: "normal",
          points: 50,
          starts_at: new Date(Date.now() - 3600000).toISOString(),
          ends_at: new Date(Date.now() + 3600000).toISOString(),
          requires_photo: true,
          requires_video: false,
          allow_resubmit: true,
        },
      ];
    if (req.method() === "HEAD")
      return route.fulfill({ status: 200, headers: { "content-range": "0-0/0" } });
    return route.fulfill({
      status,
      headers: {
        "x-supabase-api-version": "2024-01-01",
        "access-control-expose-headers": "X-Supabase-Api-Version",
      },
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => console.error("PAGE", error.message));
  try {
    await page.goto(base + "/auth");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Criar conta" }).click();
    await page.locator("#name").fill("Pessoa Teste");
    await page.locator("#email2").fill("teste@example.com");
    await page.locator("#pass2").fill("password123");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    await page.getByRole("heading", { name: "Falta confirmar seu e-mail!" }).waitFor();
    assert.equal(await page.locator("#password").inputValue(), "");
    assert.equal(
      await page.getByRole("link", { name: "Abrir Gmail", exact: false }).getAttribute("href"),
      "https://mail.google.com/",
    );
    await page.reload();
    await page.getByRole("heading", { name: "Falta confirmar seu e-mail!" }).waitFor();
    console.log("PASS cadastro: confirmação visível, Gmail e persistência após recarregar");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos" }).waitFor();
    console.log("PASS senha incorreta: erro persistente e orientação de recuperação");
    loginError = "email_not_confirmed";
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Confirme seu e-mail" }).waitFor();
    console.log("PASS login não confirmado");
    await page.getByRole("button", { name: "Esqueci minha senha" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
    await page.getByText("Se este e-mail tiver uma conta", { exact: false }).waitFor();
    assert.equal(recoverRequests, 1);
    await page.keyboard.press("Escape");
    console.log("PASS recuperação: formulário e confirmação persistente");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, "auth-confirmation-mobile.png") });
    await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
      key: `sb-${host.split(".")[0]}-auth-token`,
      session,
    });
    await page.goto(base + "/reset-password");
    await page.locator("#new-password").fill("new-password");
    await page.locator("#confirm-password").fill("different-password");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await page.getByRole("alert").filter({ hasText: "As senhas não são iguais" }).waitFor();
    await page.locator("#confirm-password").fill("new-password");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await page.getByRole("heading", { name: "Senha atualizada!" }).waitFor();
    console.log("PASS redefinição: confirmação de senha e salvamento");
    await page.goto(base + "/chat");
    await page.getByRole("tab", { name: "Privadas" }).click();
    await page.getByRole("button", { name: /Ana Silva/ }).click();
    await page.getByRole("button", { name: "Responder à mensagem: Oi! Vamos ao desafio?" }).click();
    await page.getByText("Respondendo a Ana Silva").waitFor();
    failDirect = true;
    await page.getByRole("textbox", { name: "Mensagem privada" }).fill("Vamos sim!");
    await page.getByRole("button", { name: "Enviar mensagem privada" }).click();
    await page.getByRole("alert").filter({ hasText: "Seu texto foi mantido" }).waitFor();
    assert.equal(
      await page.getByRole("textbox", { name: "Mensagem privada" }).inputValue(),
      "Vamos sim!",
    );
    failDirect = false;
    await page.getByRole("button", { name: "Enviar mensagem privada" }).click();
    await page.getByText("Vamos sim!", { exact: true }).waitFor();
    assert.equal(sent[0].reply_to_id, first.id);
    assert.equal(sent[0].recipient_id, peer2);
    console.log("PASS privado: conversa correta e referência de resposta enviada");
    await page.getByRole("textbox", { name: "Mensagem privada" }).fill("Rascunho da Ana");
    await page.getByRole("button", { name: "Voltar às conversas" }).click();
    await page.getByRole("button", { name: "Nova conversa", exact: true }).click();
    await page.getByRole("button", { name: "Bruno Santos" }).click();
    assert.equal(await page.getByRole("textbox", { name: "Mensagem privada" }).inputValue(), "");
    await page.getByRole("textbox", { name: "Mensagem privada" }).fill("Rascunho do Bruno");
    await page.getByRole("button", { name: "Voltar às conversas" }).click();
    await page.getByRole("button", { name: /Ana Silva/ }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "Mensagem privada" }).inputValue(),
      "Rascunho da Ana",
    );
    console.log("PASS rascunhos separados por destinatário");
    await page.screenshot({ path: path.join(artifacts, "private-chat-mobile.png") });
    await page.getByRole("tab", { name: "Geral", exact: true }).click();
    await page.getByRole("button", { name: "Responder à mensagem de Ana Silva" }).click();
    await page.getByText("Respondendo a Ana Silva").waitFor();
    await page.getByRole("button", { name: "Cancelar resposta" }).click();
    console.log("PASS responder e cancelar no chat geral");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("tab", { name: "Privadas" }).click();
    await page.screenshot({ path: path.join(artifacts, "private-chat-desktop.png") });
    await page.getByRole("button", { name: "Buscar nesta conversa" }).click();
    await page.getByRole("textbox", { name: "Buscar nas mensagens carregadas" }).fill("vamos");
    await page.getByRole("button", { name: "Mostrar resultado", exact: true }).click();
    assert.equal(await page.locator(".chat-search-match").count(), 1);
    await page.getByRole("button", { name: "Fechar busca" }).click();
    await page.getByRole("link", { name: "Início", exact: true }).click();
    await page.getByRole("heading", { name: "Cada desafio é uma nova conquista" }).waitFor();
    await page.getByRole("link", { name: "Chat", exact: true }).click();
    await page.getByRole("tab", { name: "Privadas" }).click();
    await page.getByRole("button", { name: /Ana Silva/ }).click();
    assert.equal(
      await page.getByRole("textbox", { name: "Mensagem privada" }).inputValue(),
      "Rascunho da Ana",
    );
    await page
      .getByRole("textbox", { name: "Mensagem privada" })
      .fill("Uma linha\nOutra linha\nTerceira linha\nQuarta linha");
    assert.ok(
      (await page
        .getByRole("textbox", { name: "Mensagem privada" })
        .evaluate((el) => el.clientHeight)) > 40,
    );
    await page.getByRole("textbox", { name: "Mensagem privada" }).fill("Rascunho da Ana");
    await page.evaluate(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        const result = original(query);
        if (query === "(pointer: coarse)")
          Object.defineProperty(result, "matches", { value: true });
        return result;
      };
    });
    const beforeEnter = sent.length;
    await page.getByRole("textbox", { name: "Mensagem privada" }).press("End");
    await page.getByRole("textbox", { name: "Mensagem privada" }).press("Enter");
    assert.equal(sent.length, beforeEnter);
    assert.ok(
      (await page.getByRole("textbox", { name: "Mensagem privada" }).inputValue()).includes("\n"),
    );
    console.log("PASS busca, rascunho após navegação, caixa expansível e Enter móvel sem envio");
    legacyChat = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/chat");
    await page.getByText("O chat geral está disponível.", { exact: false }).waitFor();
    await page.getByText("Olá, pessoal!", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Responder à mensagem de Ana Silva" }).count(),
      0,
    );
    await page.getByRole("textbox", { name: "Escrever mensagem" }).fill(" Mensagem compatível ");
    await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('textarea[aria-label="Escrever mensagem"]').value === "",
    );
    assert.equal(groupSent.at(-1).body, "Mensagem compatível");
    assert.equal(Object.hasOwn(groupSent.at(-1), "reply_to_id"), false);
    console.log("PASS banco antigo: leitura e envio continuam sem campo de respostas");
    await page.screenshot({ path: path.join(artifacts, "chat-legacy-mobile.png") });
    await page.getByRole("tab", { name: "Privadas" }).click();
    await page.getByText("As conversas privadas estão temporariamente", { exact: false }).waitFor();
    console.log("PASS privado pendente: aviso compreensível sem expor erro técnico");
    await page.goto(base + "/dashboard");
    await page.getByRole("heading", { name: "Cada desafio é uma nova conquista" }).waitFor();
    await page.getByText("Seu próximo passo", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Confirmados", exact: true }).click();
    assert.equal(await page.getByRole("link").filter({ hasText: "🔴 Não realizado" }).count(), 0);
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, "dashboard-mobile.png") });
    console.log("PASS início: jornada, próximo desafio e filtros");
    await page.goto(base + "/ranking");
    await page.getByRole("region", { name: "Sua posição" }).waitFor();
    await page.getByRole("textbox", { name: "Buscar no ranking" }).fill("bruno");
    await page.getByText("Bruno Santos", { exact: true }).waitFor();
    assert.equal(await page.getByText("Ana Silva", { exact: true }).count(), 0);
    await page.getByRole("textbox", { name: "Buscar no ranking" }).fill("");
    await page.screenshot({ path: path.join(artifacts, "ranking-mobile.png") });
    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    assert.equal(
      await page.evaluate(() => document.documentElement.classList.contains("dark")),
      true,
    );
    await page.reload();
    await page.getByRole("button", { name: "Ativar tema claro" }).waitFor();
    await page.getByRole("button", { name: "Ativar tema claro" }).click();
    console.log("PASS ranking: busca, posição pessoal e tema persistente");
    admin = true;
    await page.goto(base + "/admin");
    await page.getByText("A atualização do banco ainda está pendente.", { exact: true }).waitFor();
    await page.setViewportSize({ width: 320, height: 760 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      "Sem rolagem horizontal em 320px",
    );
    await page.screenshot({ path: path.join(artifacts, "admin-readiness-mobile.png") });
    console.log("PASS administrador: diagnóstico de migração e layout de 320px");
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, "ui-test-failure.png") });
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
