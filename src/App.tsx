import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionContextProvider } from "@/components/SessionContextProvider";
import Index from "./pages/Index";
import Login from "./pages/Login";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabReportManager from "./pages/PTrabReportManager";
import ProfileConfig from "./pages/ProfileConfig";
import DiretrizesConfig from "./pages/DiretrizesConfig";
import CustosOperacionaisConfig from "./pages/CustosOperacionaisConfig";
import VisualizacaoConfig from "./pages/VisualizacaoConfig";
import OMConfig from "./pages/OMConfig";
import PTrabExportImport from "./pages/PTrabExportImport";
import SharePTrab from "./pages/SharePTrab";
import DOREditor from "./pages/DOREditor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionContextProvider>
      <TooltipProvider>
        <Toaster position="top-right" richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ptrab" element={<PTrabManager />} />
            <Route path="/ptrab/form" element={<PTrabForm />} />
            <Route path="/ptrab/print" element={<PTrabReportManager />} />
            <Route path="/ptrab/dor" element={<DOREditor />} />
            <Route path="/config/profile" element={<ProfileConfig />} />
            <Route path="/config/diretrizes" element={<DiretrizesConfig />} />
            <Route path="/config/custos-operacionais" element={<CustosOperacionaisConfig />} />
            <Route path="/config/visualizacao" element={<VisualizacaoConfig />} />
            <Route path="/config/om" element={<OMConfig />} />
            <Route path="/config/ptrab-export-import" element={<PTrabExportImport />} />
            <Route path="/share-ptrab" element={<SharePTrab />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SessionContextProvider>
  </QueryClientProvider>
);

export default App;