import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppearanceToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let value = window.matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      const saved = localStorage.getItem("cjas-theme");
      if (saved) value = saved === "dark";
    } catch {
      /* Browser storage is optional. */
    }
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("cjas-theme", next ? "dark" : "light");
        } catch {
          /* Keep the selection for this page. */
        }
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
