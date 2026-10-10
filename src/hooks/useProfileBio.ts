import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfileBio(viewerId: string | null, profileId: string | null) {
  return useQuery({
    queryKey: ["profile-bio", viewerId, profileId],
    enabled: !!viewerId && !!profileId,
    retry: false,
    queryFn: async () => {
      if (!viewerId || !profileId) return "";
      const { data, error } = await supabase.rpc("get_participant_bio", { _user_id: profileId });
      if (error) throw error;
      return data ?? "";
    },
  });
}
