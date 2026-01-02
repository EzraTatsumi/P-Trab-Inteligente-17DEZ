import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = () => {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não houver sessão, redireciona para a página de login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se houver sessão, renderiza as rotas filhas
  return <Outlet />;
};

export default ProtectedRoute;