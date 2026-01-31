import { createBrowserRouter, RouteObject } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

// Define as rotas como um array de objetos
const routes: RouteObject[] = [
  { path: "/", element: <Index /> },
  { path: "/login", element: <Login /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/ptrab", element: <PTrabManager /> },
  { path: "/ptrab/form", element: <PTrabForm /> },
  { path: "/ptrab/print", element: <PTrabReportManager /> },
  { path: "/ptrab/classe-i", element: <ClasseIForm /> },
  { path: "/ptrab/classe-ii", element: <ClasseIIForm /> },
  { path: "/ptrab/classe-v", element: <ClasseVForm /> },
  { path: "/ptrab/classe-vi", element: <ClasseVIForm /> },
  { path: "/ptrab/classe-vii", element: <ClasseVIIForm /> },
  { path: "/ptrab/classe-viii", element: <ClasseVIIIForm /> },
  { path: "/ptrab/classe-ix", element: <ClasseIXForm /> },
  { path: "/ptrab/classe-iii", element: <ClasseIIIForm /> },
  { path: "/ptrab/diaria", element: <DiariaForm /> },
  { path: "/ptrab/verba-operacional", element: <VerbaOperacionalForm /> },
  { path: "/ptrab/suprimento-fundos", element: <SuprimentoFundosForm /> },
  { path: "/ptrab/passagem-aerea", element: <PassagemForm /> },
  { path: "/config/custos-operacionais", element: <CustosOperacionaisPage /> },
  { path: "/config/diretrizes", element: <DiretrizesCusteioPage /> },
  { path: "/config/visualizacao", element: <VisualizacaoConfigPage /> },
  { path: "/config/om", element: <OmConfigPage /> },
  { path: "/config/om/bulk-upload", element: <OmBulkUploadPage /> },
  { path: "/config/ptrab-export-import", element: <PTrabExportImportPage /> },
  { path: "/config/profile", element: <UserProfilePage /> },
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
});