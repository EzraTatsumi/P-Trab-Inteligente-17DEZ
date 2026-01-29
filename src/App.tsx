import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SessionContextProvider } from "./components/SessionContextProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabReportManager from "./pages/PTrabReportManager";
import ClasseIForm from "./pages/ClasseIForm";
import ClasseIIForm from "./pages/ClasseIIForm";
import ClasseVForm from "./pages/ClasseVForm";
import ClasseIIIForm from "./pages/ClasseIIIForm";
import ClasseVIForm from "./pages/ClasseVIForm";
import ClasseVIIForm from "./pages/ClasseVIIForm";
import ClasseVIIIForm from "./pages/ClasseVIIIForm";
import ClasseIXForm from "./pages/ClasseIXForm";
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import CustosOperacionaisPage from "./pages/CustosOperacionaisPage";
import VisualizacaoConfigPage from "./pages/VisualizacaoConfigPage";
import OmConfigPage from "./pages/OmConfigPage";
import OmBulkUploadPage from "./pages/OmBulkUploadPage";
import PTrabExportImportPage from "./pages/PTrabExportImportPage";
import UserProfilePage from "./pages/UserProfilePage";
import SharePage from "./pages/SharePage"; // Importar SharePage
import ResetPasswordPage from "./pages/ResetPasswordPage"; // Importar ResetPasswordPage
import DiariaForm from "./pages/DiariaForm"; // Importar DiariaForm
import VerbaOperacionalForm from "./pages/VerbaOperacionalForm"; // NOVO IMPORT
import SuprimentoFundosForm from "./pages/SuprimentoFundosForm"; // NOVO IMPORT
import PassagemForm from "./pages/PassagemForm"; // NOVO IMPORT
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} /> {/* NOVA ROTA */}
              <Route path="/ptrab" element={<PTrabManager />} />
              <Route path="/ptrab/form" element={<PTrabForm />} />
              <Route path="/ptrab/print" element={<PTrabReportManager />} />
              <Route path="/ptrab/classe-i" element={<ClasseIForm />} />
              <Route path="/ptrab/classe-ii" element={<ClasseIIForm />} />
              <Route path="/ptrab/classe-v" element={<ClasseVForm />} />
              <Route path="/ptrab/classe-vi" element={<ClasseVIForm />} />
              <Route path="/ptrab/classe-vii" element={<ClasseVIIForm />} />
              <Route path="/ptrab/classe-viii" element={<ClasseVIIIForm />} />
              <Route path="/ptrab/classe-ix" element={<ClasseIXForm />} />
              <Route path="/ptrab/classe-iii" element={<ClasseIIIForm />} />
              <Route path="/ptrab/diaria" element={<DiariaForm />} /> {/* ROTA ADICIONADA */}
              <Route path="/ptrab/verba-operacional" element={<VerbaOperacionalForm />} /> {/* NOVA ROTA */}
              <Route path="/ptrab/suprimento-fundos" element={<SuprimentoFundosForm />} /> {/* NOVA ROTA */}
              <Route path="/ptrab/passagem-aerea" element={<PassagemForm />} /> {/* NOVA ROTA */}
              <Route path="/config/custos-operacionais" element={<CustosOperacionaisPage />} />
              <Route path="/config/diretrizes" element={<DiretrizesCusteioPage />} />
              <Route path="/config/visualizacao" element={<VisualizacaoConfigPage />} />
              <Route path="/config/om" element={<OmConfigPage />} />
              <Route path="/config/om/bulk-upload" element={<OmBulkUploadPage />} />
              <Route path="/config/ptrab-export-import" element={<PTrabExportImportPage />} />
              <Route path="/config/profile" element={<UserProfilePage />} />
              <Route path="/share-ptrab" element={<SharePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;