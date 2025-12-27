import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Link, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SharePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: loadingSession } = useSession();
  const [status, setStatus] = useState<'loading' | 'processing' | 'error' | 'success'>('loading');

  const ptrabId = searchParams.get('ptrabId');
  const token = searchParams.get('token');

  useEffect(() => {
    // 1. Esperar a sessão carregar
    if (loadingSession) return;

    // 2. Redirecionar se não houver token ou ID
    if (!ptrabId || !token) {
      toast.error("Link de compartilhamento inválido.");
      navigate('/ptrab');
      return;
    }

    // 3. Forçar autenticação se o usuário não estiver logado
    if (!user) {
      // Redireciona para login, mantendo os parâmetros de compartilhamento na URL
      // O SessionContextProvider irá redirecionar para /ptrab após o login,
      // mas precisamos garantir que o usuário volte para esta página para processar o token.
      // No entanto, o fluxo padrão do SessionContextProvider é ir para /ptrab.
      // Para simplificar, vamos apenas redirecionar para login e esperar que o usuário
      // clique no link novamente após o login.
      toast.info("Faça login para acessar o P Trab compartilhado.");
      navigate('/login');
      return;
    }

    // 4. Processar o compartilhamento
    const processShare = async () => {
      setStatus('processing');
      
      try {
        // Chama a função RPC (Remote Procedure Call) no Supabase
        const { data: success, error } = await supabase.rpc('add_user_to_shared_with', {
          p_ptrab_id: ptrabId,
          p_share_token: token,
          p_user_id: user.id,
        });

        if (error) {
          console.error("Erro ao processar compartilhamento:", error);
          throw new Error("Falha na validação do token ou no acesso ao banco de dados.");
        }
        
        if (success === false) {
            // A função SQL retornou FALSE, indicando token inválido
            throw new Error("Token de compartilhamento inválido ou expirado.");
        }

        // Sucesso (TRUE significa que o usuário foi adicionado ou já tinha acesso)
        setStatus('success');
        toast.success("Acesso concedido! Você agora pode editar este Plano de Trabalho.");
        
        // Redireciona para a página de edição do P Trab
        navigate(`/ptrab/form?ptrabId=${ptrabId}`);

      } catch (e: any) {
        setStatus('error');
        const errorMessage = e.message || "Erro desconhecido ao processar o link.";
        toast.error(errorMessage);
        console.error("Erro de compartilhamento:", e);
        
        // Redireciona para a lista de P Trabs após o erro
        navigate('/ptrab');
      }
    };

    processShare();
  }, [loadingSession, user, ptrabId, token, navigate]);

  // Renderização de feedback visual enquanto processa
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'loading' || status === 'processing' ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : status === 'error' ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <Link className="h-6 w-6 text-primary" />
            )}
            {status === 'loading' && 'Verificando Autenticação...'}
            {status === 'processing' && 'Processando Acesso Colaborativo...'}
            {status === 'error' && 'Erro de Acesso'}
            {status === 'success' && 'Acesso Confirmado'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {status === 'loading' && 'Aguarde enquanto verificamos sua sessão.'}
            {status === 'processing' && 'Validando o token de compartilhamento e atualizando suas permissões.'}
            {status === 'error' && 'Ocorreu um erro. Você será redirecionado em breve.'}
            {status === 'success' && 'Redirecionando para o Plano de Trabalho...'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharePage;