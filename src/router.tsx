import { createBrowserRouter, RouteObject, Navigate } from "react-router-dom";
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
import SharePage from "./pages/SharePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
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
import DOREditor from "./pages/DOREditor";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

// Define as rotas como um array de objetos
const routes: RouteObject[] = [
  { path: "/", element: <Index /> },
  { path: "/login", element: <Login /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/ptrab", element: <ProtectedRoute><PTrabManager /></ProtectedRoute> },
  { path: "/ptrab/form", element: <ProtectedRoute><PTrabForm /></ProtectedRoute> },
  { path: "/ptrab/print", element: <ProtectedRoute><PTrabReportManager /></ProtectedRoute> },
  { path: "/ptrab/dor", element: <ProtectedRoute><DOREditor /></ProtectedRoute> },
  { path: "/ptrab/classe-i", element: <ProtectedRoute><ClasseIForm /></ProtectedRoute> },
  { path: "/ptrab/classe-ii", element: <ProtectedRoute><ClasseIIForm /></ProtectedRoute> },
  { path: "/ptrab/classe-v", element: <ProtectedRoute><ClasseVForm /></ProtectedRoute> },
  { path: "/ptrab/classe-vi", element: <ProtectedRoute><ClasseVIForm /></ProtectedRoute> },
  { path: "/ptrab/classe-vii", element: <ProtectedRoute><ClasseVIIForm /></ProtectedRoute> },
  { path: "/ptrab/classe-viii", element: <ProtectedRoute><ClasseVIIIForm /></ProtectedRoute> },
  { path: "/ptrab/classe-ix", element: <ProtectedRoute><ClasseIXForm /></ProtectedRoute> },
  { path: "/ptrab/classe-iii", element: <ProtectedRoute><ClasseIIIForm /></ProtectedRoute> },
  { path: "/ptrab/diaria", element: <ProtectedRoute><DiariaForm /></ProtectedRoute> },
  { path: "/ptrab/verba-operacional", element: <ProtectedRoute><VerbaOperacionalForm /></ProtectedRoute> },
  { path: "/ptrab/suprimento-fundos", element: <ProtectedRoute><SuprimentoFundosForm /></ProtectedRoute> },
  { path: "/ptrab/passagem-aerea", element: <ProtectedRoute><PassagemForm /></ProtectedRoute> },
  { path: "/ptrab/horas-voo-avex", element: <ProtectedRoute><HorasVooForm /></ProtectedRoute> },
  { path: "/ptrab/concessionaria", element: <ProtectedRoute><ConcessionariaForm /></ProtectedRoute> },
  { path: "/ptrab/material-consumo", element: <ProtectedRoute><MaterialConsumoForm /></ProtectedRoute> },
  { path: "/ptrab/material-permanente", element: <ProtectedRoute><MaterialPermanenteForm /></ProtectedRoute> },
  { path: "/ptrab/complemento-alimentacao", element: <ProtectedRoute><ComplementoAlimentacaoForm /></ProtectedRoute> },
  { path: "/ptrab/servicos-terceiros", element: <ProtectedRoute><ServicosTerceirosForm /></ProtectedRoute> },
  { path: "/config/custos-operacionais", element: <ProtectedRoute><CustosOperacionaisPage /></ProtectedRoute> },
  { path: "/config/diretrizes", element: <ProtectedRoute><DiretrizesCusteioPage /></ProtectedRoute> },
  { path: "/config/visualizacao", element: <ProtectedRoute><VisualizacaoConfigPage /></ProtectedRoute> },
  { path: "/config/om", element: <ProtectedRoute><OmConfigPage /></ProtectedRoute> },
  { path: "/config/om/bulk-upload", element: <ProtectedRoute><OmBulkUploadPage /></ProtectedRoute> },
  { path: "/config/ptrab-export-import", element: <ProtectedRoute><PTrabExportImportPage /></ProtectedRoute> },
  { path: "/config/profile", element: <ProtectedRoute><UserProfilePage /></ProtectedRoute> },
  { path: "/share-ptrab", element: <SharePage /> },
  { path: "*", element: <NotFound /> },
];

// Cria o roteador e ativa todas as future flags para compatibilidade com v7
export const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
  },
} as any);