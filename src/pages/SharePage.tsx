import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { toast } from 'sonner';
import { Loader2, Link, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const SharePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: loadingSession } = useSession();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [ptrabName, setPtrabName] = useState<string>('');

  const ptrabId = searchParams.get('ptrabId');
  const token = searchParams.get('token');

  useEffect(() => {
    if (loadingSession || status !== 'loading') return;

    const handleRequestShare = async () => {
      if (!ptrabId || !token) {
        toast.error("Link de compartilhamento inválido.");
        setStatus('error');
        return;
      }
      
      if (!user) {
        // Se não estiver logado, redireciona para o login
        toast.info("Faça login para solicitar acesso ao P Trab compartilhado.");
        setStatus('redirecting');
        navigate(`/login?redirectTo=/share?ptrabId=${ptrabId}&token=${token}`);
        return;
      }
      
      // 1. Buscar nome do PTrab para feedback
      const { data: ptrabData, error: fetchError } = await supabase
        .from('p_trab')
        .select('numero_ptrab, nome_operacao')
        .eq('id', ptrabId)
        .maybeSingle();
        
      if (fetchError || !ptrabData) {
          toast.error("P Trab não encontrado ou link expirado.");
          setStatus('error');
          return;
      }
      
      setPtrabName(`${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}`);

      // 2. Chamar a função RPC para solicitar acesso
      const { data: success, error: rpcError } = await supabase.rpc('request_ptrab_share', {
        p_ptrab_id: ptrabId,
        p_share_token: token,
        p_user_id: user.id,
      });

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        toast.error("Falha ao solicitar acesso. Verifique o link.");
        setStatus('error');
        return;
      }
      
      if (success === false) {
          toast.error("Token de compartilhamento inválido ou P Trab não encontrado.");
          setStatus('error');
          return;
      }

      setStatus('success');
      toast.success("Solicitação de acesso enviada! Aguarde a aprovação do proprietário.");
    };

    handleRequestShare();
  }, [loadingSession, user, ptrabId, token, navigate, status]);

  // Renderização de feedback visual enquanto processa
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <Link className="h-6 w-6 text-primary" />
            Compartilhamento de P Trab
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-muted-foreground">Processando solicitação...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="h-10 w-10 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-foreground">Solicitação Enviada!</h3>
              <p className="text-sm text-muted-foreground">
                Você solicitou acesso ao P Trab: <span className="font-medium text-foreground">{ptrabName}</span>.
              </p>
              <p className="text-sm text-destructive mt-2 flex items-center justify-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Aguarde a aprovação do proprietário para que ele apareça na sua lista.
              </p>
              <Button onClick={() => navigate('/ptrab')} className="mt-4">
                Voltar para Gerenciamento
              </Button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
              <h3 className="text-lg font-semibold text-foreground">Erro na Solicitação</h3>
              <p className="text-sm text-muted-foreground">
                Não foi possível processar o link. Verifique se o link está correto ou se o P Trab ainda existe.
              </p>
              <Button onClick={() => navigate('/ptrab')} className="mt-4" variant="outline">
                Voltar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SharePage;