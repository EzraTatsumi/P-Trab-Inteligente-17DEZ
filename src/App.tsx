import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SessionContextProvider } from "./components/SessionContextProvider";
import Login from "./pages/Login";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabPrint from "./pages/PTrabPrint";
import ClasseIForm from "./pages/ClasseIForm";
import ClasseIIForm from "./pages/ClasseIIForm";
import ClasseIIIForm from "./pages/ClasseIIIForm";
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import VisualizacaoConfigPage from "./pages/VisualizacaoConfigPage";
import OmConfigPage from "./pages/OmConfigPage";
import OmBulkUploadPage from "./pages/OmBulkUploadPage";
import PTrabExportImportPage from "./pages/PTrabExportImportPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <Routes>
              {/* Rota raiz agora aponta para o gerenciador de PTrab (que redireciona para login se deslogado) */}
              <Route path="/" element={<PTrabManager />} /> 
              <Route path="/login" element={<Login />} />
              <Route path="/ptrab" element={<PTrabManager />} />
              <Route path="/ptrab/form" element={<PTrabForm />} />
              <Route path="/ptrab/print" element={<PTrabPrint />} />
              <Route path="/ptrab/classe-i" element={<ClasseIForm />} />
              <Route path="/ptrab/classe-ii" element={<ClasseIIForm />} />
              <Route path="/ptrab/classe-iii" element={<ClasseIIIForm />} />
              <Route path="/config/diretrizes" element={<DiretrizesCusteioPage />} />
              <Route path="/config/visualizacao" element={<VisualizacaoConfigPage />} />
              <Route path="/config/om" element={<OmConfigPage />} />
              <Route path="/config/om/bulk-upload" element={<OmBulkUploadPage />} />
              <Route path="/config/ptrab-export-import" element={<PTrabExportImportPage />} />
              {/* Removida a rota 404 e a rota Index */}
              <Route path="*" element={<PTrabManager />} />
            </Routes>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;