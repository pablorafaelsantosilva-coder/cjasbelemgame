import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QueryFeedback({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/20 bg-card p-4"
    >
      <AlertCircle className="size-5 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 size-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
