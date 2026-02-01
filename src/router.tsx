import { createBrowserRouter, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/Login";
import PTrabListPage from "@/pages/PTrabList";
import PTrabFormPage from "@/pages/PTrabForm";
import PassagemFormPage from "@/pages/PassagemForm";
import ConcessionariaFormPage from "@/pages/ConcessionariaForm";
import CustosOperacionaisPage from "@/pages/CustosOperacionaisPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute element={<Layout />} />,
    children: [
      {
        index: true,
        element: <Navigate to="/ptrab" replace />,
      },
      {
        path: "/ptrab",
        element: <PTrabListPage />,
      },
      {
        path: "/ptrab/form",
        element: <PTrabFormPage />,
      },
      {
        path: "/ptrab/passagem-aerea",
        element: <PassagemFormPage />,
      },
      {
        path: "/ptrab/concessionaria", // NEW ROUTE
        element: <ConcessionariaFormPage />,
      },
      {
        path: "/config/custos-operacionais",
        element: <CustosOperacionaisPage />,
      },
      // Placeholder routes for other classes/items mentioned in PTrabForm.tsx
      { path: "/ptrab/classe-i", element: <div>Classe I Form Placeholder</div> },
      { path: "/ptrab/classe-ii", element: <div>Classe II Form Placeholder</div> },
      { path: "/ptrab/classe-iii", element: <div>Classe III Form Placeholder</div> },
      { path: "/ptrab/classe-v", element: <div>Classe V Form Placeholder</div> },
      { path: "/ptrab/classe-vi", element: <div>Classe VI Form Placeholder</div> },
      { path: "/ptrab/classe-vii", element: <div>Classe VII Form Placeholder</div> },
      { path: "/ptrab/classe-viii", element: <div>Classe VIII Form Placeholder</div> },
      { path: "/ptrab/classe-ix", element: <div>Classe IX Form Placeholder</div> },
      { path: "/ptrab/diaria", element: <div>Diária Form Placeholder</div> },
      { path: "/ptrab/verba-operacional", element: <div>Verba Operacional Form Placeholder</div> },
      { path: "/ptrab/suprimento-fundos", element: <div>Suprimento de Fundos Form Placeholder</div> },
    ],
  },
]);