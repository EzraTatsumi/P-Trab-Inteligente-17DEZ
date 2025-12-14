import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';

import { SupabaseProvider } from '@/integrations/supabase/supabase-provider';
import { PTrabProvider } from '@/providers/PTrabProvider';
import Dashboard from '@/pages/Dashboard';
import RefLPCFormSection from '@/components/RefLPCFormSection';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseProvider>
        <PTrabProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              {/* Temporary route for testing the component */}
              <Route path="/test-lpc" element={<RefLPCFormSection pTrabId="some-uuid" />} />
            </Routes>
          </Router>
          <Toaster richColors />
        </PTrabProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
}

export default App;