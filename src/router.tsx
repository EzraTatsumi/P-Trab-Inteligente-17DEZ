import { createBrowserRouter, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import PTrabList from "./pages/PTrabList";
import PTrabForm from "./pages/PTrabForm";
import ClasseI from "./pages/ClasseI";
import ClasseII from "./pages/ClasseII";
import ClasseIII from "./pages/ClasseIII";
import ClasseV from "./pages/ClasseV";
import ClasseVI from "./pages/ClasseVI";
import ClasseVII from "./pages/ClasseVII";
import ClasseVIII from "./pages/ClasseVIII";
import ClasseIX from "./pages/ClasseIX";
import Diaria from "./pages/Diaria";
import VerbaOperacional from "./pages/VerbaOperacional";
import SuprimentoFundos from "./pages/SuprimentoFundos";
import PassagemAerea from "./pages/PassagemAerea";
import HorasVooAvEx from "./pages/HorasVooAvEx";
import Concessionaria from "./pages/Concessionaria";
import MaterialConsumo from "./pages/MaterialConsumo";
import MaterialPermanente from "./pages/MaterialPermanente";
import ComplementoAlimentacao from "./pages/ComplementoAlimentacao";
import ServicosTerceiros from "./pages/ServicosTerceiros";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/ptrab",
    element: <ProtectedRoute><PTrabList /></ProtectedRoute>,
  },
  {
    path: "/ptrab/form",
    element: <ProtectedRoute><PTrabForm /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-i",
    element: <ProtectedRoute><ClasseI /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-ii",
    element: <ProtectedRoute><ClasseII /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-iii",
    element: <ProtectedRoute><ClasseIII /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-v",
    element: <ProtectedRoute><ClasseV /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-vi",
    element: <ProtectedRoute><ClasseVI /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-vii",
    element: <ProtectedRoute><ClasseVII /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-viii",
    element: <ProtectedRoute><ClasseVIII /></ProtectedRoute>,
  },
  {
    path: "/ptrab/classe-ix",
    element: <ProtectedRoute><ClasseIX /></ProtectedRoute>,
  },
  {
    path: "/ptrab/diaria",
    element: <ProtectedRoute><Diaria /></ProtectedRoute>,
  },
  {
    path: "/ptrab/verba-operacional",
    element: <ProtectedRoute><VerbaOperacional /></ProtectedRoute>,
  },
  {
    path: "/ptrab/suprimento-fundos",
    element: <ProtectedRoute><SuprimentoFundos /></ProtectedRoute>,
  },
  {
    path: "/ptrab/passagem-aerea",
    element: <ProtectedRoute><PassagemAerea /></ProtectedRoute>,
  },
  {
    path: "/ptrab/horas-voo-avex",
    element: <ProtectedRoute><HorasVooAvEx /></ProtectedRoute>,
  },
  {
    path: "/ptrab/concessionaria",
    element: <ProtectedRoute><Concessionaria /></ProtectedRoute>,
  },
  {
    path: "/ptrab/material-consumo",
    element: <ProtectedRoute><MaterialConsumo /></ProtectedRoute>,
  },
  {
    path: "/ptrab/material-permanente",
    element: <ProtectedRoute><MaterialPermanente /></ProtectedRoute>,
  },
  {
    path: "/ptrab/complemento-alimentacao",
    element: <ProtectedRoute><ComplementoAlimentacao /></ProtectedRoute>,
  },
  {
    path: "/ptrab/servicos-terceiros",
    element: <ProtectedRoute><ServicosTerceiros /></ProtectedRoute>,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);