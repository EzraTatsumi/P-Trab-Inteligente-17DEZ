import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { sanitizeError } from '@/lib/errorUtils';

interface PTrabShareData {
    id: string;
    numero_ptrab: string;
    nome_operacao: string;
    user_id: string;
    shared_with: string[];
}

const PTrabSharePage = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, loading: loadingSession } = useSession();
    const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
    const [ptrabDetails, setPTrabDetails] = useState<PTrabShareData | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (loadingSession || !token) return;

        if (!user) {
            // Se não estiver logado, redireciona para o login, mas mantém o token na URL
            toast.info("Faça login para acessar o P Trab compartilhado.");
            navigate(`/login?redirectTo=/ptrab/share/${token}`);
            return;
        }

        handleShareAccess(token, user.id);
    }, [loadingSession, token, user, navigate]);

    const handleShareAccess = async (token: string, userId: string) => {
        try {
            // 1. Invoca a Edge Function para validar o token e obter dados básicos do P Trab
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('share-ptrab', {
                body: { token },
            });

            if (edgeError) throw edgeError;
            
            const ptrab = edgeData as PTrabShareData;
            setPTrabDetails(ptrab);

            if (!ptrab || !ptrab.id) {
                throw new Error("P Trab não encontrado ou token inválido.");
            }
            
            // 2. Verifica se o usuário já é o proprietário ou colaborador
            const isOwner = ptrab.user_id === userId;
            const isCollaborator = ptrab.shared_with.includes(userId);

            if (isOwner || isCollaborator) {
                setStatus('success');
                toast.success(`Acesso concedido ao P Trab: ${ptrab.numero_ptrab}`);
                navigate(`/ptrab/form?ptrabId=${ptrab.id}`);
                return;
            }

            // 3. Se for um novo colaborador, adiciona o ID à lista shared_with
            const newSharedWith = [...ptrab.shared_with, userId];
            
            const { error: updateError } = await supabase
                .from('p_trab')
                .update({ shared_with: newSharedWith })
                .eq('id', ptrab.id);

            if (updateError) {
                // Se falhar ao atualizar, ainda permite o acesso, mas loga o erro
                console.error("Falha ao adicionar usuário à lista de colaboradores:", updateError);
            }
            
            setStatus('success');
            toast.success(`Você agora é um colaborador do P Trab: ${ptrab.numero_ptrab}!`);
            navigate(`/ptrab/form?ptrabId=${ptrab.id}`);

        } catch (error) {
            console.error("Erro no acesso compartilhado:", error);
            setErrorMsg(sanitizeError(error));
            setStatus('error');
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-lg text-muted-foreground">Verificando acesso ao Plano de Trabalho...</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Acesso Negado</AlertTitle>
                    <AlertDescription>
                        Não foi possível acessar o Plano de Trabalho. O link pode estar inválido ou expirado.
                        <p className="mt-2 font-medium">{errorMsg}</p>
                    </AlertDescription>
                    <Button onClick={() => navigate('/ptrab')} className="mt-4">
                        Voltar para Meus P Trabs
                    </Button>
                </Alert>
            </div>
        );
    }

    // Se status for 'success', o redirecionamento já ocorreu no handleShareAccess
    return null;
};

export default PTrabSharePage;