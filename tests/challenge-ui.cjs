const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
const host = new URL(env.VITE_SUPABASE_URL).hostname;
const uid = "00000000-0000-4000-8000-000000000001";
const user = {
  id: uid,
  email: "test@example.com",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
const session = {
  access_token:
    enc({ alg: "HS256" }) +
    "." +
    enc({ sub: uid, exp: Math.floor(Date.now() / 1000) + 3600 }) +
    ".mock",
  refresh_token: "mock",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
};
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--use-gl=disabled",
      "--no-zygote",
    ],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  const challengeId = "00000000-0000-4000-8000-000000000010";
  const challenge = {
    id: challengeId,
    title: "Desafio aberto de teste",
    description: "Participe",
    instructions: "Envie sua foto",
    points: 100,
    first_photo_bonus: 10,
    type: "normal",
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    status: "agendado",
    requires_photo: true,
    requires_video: false,
    allow_resubmit: true,
  };
  const closed = {
    ...challenge,
    id: "00000000-0000-4000-8000-000000000011",
    title: "Desafio encerrado de teste",
    ends_at: new Date(Date.now() - 1000).toISOString(),
  };
  let reminder = null,
    finished = false,
    missing = false;
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    });
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:5173") return route.continue();
    if (url.hostname !== host) return route.abort();
    let data = [];
    if (url.pathname.endsWith("/auth/v1/token")) data = session;
    if (url.pathname.endsWith("/auth/v1/user")) data = user;
    if (url.pathname.endsWith("/user_roles")) data = null;
    if (url.pathname.endsWith("/profiles"))
      data = { id: uid, name: "Participante teste", status: "active", total_points: 0 };
    if (url.pathname.endsWith("/event_settings"))
      data = { id: 1, finished, name: "CJAS Teste", max_file_mb: 50 };
    if (url.pathname.endsWith("/challenges"))
      data = url.searchParams.has("id") ? challenge : [closed, challenge];
    if (url.pathname.endsWith("/submissions"))
      data = url.searchParams.has("challenge_id") ? null : [];
    if (url.pathname.endsWith("/challenge_reminders")) {
      if (missing)
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ code: "PGRST205", message: "missing table" }),
        });
      data = reminder;
    }
    if (url.pathname.endsWith("/rpc/set_challenge_reminder")) {
      reminder = route.request().postDataJSON()._enabled
        ? { kind: "ending", delivered_at: null }
        : null;
      data = null;
    }
    if (url.pathname.endsWith("/rpc/deliver_my_challenge_reminders"))
      data = { unread: 0, delivered: 0 };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    await page.goto(`http://127.0.0.1:5173/desafio/${challengeId}`);
    await page.waitForURL(`**/auth?challenge=${challengeId}`);
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("test-password");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(`**/desafio/${challengeId}`);
    await page.getByRole("heading", { name: challenge.title }).waitFor();
    console.log("PASS link compartilhado preservado depois do login");
    await page.getByRole("button", { name: "Compartilhar desafio" }).click();
    assert.equal(
      await page.getByLabel("Copie o link do desafio").inputValue(),
      `http://127.0.0.1:5173/desafio/${challengeId}`,
    );
    console.log("PASS compartilhamento oferece link selecionável sem permissão de clipboard");
    await page.getByRole("button", { name: "Lembrar-me" }).click();
    await page.getByRole("button", { name: "Remover lembrete" }).waitFor();
    await page.getByRole("button", { name: "Remover lembrete" }).click();
    await page.getByRole("button", { name: "Lembrar-me" }).waitFor();
    assert.equal(reminder, null);
    console.log("PASS lembrete liga/desliga e informa limite do navegador fechado");
    missing = true;
    await page.reload();
    await page.getByText(/Lembretes indisponíveis/).waitFor();
    assert.equal(await page.getByRole("button", { name: "Lembrar-me" }).isDisabled(), true);
    missing = false;
    await page.goto("http://127.0.0.1:5173/dashboard");
    await page.getByRole("heading", { name: "Abertos agora · 1" }).waitFor();
    const links = page.locator('a[href^="/desafio/"]');
    const titles = await links.allTextContents();
    assert.ok(
      titles.findIndex((t) => t.includes(challenge.title)) <
        titles.findIndex((t) => t.includes(closed.title)),
    );
    await page.getByText("Aberto agora", { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
    );
    finished = true;
    await page.reload();
    await page.getByRole("heading", { name: "Abertos agora · 0" }).waitFor();
    assert.equal(await page.getByText("Aberto agora", { exact: true }).count(), 0);
    console.log("PASS destaque, ordem de desafios, layout móvel e encerramento do evento");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
