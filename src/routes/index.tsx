import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Camera, Trophy, Zap, ShieldCheck } from "lucide-react";
import { useSession } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import bgAsset from "@/assets/cjas-tema.png.asset.json";
import logoAsset from "@/assets/logo-cristo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CJAS Belém Game — o jogo de desafios do evento" },
      {
        name: "description",
        content:
          "Participe do CJAS Belém Game: veja os desafios de cada dia, envie sua foto ou vídeo, receba a validação da organização e suba no ranking.",
      },
      { property: "og:title", content: "CJAS Belém Game — o jogo de desafios do evento" },
      {
        property: "og:description",
        content: "Desafios diários, comprovação por foto ou vídeo, validação da organização e ranking ao vivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const highlights = [
  { icon: Camera, title: "Envie sua comprovação", text: "Tire a foto ou grave o vídeo direto pelo celular." },
  { icon: ShieldCheck, title: "Validação da organização", text: "Os pontos entram só depois da confirmação." },
  { icon: Zap, title: "Desafios relâmpago", text: "Atividades surpresa com contagem regressiva." },
  { icon: Trophy, title: "Ranking ao vivo", text: "Acompanhe sua posição durante os 4 dias." },
];

function Landing() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="relative min-h-screen bg-cover bg-center" style={{ backgroundImage: `url(${bgAsset.url})` }}>
      <div className="absolute inset-0 bg-background/88" />
      <div className="relative mx-auto flex max-w-3xl flex-col px-5 py-14">
        <span className="w-fit rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          4 dias · desafios · ranking
        </span>
        <img
          src={logoAsset.url}
          alt="Aproxime-se de Cristo — Ele é o caminho"
          className="mt-6 w-64 max-w-full sm:w-80"
        />
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          CJAS Belém <span className="text-primary">Game</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Entrar → ver o desafio → realizar → enviar a comprovação → aguardar a validação → ganhar pontos → subir no
          ranking.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Entrar / Criar conta</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth" search={{ mode: "signup" }}>
              Sou participante
            </Link>
          </Button>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2">
          {highlights.map((h) => (
            <div key={h.title} className="surface p-5">
              <h.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold">{h.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{h.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
