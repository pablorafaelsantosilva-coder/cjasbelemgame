import type { SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReplyDraft } from "@/components/chat/ChatComposer";

export type ChatDraft = { text: string; reply: ReplyDraft | null };
type Drafts = Record<string, ChatDraft>;

// Memory only, scoped to the account and cleared with the query cache at logout.
// Navigation keeps drafts; reload/closing the page does not persist private text.
export function useChatDrafts(userId: string | null) {
  const client = useQueryClient();
  const key = ["chat-drafts", userId];
  const { data = {} } = useQuery<Drafts>({
    queryKey: key,
    queryFn: () => ({}),
    initialData: () => ({}),
    enabled: false,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
  const setDrafts = (action: SetStateAction<Drafts>) => {
    client.setQueryData<Drafts>(key, (old) =>
      typeof action === "function" ? action(old ?? {}) : action,
    );
  };
  return [data, setDrafts] as const;
}
