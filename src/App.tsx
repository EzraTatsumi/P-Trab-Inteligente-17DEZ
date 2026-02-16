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
import UserProfilePage from "./pages/UserProfilePage";
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import CustosOperacionaisPage from "./pages/CustosOperacionaisPage";
import VisualizacaoConfigPage from "./pages/VisualizacaoConfigPage";
import OmConfigPage from "./pages/OmConfigPage";
import PTrabExportImportPage from "./pages/PTrabExportImportPage";
import SharePage from "./pages/SharePage";
import DOREditor from "./pages/DOREditor";
import ProtectedRoute from "./components/ProtectedRoute";

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
            <Route path="/ptrab" element={<ProtectedRoute><PTrabManager /></ProtectedRoute>} />
            <Route path="/ptrab/form" element={<ProtectedRoute><PTrabForm /></ProtectedRoute>} />
            <Route path="/ptrab/print" element={<ProtectedRoute><PTrabReportManager /></ProtectedRoute>} />
            <Route path="/ptrab/dor" element={<ProtectedRoute><DOREditor /></ProtectedRoute>} />
            <Route path="/config/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
            <Route path="/config/diretrizes" element={<ProtectedRoute><DiretrizesCusteioPage /></ProtectedRoute>} />
            <Route path="/config/custos-operacionais" element={<ProtectedRoute><CustosOperacionaisPage /></ProtectedRoute>} />
            <Route path="/config/visualizacao" element={<ProtectedRoute><VisualizacaoConfigPage /></ProtectedRoute>} />
            <Route path="/config/om" element={<ProtectedRoute><OmConfigPage /></ProtectedRoute>} />
            <Route path="/config/ptrab-export-import" element={<ProtectedRoute><PTrabExportImportPage /></ProtectedRoute>} />
            <Route path="/share-ptrab" element={<SharePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SessionContextProvider>
  </QueryClientProvider>
);

export default App;