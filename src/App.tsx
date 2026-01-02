import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { SessionContextProvider, useSession } from './components/SessionContextProvider';
import { ThemeProvider } from './components/ThemeProvider';
import ProtectedRoute from './components/ProtectedRoute';

import Layout from './components/Layout';
import HomePage from './pages/Home';
import LoginPage from './pages/Login';
import SignupPage from './pages/Signup';
import ForgotPasswordPage from './pages/ForgotPassword';
import ResetPasswordPage from './pages/ResetPassword';
import ProfilePage from './pages/Profile';
import PTrabManagementPage from './pages/PTrabManagement';
import PTrabForm from './pages/PTrabForm';
import ClasseIForm from './pages/ClasseIForm';
import ClasseIIForm from './pages/ClasseIIForm';
import ClasseIIIForm from './pages/ClasseIIIForm';
import ClasseVForm from './pages/ClasseVForm';
import ClasseVIForm from './pages/ClasseVIForm';
import ClasseVIIForm from './pages/ClasseVIIForm';
import ClasseVIIIForm from './pages/ClasseVIIIForm';
import ClasseIXForm from './pages/ClasseIXForm';
import OMManagementPage from './pages/OMManagementPage';
import CustosCusteioPage from './pages/CustosCusteioPage';
import CustosOperacionaisPage from './pages/CustosOperacionaisPage';
import CustosEquipamentosClasseIII from './pages/CustosEquipamentosClasseIII';
import CustosClasseII from './pages/CustosClasseII';
import CustosClasseIX from './pages/CustosClasseIX';
import DiariaForm from './pages/DiariaForm'; // Importando o novo formulário

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Carregando sessão...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/signup" element={session ? <Navigate to="/" /> : <SignupPage />} />
      <Route path="/forgot-password" element={session ? <Navigate to="/" /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={session ? <Navigate to="/" /> : <ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          
          {/* Rotas de P Trab */}
          <Route path="/ptrab" element={<PTrabManagementPage />} />
          <Route path="/ptrab/form" element={<PTrabForm />} />
          
          {/* Rotas de Classes Logísticas */}
          <Route path="/ptrab/classe-i" element={<ClasseIForm />} />
          <Route path="/ptrab/classe-ii" element={<ClasseIIForm />} />
          <Route path="/ptrab/classe-iii" element={<ClasseIIIForm />} />
          <Route path="/ptrab/classe-v" element={<ClasseVForm />} />
          <Route path="/ptrab/classe-vi" element={<ClasseVIForm />} />
          <Route path="/ptrab/classe-vii" element={<ClasseVIIForm />} />
          <Route path="/ptrab/classe-viii" element={<ClasseVIIIForm />} />
          <Route path="/ptrab/classe-ix" element={<ClasseIXForm />} />
          
          {/* Rotas Operacionais */}
          <Route path="/ptrab/diaria" element={<DiariaForm />} /> {/* NOVA ROTA */}
          
          {/* Rotas de Configuração */}
          <Route path="/config/om" element={<OMManagementPage />} />
          <Route path="/config/custeio" element={<CustosCusteioPage />} />
          <Route path="/config/operacional" element={<CustosOperacionaisPage />} />
          <Route path="/config/equipamentos-classe-iii" element={<CustosEquipamentosClasseIII />} />
          <Route path="/config/classe-ii" element={<CustosClasseII />} />
          <Route path="/config/classe-ix" element={<CustosClasseIX />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <SessionContextProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster richColors />
        </BrowserRouter>
      </SessionContextProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;