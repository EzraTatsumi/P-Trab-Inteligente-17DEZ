import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SessionContextProvider, useSession } from "./components/SessionContextProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PTrabPage from "./pages/PTrabPage";
import PTrabDetailsPage from "./pages/PTrabDetailsPage";
import DiretrizesCusteioPage from "./pages/DiretrizesCusteioPage";
import OrganizacoesMilitaresPage from "./pages/OrganizacoesMilitaresPage";
import DiretrizesOperacionaisPage from "./pages/DiretrizesOperacionaisPage";
import CustosOperacionaisPage from "./pages/CustosOperacionaisPage"; // Importando a nova página

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute element={Layout} />}>
        <Route index element={<Index />} />
        <Route path="ptrab" element={<PTrabPage />} />
        <Route path="ptrab/:id" element={<PTrabDetailsPage />} />
        <Route path="diretrizes-custeio" element={<DiretrizesCusteioPage />} />
        <Route path="diretrizes-operacionais" element={<DiretrizesOperacionaisPage />} />
        <Route path="organizacoes-militares" element={<OrganizacoesMilitaresPage />} />
        <Route path="custos-operacionais" element={<CustosOperacionaisPage />} /> {/* NOVA ROTA */}
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <SessionContextProvider>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster />
      </SessionContextProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;