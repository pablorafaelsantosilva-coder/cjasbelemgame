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
  let admin = false;
  await context.addInitScript(
    ({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${host.split(".")[0]}-auth-token`, session },
  );
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:5173" && !url.pathname.includes("_serverFn"))
      return route.continue();
    if (url.hostname !== host) return route.abort();
    let data = [];
    if (url.pathname.endsWith("/auth/v1/user")) data = user;
    if (url.pathname.endsWith("/user_roles")) data = admin ? { role: "admin" } : null;
    if (url.pathname.endsWith("/profiles"))
      data = { id: uid, name: "Administrador teste", status: "active" };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:5173/admin/conversas");
    await page.getByText("Acesso restrito", { exact: true }).waitFor();
    assert.equal(await page.locator("#review-pin").count(), 0);
    admin = true;
    await page.reload();
    await page.getByLabel("Senha adicional").waitFor();
    assert.equal(await page.getByRole("button", { name: "Acessar conversas" }).isDisabled(), true);
    await page
      .getByLabel("Motivo da consulta")
      .fill("Verificar denúncia recebida pela organização");
    await page.getByLabel("Senha adicional").fill("1234");
    assert.equal(await page.getByRole("button", { name: "Acessar conversas" }).isEnabled(), true);
    await page.getByRole("button", { name: "Acessar conversas" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByLabel("Senha adicional").inputValue(), "");
    assert.equal(await page.getByRole("button", { name: "Bloquear acesso" }).count(), 0);
    console.log(
      "PASS UI: participante bloqueado, administrador exige senha/motivo e falha fecha o acesso",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
