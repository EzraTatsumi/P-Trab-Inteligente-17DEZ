import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionContextProvider, useSession } from '@/components/SessionContextProvider';
import { Loader2 } from 'lucide-react';

// Pages
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import PTrabManager from '@/pages/PTrabManager';
import PTrabForm from '@/pages/PTrabForm';
import OmConfigPage from '@/pages/OmConfigPage';
import OmBulkUploadPage from '@/pages/OmBulkUploadPage';
import VisualizacaoConfigPage from '@/pages/VisualizacaoConfigPage';
import DiretrizesCusteioPage from '@/pages/DiretrizesCusteioPage';
import PTrabExportImportPage from '@/pages/PTrabExportImportPage';
import NotFound from '@/pages/NotFound';

// Classe Forms
import ClasseIForm from '@/pages/ClasseIForm';
import ClasseIIForm from '@/pages/ClasseIIForm';
import ClasseIIIForm from '@/pages/ClasseIIIForm';
import ClasseVForm from '@/pages/ClasseVForm';
import ClasseVIForm from '@/pages/ClasseVIForm';
import ClasseVIIForm from '@/pages/ClasseVIIForm';
import ClasseVIIIForm from '@/pages/ClasseVIIIForm';
import ClasseIXForm from '@/pages/ClasseIXForm'; // Adicionado import para Classe IX


const queryClient = new QueryClient();

// Componente de Rota Protegida
const ProtectedRoute = ({ element }: { element: React.ReactElement }) => {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return element;
};

// Componente de Rota de Login
const LoginRoute = ({ element }: { element: React.ReactElement }) => {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/ptrab" replace />;
  }

  return element;
};


function AppRoutes() {
  return (
    <Routes>
      {/* Rotas Públicas */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginRoute element={<Login />} />} />

      {/* Rotas Protegidas */}
      <Route path="/ptrab" element={<ProtectedRoute element={<PTrabManager />} />} />
      <Route path="/ptrab/form" element={<ProtectedRoute element={<PTrabForm />} />} />
      
      {/* Rotas de Formulários de Classes */}
      <Route path="/ptrab/classe-i" element={<ProtectedRoute element={<ClasseIForm />} />} />
      <Route path="/ptrab/classe-ii" element={<ProtectedRoute element={<ClasseIIForm />} />} />
      <Route path="/ptrab/classe-iii" element={<ProtectedRoute element={<ClasseIIIForm />} />} />
      <Route path="/ptrab/classe-v" element={<ProtectedRoute element={<ClasseVForm />} />} />
      <Route path="/ptrab/classe-vi" element={<ProtectedRoute element={<ClasseVIForm />} />} />
      <Route path="/ptrab/classe-vii" element={<ProtectedRoute element={<ClasseVIIForm />} />} />
      <Route path="/ptrab/classe-viii" element={<ProtectedRoute element={<ClasseVIIIForm />} />} />
      <Route path="/ptrab/classe-ix" element={<ProtectedRoute element={<ClasseIXForm />} />} /> {/* Adicionada rota para Classe IX */}

      {/* Rotas de Configuração */}
      <Route path="/config/om" element={<ProtectedRoute element={<OmConfigPage />} />} />
      <Route path="/config/om/upload" element={<ProtectedRoute element={<OmBulkUploadPage />} />} />
      <Route path="/config/visualizacao" element={<ProtectedRoute element={<VisualizacaoConfigPage />} />} />
      <Route path="/config/custeio" element={<ProtectedRoute element={<DiretrizesCusteioPage />} />} />
      <Route path="/config/export-import" element={<ProtectedRoute element={<PTrabExportImportPage />} />} />

      {/* Rota 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SessionContextProvider>
            <AppRoutes />
            <Toaster richColors />
          </SessionContextProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;