import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabReportManager from "./pages/PTrabReportManager";
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import OmConfigPage from "./pages/OmConfigPage";
import OmBulkUploadPage from "./pages/OmBulkUploadPage";
import UserProfilePage from "./pages/UserProfilePage";
import CustosOperacionaisPage from "./pages/CustosOperacionaisPage"; // NOVO
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SharePage from "./pages/SharePage";

// Components
import { SessionContextProvider } from "./components/SessionContextProvider";
import ProtectedRoute from "./components/ProtectedRoute"; 

import "./App.css";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <SessionContextProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/share-ptrab" element={<SharePage />} />
              
              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/ptrab" element={<PTrabManager />} />
                <Route path="/ptrab/form" element={<PTrabForm />} />
                <Route path="/ptrab/print" element={<PTrabReportManager />} />
                
                {/* Configuration Routes */}
                <Route path="/config/diretrizes" element={<DiretrizesCusteioPage />} />
                <Route path="/config/om" element={<OmConfigPage />} />
                <Route path="/config/om/bulk-upload" element={<OmBulkUploadPage />} />
                <Route path="/config/profile" element={<UserProfilePage />} />
                <Route path="/config/custos-operacionais" element={<CustosOperacionaisPage />} /> {/* ROTA ADICIONADA */}
                
                {/* Placeholder/Missing Routes (assuming they exist or will be added) */}
                <Route path="/config/visualizacao" element={<NotFound />} />
                <Route path="/config/ptrab-export-import" element={<NotFound />} />
              </Route>

              {/* Fallback Route */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Router>
        </SessionContextProvider>
        <Toaster richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;