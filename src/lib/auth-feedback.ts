export function authErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir. Tente novamente.",
) {
  const detail = error as {
    code?: string;
    status?: number;
    name?: string;
    message?: string;
  } | null;
  const code = detail?.code;
  if (code === "email_not_confirmed")
    return "Confirme seu e-mail antes de entrar. Abra sua caixa de entrada ou o spam.";
  if (code === "invalid_credentials")
    return "E-mail ou senha incorretos. Confira os dados ou clique em Esqueci minha senha.";
  if (
    detail?.status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  )
    return "Muitas tentativas em pouco tempo. Aguarde um minuto antes de tentar novamente.";
  if (code === "weak_password")
    return "A senha não atende aos requisitos. Escolha uma senha mais forte.";
  if (code === "same_password") return "Escolha uma senha diferente da senha anterior.";
  if (detail?.name === "AuthRetryableFetchError" || detail?.name === "TypeError")
    return "Não foi possível conectar. Confira sua internet e tente novamente.";
  return fallback;
}

export const PENDING_EMAIL_KEY = "cjas-pending-confirmation";
export function savePendingEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email, at: Date.now() }));
  } catch {
    /* Storage can be blocked by browser settings. */
  }
}
export function loadPendingEmail(): string {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_EMAIL_KEY) ?? "null");
    if (
      value &&
      typeof value.email === "string" &&
      typeof value.at === "number" &&
      Date.now() - value.at < 86400_000
    )
      return value.email;
  } catch {
    /* No persistent browser state available. */
  }
  return "";
}
export function clearPendingEmail() {
  try {
    sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    /* Best effort. */
  }
}
