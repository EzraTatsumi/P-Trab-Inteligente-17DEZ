import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionContextProvider } from "@/components/SessionContextProvider";
import { HelmetProvider } from "react-helmet-async";
import { WelcomeModal } from "@/components/WelcomeModal";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import Index from "./pages/Index";
import Login from "./pages/Login";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabReportManager from "./pages/PTrabReportManager";
import UserProfilePage from "./pages/UserProfilePage";
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import CustosOperacionaisPage from "./pages/CustosOperacionaisPage";
import VisualizacaoConfigPage from "./pages/VisualizacaoConfigPage";
import OmConfigPage from "./pages/OmConfigPage";
import OmBulkUploadPage from "./pages/OmBulkUploadPage";
import PTrabExportImportPage from "./pages/PTrabExportImportPage";
import SharePage from "./pages/SharePage";
import DOREditor from "./pages/DOREditor";
import ProtectedRoute from "./components/ProtectedRoute";

// Importação dos formulários específicos
import ClasseIForm from "./pages/ClasseIForm";
import ClasseIIForm from "./pages/ClasseIIForm";
import ClasseVForm from "./pages/ClasseVForm";
import ClasseIIIForm from "./pages/ClasseIIIForm";
import ClasseVIForm from "./pages/ClasseVIForm";
import ClasseVIIForm from "./pages/ClasseVIIForm";
import ClasseVIIIForm from "./pages/ClasseVIIIForm";
import ClasseIXForm from "./pages/ClasseIXForm";
import DiariaForm from "./pages/DiariaForm";
import VerbaOperacionalForm from "./pages/VerbaOperacionalForm";
import SuprimentoFundosForm from "./pages/SuprimentoFundosForm";
import PassagemForm from "./pages/PassagemForm";
import HorasVooForm from "./pages/HorasVooForm";
import ConcessionariaForm from "./pages/ConcessionariaForm";
import MaterialConsumoForm from "./pages/MaterialConsumoForm";
import MaterialPermanenteForm from "./pages/MaterialPermanenteForm";
import ComplementoAlimentacaoForm from "./pages/ComplementoAlimentacaoForm";
import ServicosTerceirosForm from "./pages/ServicosTerceirosForm";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { GhostModeBanner } from "./components/GhostModeBanner";

const queryClient = new QueryClient();

// Componente interno que consome os contextos
const AppContent = () => {
  const { data: status } = useOnboardingStatus();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Abre o modal se o usuário ainda não estiver 'Ready' e não tiver concluído as missões
  useEffect(() => {
    if (status && !status.isReady && !status.hasMissions) {
      setWelcomeOpen(true);
    }
  }, [status]);

  return (
    <>
      <WelcomeModal 
        open={welcomeOpen} 
        onOpenChange={setWelcomeOpen} 
        status={status || null} 
      />
      <GhostModeBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Rotas Principais do P Trab */}
          <Route path="/ptrab" element={<ProtectedRoute><PTrabManager /></ProtectedRoute>} />
          <Route path="/ptrab/form" element={<ProtectedRoute><PTrabForm /></ProtectedRoute>} />
          <Route path="/ptrab/print" element={<ProtectedRoute><PTrabReportManager /></ProtectedRoute>} />
          <Route path="/ptrab/dor" element={<ProtectedRoute><DOREditor /></ProtectedRoute>} />
          
          {/* Rotas de Formulários Específicos (Logística) */}
          <Route path="/ptrab/classe-i" element={<ProtectedRoute><ClasseIForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-ii" element={<ProtectedRoute><ClasseIIForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-iii" element={<ProtectedRoute><ClasseIIIForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-v" element={<ProtectedRoute><ClasseVForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-vi" element={<ProtectedRoute><ClasseVIForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-vii" element={<ProtectedRoute><ClasseVIIForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-viii" element={<ProtectedRoute><ClasseVIIIForm /></ProtectedRoute>} />
          <Route path="/ptrab/classe-ix" element={<ProtectedRoute><ClasseIXForm /></ProtectedRoute>} />
          
          {/* Rotas de Formulários Específicos (Operacional) */}
          <Route path="/ptrab/diaria" element={<ProtectedRoute><DiariaForm /></ProtectedRoute>} />
          <Route path="/ptrab/verba-operacional" element={<ProtectedRoute><VerbaOperacionalForm /></ProtectedRoute>} />
          <Route path="/ptrab/suprimento-fundos" element={<ProtectedRoute><SuprimentoFundosForm /></ProtectedRoute>} />
          <Route path="/ptrab/passagem-aerea" element={<ProtectedRoute><PassagemForm /></ProtectedRoute>} />
          <Route path="/ptrab/horas-voo-avex" element={<ProtectedRoute><HorasVooForm /></ProtectedRoute>} />
          <Route path="/ptrab/concessionaria" element={<ProtectedRoute><ConcessionariaForm /></ProtectedRoute>} />
          <Route path="/ptrab/material-consumo" element={<ProtectedRoute><MaterialConsumoForm /></ProtectedRoute>} />
          <Route path="/ptrab/material-permanente" element={<ProtectedRoute><MaterialPermanenteForm /></ProtectedRoute>} />
          <Route path="/ptrab/complemento-alimentacao" element={<ProtectedRoute><ComplementoAlimentacaoForm /></ProtectedRoute>} />
          <Route path="/ptrab/servicos-terceiros" element={<ProtectedRoute><ServicosTerceirosForm /></ProtectedRoute>} />
          
          {/* Configurações */}
          <Route path="/config/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
          <Route path="/config/diretrizes" element={<ProtectedRoute><DiretrizesCusteioPage /></ProtectedRoute>} />
          <Route path="/config/custos-operacionais" element={<ProtectedRoute><CustosOperacionaisPage /></ProtectedRoute>} />
          <Route path="/config/visualizacao" element={<ProtectedRoute><VisualizacaoConfigPage /></ProtectedRoute>} />
          <Route path="/config/om" element={<ProtectedRoute><OmConfigPage /></ProtectedRoute>} />
          <Route path="/config/om/bulk-upload" element={<ProtectedRoute><OmBulkUploadPage /></ProtectedRoute>} />
          <Route path="/config/ptrab-export-import" element={<ProtectedRoute><PTrabExportImportPage /></ProtectedRoute>} />
          
          <Route path="/share-ptrab" element={<SharePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <SessionContextProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </SessionContextProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;