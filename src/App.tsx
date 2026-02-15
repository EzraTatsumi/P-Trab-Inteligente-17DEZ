import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import PTrabManagement from "./pages/PTrabManagement";
import PTrabForm from "./pages/PTrabForm";
import ClasseI from "./pages/ClasseI";
import ClasseII from "./pages/ClasseII";
import ClasseIII from "./pages/ClasseIII";
import ClasseV from "./pages/ClasseV";
import ClasseVI from "./pages/ClasseVI";
import ClasseVII from "./pages/ClasseVII";
import ClasseVIII from "./pages/ClasseVIII";
import ClasseIX from "./pages/ClasseIX";
import Diaria from "./pages/Diaria";
import VerbaOperacional from "./pages/VerbaOperacional";
import SuprimentoFundos from "./pages/SuprimentoFundos";
import PassagemAerea from "./pages/PassagemAerea";
import HorasVooAvEx from "./pages/HorasVooAvEx";
import Concessionaria from "./pages/Concessionaria";
import MaterialConsumo from "./pages/MaterialConsumo";
import ComplementoAlimentacao from "./pages/ComplementoAlimentacao";
import ServicosTerceiros from "./pages/ServicosTerceiros";
import MaterialPermanente from "./pages/MaterialPermanente";
import DiretrizesManagement from "./pages/DiretrizesManagement";
import OMManagement from "./pages/OMManagement";
import Profile from "./pages/Profile";
import SharedPTrab from "./pages/SharedPTrab";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSession();
  if (isLoading) return null;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionContextProvider>
      <TooltipProvider>
        <Toaster position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/ptrab" element={<ProtectedRoute><PTrabManagement /></ProtectedRoute>} />
            <Route path="/ptrab/form" element={<ProtectedRoute><PTrabForm /></ProtectedRoute>} />
            <Route path="/ptrab/classe-i" element={<ProtectedRoute><ClasseI /></ProtectedRoute>} />
            <Route path="/ptrab/classe-ii" element={<ProtectedRoute><ClasseII /></ProtectedRoute>} />
            <Route path="/ptrab/classe-iii" element={<ProtectedRoute><ClasseIII /></ProtectedRoute>} />
            <Route path="/ptrab/classe-v" element={<ProtectedRoute><ClasseV /></ProtectedRoute>} />
            <Route path="/ptrab/classe-vi" element={<ProtectedRoute><ClasseVI /></ProtectedRoute>} />
            <Route path="/ptrab/classe-vii" element={<ProtectedRoute><ClasseVII /></ProtectedRoute>} />
            <Route path="/ptrab/classe-viii" element={<ProtectedRoute><ClasseVIII /></ProtectedRoute>} />
            <Route path="/ptrab/classe-ix" element={<ProtectedRoute><ClasseIX /></ProtectedRoute>} />
            <Route path="/ptrab/diaria" element={<ProtectedRoute><Diaria /></ProtectedRoute>} />
            <Route path="/ptrab/verba-operacional" element={<ProtectedRoute><VerbaOperacional /></ProtectedRoute>} />
            <Route path="/ptrab/suprimento-fundos" element={<ProtectedRoute><SuprimentoFundos /></ProtectedRoute>} />
            <Route path="/ptrab/passagem-aerea" element={<ProtectedRoute><PassagemAerea /></ProtectedRoute>} />
            <Route path="/ptrab/horas-voo-avex" element={<ProtectedRoute><HorasVooAvEx /></ProtectedRoute>} />
            <Route path="/ptrab/concessionaria" element={<ProtectedRoute><Concessionaria /></ProtectedRoute>} />
            <Route path="/ptrab/material-consumo" element={<ProtectedRoute><MaterialConsumo /></ProtectedRoute>} />
            <Route path="/ptrab/complemento-alimentacao" element={<ProtectedRoute><ComplementoAlimentacao /></ProtectedRoute>} />
            <Route path="/ptrab/servicos-terceiros" element={<ProtectedRoute><ServicosTerceiros /></ProtectedRoute>} />
            <Route path="/ptrab/material-permanente" element={<ProtectedRoute><MaterialPermanente /></ProtectedRoute>} />
            <Route path="/diretrizes" element={<ProtectedRoute><DiretrizesManagement /></ProtectedRoute>} />
            <Route path="/organizacoes" element={<ProtectedRoute><OMManagement /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/ptrab/shared/:token" element={<SharedPTrab />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SessionContextProvider>
  </QueryClientProvider>
);

export default App;