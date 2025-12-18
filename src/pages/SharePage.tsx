import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { toast } from 'sonner';
import { Loader2, Link, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SharePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: loadingSession } = useSession();
  const [status, setStatus] = useState<'loading' | 'redirecting'>('loading');

  const ptrabId = searchParams.get('ptrabId');
  const token = searchParams.get('token');

  useEffect(() => {
    if (loadingSession) return;

    if (ptrabId && token) {
        // Se o usuário chegou aqui com um link, instrua-o a usar a nova funcionalidade
        toast.info("Para aceitar o P Trab compartilhado, copie o link completo e use a opção 'Receber P Trab Compartilhado' no menu de configurações.");
    } else {
        toast.warning("Link de compartilhamento inválido. Redirecionando.");
    }
    
    setStatus('redirecting');
    // Redireciona para a lista de P Trabs
    const timer = setTimeout(() => {
        navigate('/ptrab');
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [loadingSession, user, ptrabId, token, navigate]);

  // Renderização de feedback visual enquanto processa
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Link className="h-6 w-6 text-primary" />
            Link de Compartilhamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {status === 'loading' && 'Verificando link...'}
            {status === 'redirecting' && 'Redirecionando para o Gerenciador de P Trabs.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharePage;