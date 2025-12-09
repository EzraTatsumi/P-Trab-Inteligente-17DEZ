import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PTrabSummary } from '@/types/ptrab';

export const usePTrabs = () => {
  return useQuery<PTrabSummary[]>({
    queryKey: ['pTrabs'],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const userId = user?.user?.id;

      if (!userId) {
        return [];
      }

      const { data, error } = await supabase
        .from('p_trab')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching PTrabs:', error);
        throw new Error('Failed to fetch PTrabs');
      }

      // Note: totalLogistica is calculated separately or added later
      return data as PTrabSummary[];
    },
    staleTime: 1000 * 60, // 1 minute
  });
};