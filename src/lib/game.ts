export type ChallengeType = "normal" | "relampago";
export type ChallengeStatus = "rascunho" | "agendado" | "encerrado" | "cancelado";
export type SubmissionStatus = "submitted" | "confirmed" | "rejected";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  instructions: string;
  points: number;
  first_photo_bonus?: number;
  share_photos_in_chat?: boolean;
  type: ChallengeType;
  starts_at: string;
  ends_at: string;
  requires_photo: boolean;
  requires_video: boolean;
  allow_resubmit: boolean;
  audience: string | null;
  max_participants: number | null;
  extra_rules: string | null;
  status: ChallengeStatus;
  created_at: string;
}

export interface Submission {
  id: string;
  challenge_id: string;
  user_id: string;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

/** Estado do desafio na linha do tempo (publicação e encerramento automáticos). */
export type LiveState = "rascunho" | "cancelado" | "agendado" | "ativo" | "encerrado";

export function liveState(
  c: Pick<Challenge, "status" | "starts_at" | "ends_at">,
  now = new Date(),
): LiveState {
  if (c.status === "rascunho") return "rascunho";
  if (c.status === "cancelado") return "cancelado";
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();
  const t = now.getTime();
  if (c.status === "encerrado" || t >= end) return "encerrado";
  if (t < start) return "agendado";
  return "ativo";
}

export const stateLabel: Record<LiveState, string> = {
  rascunho: "Rascunho",
  cancelado: "Cancelado",
  agendado: "Programado",
  ativo: "Aberto agora",
  encerrado: "Encerrado",
};

export const stateClass: Record<LiveState, string> = {
  rascunho: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
  agendado: "bg-warning/15 text-warning-foreground",
  ativo: "bg-success/15 text-success",
  encerrado: "bg-secondary text-secondary-foreground",
};

export function submissionLabel(status?: SubmissionStatus | null) {
  switch (status) {
    case "submitted":
      return { text: "🟢 Aguardando validação", className: "bg-success/12 text-success" };
    case "confirmed":
      return { text: "🔵 Confirmado", className: "bg-info/12 text-info" };
    case "rejected":
      return { text: "❌ Rejeitado", className: "bg-destructive/12 text-destructive" };
    default:
      return { text: "🔴 Não realizado", className: "bg-destructive/10 text-destructive" };
  }
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function countdown(target: string, now = Date.now()) {
  const diff = Math.max(0, new Date(target).getTime() - now);
  const total = Math.floor(diff / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const REJECTION_REASONS = [
  "Comprovação insuficiente.",
  "Arquivo não corresponde à atividade.",
  "Atividade não realizada.",
  "Arquivo inválido.",
  "Outro.",
];

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: (stats: { points: number; confirmed: number; position: number }) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first",
    icon: "🏅",
    name: "Primeiro desafio confirmado",
    description: "Tenha 1 atividade confirmada.",
    earned: (s) => s.confirmed >= 1,
  },
  {
    id: "five",
    icon: "🎯",
    name: "5 desafios confirmados",
    description: "Complete 5 atividades validadas.",
    earned: (s) => s.confirmed >= 5,
  },
  {
    id: "p500",
    icon: "⭐",
    name: "500 pontos",
    description: "Alcance 500 pontos.",
    earned: (s) => s.points >= 500,
  },
  {
    id: "p1000",
    icon: "🚀",
    name: "1.000 pontos",
    description: "Alcance 1.000 pontos.",
    earned: (s) => s.points >= 1000,
  },
  {
    id: "top10",
    icon: "🏆",
    name: "TOP 10",
    description: "Fique entre os 10 primeiros.",
    earned: (s) => s.position > 0 && s.position <= 10,
  },
];
