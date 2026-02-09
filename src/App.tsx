import { BrowserRouter, Routes, Route } from "react-router-dom";
import PTrabManager from "./pages/PTrabManager";
import PTrabForm from "./pages/PTrabForm";
import PTrabPrint from "./pages/PTrabPrint";
import Login from "./pages/Login";
import { SessionContextProvider } from "./components/SessionContextProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import SharePTrab from "./pages/SharePTrab";
import UserProfileConfig from "./pages/config/UserProfileConfig";
import LogisticsDirectiveConfig from "./pages/config/LogisticsDirectiveConfig";
import OperationalCostsConfig from "./pages/config/OperationalCostsConfig";
import VisualizationOptionsConfig from "./pages/config/VisualizationOptionsConfig";
import OmRelationConfig from "./pages/config/OmRelationConfig";
import PTrabExportImport from "./pages/PTrabExportImport";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider>
        <Toaster richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PTrabManager />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ptrab" element={<PTrabManager />} />
            <Route path="/ptrab/form" element={<PTrabForm />} />
            <Route path="/ptrab/print" element={<PTrabPrint />} />
            <Route path="/share-ptrab" element={<SharePTrab />} />
            
            {/* Rotas de Configuração */}
            <Route path="/config/profile" element={<UserProfileConfig />} />
            <Route path="/config/diretrizes" element={<LogisticsDirectiveConfig />} />
            <Route path="/config/custos-operacionais" element={<OperationalCostsConfig />} />
            <Route path="/config/visualizacao" element={<VisualizationOptionsConfig />} />
            <Route path="/config/om" element={<OmRelationConfig />} />
            <Route path="/config/ptrab-export-import" element={<PTrabExportImport />} />
            
          </Routes>
        </BrowserRouter>
      </SessionContextProvider>
    </QueryClientProvider>
  );
};

export default App;