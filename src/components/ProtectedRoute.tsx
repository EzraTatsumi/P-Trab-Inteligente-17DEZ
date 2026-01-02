import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContextProvider';
import { Loader2 } from 'lucide-react';

/**
 * Componente de Rota Protegida.
 * Verifica se o usuário está autenticado. Se sim, renderiza o Outlet (rota filha).
 * Se não, redireciona para a página de login.
 */
const ProtectedRoute: React.FC = () => {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se o usuário não estiver logado, redireciona para a página de login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se estiver logado, renderiza a rota filha
  return <Outlet />;
};

export default ProtectedRoute;