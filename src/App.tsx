import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { SessionContextProvider } from './components/SessionContextProvider';
import { ThemeProvider } from './components/ThemeProvider';

// Pages
import Index from './pages/Index';
import Login from './pages/Login';
import PTrabManagement from './pages/PTrabManagement';
import PTrabForm from './pages/PTrabForm';
import PassagemForm from './pages/PassagemForm';
import ConcessionariaForm from './pages/ConcessionariaForm'; // NEW IMPORT

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <SessionContextProvider>
          <Toaster position="top-right" />
          <Router>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              
              {/* Rotas Protegidas */}
              <Route path="/ptrab" element={<PTrabManagement />} />
              <Route path="/ptrab/form" element={<PTrabForm />} />
              <Route path="/ptrab/passagem-aerea" element={<PassagemForm />} />
              <Route path="/ptrab/concessionaria" element={<ConcessionariaForm />} /> {/* NEW ROUTE */}
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </SessionContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;