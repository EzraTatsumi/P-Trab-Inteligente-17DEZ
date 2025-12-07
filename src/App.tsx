import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SessionContextProvider } from "./components/SessionContextProvider"; // Importar SessionContextProvider
import Index from "./pages/Index";
import Login from "./pages/Login";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabPrint from "./pages/PTrabPrint";
import ClasseIForm from "./pages/ClasseIForm";
import ClasseIIForm from "./pages/ClasseIIForm"; // Importar ClasseIIForm
import ClasseVForm from "./pages/ClasseVForm"; // Importar ClasseVForm
import ClasseIIIForm from "./pages/ClasseIIIForm";
import ClasseVIForm from "./pages/ClasseVIForm"; // Importar ClasseVIForm
import ClasseVIIForm from "./pages/ClasseVIIForm"; // NOVO: Importar ClasseVIIForm
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import VisualizacaoConfigPage from "./pages/VisualizacaoConfigPage";
import OmConfigPage from "./pages/OmConfigPage";
import OmBulkUploadPage from "./pages/OmBulkUploadPage";
import PTrabExportImportPage from "./pages/PTrabExportImportPage";
import PTrabSharePage from "./pages/PTrabSharePage"; // NOVO IMPORT
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider> {/* Envolver a aplicação com SessionContextProvider */}
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/ptrab" element={<PTrabManager />} />
              <Route path="/ptrab/form" element={<PTrabForm />} />
              <Route path="/ptrab/print" element={<PTrabPrint />} />
              <Route path="/ptrab/share/:token" element={<PTrabSharePage />} /> {/* NOVA ROTA */}
              <Route path="/ptrab/classe-i" element={<ClasseIForm />} />
              <Route path="/ptrab/classe-ii" element={<ClasseIIForm />} />
              <Route path="/ptrab/classe-v" element={<ClasseVForm />} />
              <Route path="/ptrab/classe-vi" element={<ClasseVIForm />} />
              <Route path="/ptrab/classe-vii" element={<ClasseVIIForm />} />
              <Route path="/ptrab/classe-iii" element={<ClasseIIIForm />} />
              <Route path="/config/diretrizes" element={<DiretrizesCusteioPage />} />
              <Route path="/config/visualizacao" element={<VisualizacaoConfigPage />} />
              <Route path="/config/om" element={<OmConfigPage />} />
              <Route path="/config/om/bulk-upload" element={<OmBulkUploadPage />} />
              <Route path="/config/ptrab-export-import" element={<PTrabExportImportPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;