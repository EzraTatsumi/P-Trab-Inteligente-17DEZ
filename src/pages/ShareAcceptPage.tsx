import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ShareAcceptPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: loadingSession } = useSession();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando link de compartilhamento...');
  const [ptrabId, setPTrabId] = useState<string | null>(null);

  const shareToken = searchParams.get('token');

  useEffect(() => {
    if (loadingSession) return;

    if (!shareToken) {
      setStatus('error');
      setMessage('Token de compartilhamento inválido ou ausente.');
      return;
    }

    if (!user) {
      // Se não estiver logado, redireciona para o login, mantendo o token na URL
      toast.info("Faça login para aceitar o convite de colaboração.");
      navigate(`/login?redirectTo=/ptrab/share?token=${shareToken}`);
      return;
    }

    handleAcceptShare(user.id, shareToken);
  }, [loadingSession, user, shareToken, navigate]);

  const handleAcceptShare = async (userId: string, token: string) => {
    setStatus('loading');
    
    try {
      // 1. Buscar o P Trab pelo share_token
      const { data: ptrab, error: fetchError } = await supabase
        .from('p_trab')
        .select('id, user_id, shared_with, nome_operacao')
        .eq('share_token', token)
        .maybeSingle();

      if (fetchError || !ptrab) {
        throw new Error('Plano de Trabalho não encontrado ou token expirado.');
      }
      
      setPTrabId(ptrab.id);

      if (ptrab.user_id === userId) {
        setStatus('success');
        setMessage(`Você é o proprietário do P Trab "${ptrab.nome_operacao}". Redirecionando...`);
        setTimeout(() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`), 2000);
        return;
      }

      if (ptrab.shared_with.includes(userId)) {
        setStatus('success');
        setMessage(`Você já é colaborador do P Trab "${ptrab.nome_operacao}". Redirecionando...`);
        setTimeout(() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`), 2000);
        return;
      }

      // 2. Adicionar o usuário à lista shared_with
      const newSharedWith = [...ptrab.shared_with, userId];

      const { error: updateError } = await supabase
        .from('p_trab')
        .update({ shared_with: newSharedWith })
        .eq('id', ptrab.id);

      if (updateError) throw updateError;

      setStatus('success');
      setMessage(`Você agora é colaborador do P Trab "${ptrab.nome_operacao}"! Redirecionando...`);
      toast.success(`Colaboração aceita para o P Trab: ${ptrab.nome_operacao}`);
      setTimeout(() => navigate(`/ptrab/form?ptrabId=${ptrab.id}`), 2000);

    } catch (error: any) {
      console.error("Erro ao aceitar compartilhamento:", error);
      setStatus('error');
      setMessage(error.message || 'Ocorreu um erro ao processar o compartilhamento.');
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">{message}</p>
          </div>
        );
      case 'success':
        return (
          <div className="flex flex-col items-center space-y-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-lg font-semibold text-foreground text-center">{message}</p>
            <Button onClick={() => navigate(ptrabId ? `/ptrab/form?ptrabId=${ptrabId}` : '/ptrab')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ir para o P Trab
            </Button>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center space-y-4">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-lg font-semibold text-destructive text-center">{message}</p>
            <Button onClick={() => navigate('/ptrab')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Meus P Trabs
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Aceitar Colaboração</CardTitle>
          <CardDescription>Processando convite de Plano de Trabalho.</CardDescription>
        </CardHeader>
        <CardContent className="py-8">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShareAcceptPage;