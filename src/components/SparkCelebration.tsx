import { useMemo } from "react";

/**
 * "Foguinhos" — comemoração de conta criada.
 * Brasas subindo + labareda central, na paleta do evento.
 */
export function SparkCelebration({ label = "Bem-vindo ao jogo!" }: { label?: string }) {
  const embers = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 5 + Math.random() * 12,
        delay: Math.random() * 0.9,
        duration: 1.5 + Math.random() * 1.4,
        drift: `${(Math.random() - 0.5) * 120}px`,
        tone: i % 3,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center overflow-hidden bg-background/70 backdrop-blur-sm">
      {embers.map((e) => (
        <span
          key={e.id}
          className="ember"
          style={
            {
              left: `${e.left}%`,
              width: e.size,
              height: e.size * 1.5,
              animationDelay: `${e.delay}s`,
              animationDuration: `${e.duration}s`,
              "--drift": e.drift,
              backgroundColor:
                e.tone === 0 ? "var(--gold)" : e.tone === 1 ? "var(--warning)" : "var(--primary)",
            } as React.CSSProperties
          }
        />
      ))}

      <div className="relative flex flex-col items-center">
        <span className="flame-ring" />
        <span className="flame-core" />
        <p className="mt-8 animate-pop-in text-center text-lg font-bold text-foreground">{label}</p>
        <p className="animate-pop-in text-center text-sm text-muted-foreground">Prepare-se para os desafios</p>
      </div>
    </div>
  );
}
