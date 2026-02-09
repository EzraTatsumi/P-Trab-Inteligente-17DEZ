import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Share2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSession } from '@/components/SessionContextProvider';
import { fetchSharePreview } from '@/integrations/supabase/api';
import { useQuery } from '@tanstack/react-query';
import PageMetadata from '@/components/PageMetadata';

const SharePTrab = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const token = searchParams.get('token');
    const { user, isLoading: isLoadingSession } = useSession();
    
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'success'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);

    // Busca a pré-visualização do PTrab e do proprietário
    const { data: previewData, isLoading: isLoadingPreview, error: previewError } = useQuery({
        queryKey: ['sharePreview', ptrabId, token],
        queryFn: () => fetchSharePreview(ptrabId!, token!),
        enabled: !!ptrabId && !!token && status === 'loading' && !isLoadingSession,
        retry: false,
    });

    useEffect(() => {
        if (isLoadingSession || isLoadingPreview) {
            setStatus('loading');
            return;
        }

        if (previewError) {
            setStatus('error');
            setErrorMessage(previewError.message || "Link inválido ou expirado.");
            return;
        }

        if (previewData) {
            if (!user) {
                setStatus('ready'); // Pronto para login/solicitação
            } else {
                // Se o usuário estiver logado, verifica se ele já tem acesso
                checkExistingAccess();
            }
        }
    }, [isLoadingSession, isLoadingPreview, previewData, previewError, user]);
    
    const checkExistingAccess = async () => {
        if (!user || !ptrabId) return;
        
        // Verifica se o usuário é o dono ou já está na lista de compartilhamento
        const { data, error } = await supabase
            .rpc('is_ptrab_owner_or_shared', { ptrab_id_in: ptrabId });
            
        if (error) {
            console.error("Erro ao verificar acesso:", error);
            // Continua como 'ready' para permitir a solicitação, caso a RPC falhe
            setStatus('ready');
            return;
        }
        
        if (data === true) {
            setStatus('success');
            toast.success("Você já tem acesso a este P Trab!");
        } else {
            setStatus('ready');
        }
    };

    const handleLogin = () => {
        // Redireciona para o login, mantendo os parâmetros de compartilhamento
        navigate(`/login?redirectTo=/share-ptrab?ptrabId=${ptrabId}&token=${token}`);
    };

    const handleRequestAccess = async () => {
        if (!user || !ptrabId || !token) return;
        
        setIsRequesting(true);
        
        try {
            // Chama a função RPC para registrar a solicitação de compartilhamento
            const { data, error } = await supabase.rpc('request_ptrab_share', {
                p_ptrab_id: ptrabId,
                p_share_token: token,
                p_user_id: user.id,
            });
            
            if (error) throw error;
            
            if (data === false) {
                throw new Error("P Trab não encontrado ou token inválido.");
            }
            
            toast.success("Solicitação Enviada!", {
                description: `Sua solicitação de acesso ao P Trab '${previewData?.ptrabName}' foi enviada ao proprietário.`,
                duration: 8000,
            });
            
            setStatus('success'); // Muda para sucesso após o envio da solicitação
            
        } catch (error) {
            console.error("Erro ao solicitar acesso:", error);
            toast.error("Falha ao enviar solicitação de acesso.");
            setErrorMessage("Falha ao enviar solicitação de acesso. Tente novamente mais tarde.");
            setStatus('error');
        } finally {
            setIsRequesting(false);
        }
    };
    
    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground mt-4">Verificando link de compartilhamento...</p>
                    </div>
                );
            case 'error':
                return (
                    <div className="text-center py-12">
                        <XCircle className="h-12 w-12 text-destructive mx-auto" />
                        <h2 className="text-xl font-bold mt-4 text-destructive">Erro de Acesso</h2>
                        <p className="text-muted-foreground mt-2">{errorMessage}</p>
                        <Button onClick={() => navigate('/ptrab')} className="mt-6" variant="outline">
                            Voltar para o Gerenciador
                        </Button>
                    </div>
                );
            case 'success':
                return (
                    <div className="text-center py-12">
                        <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                        <h2 className="text-xl font-bold mt-4 text-green-600">Acesso Confirmado!</h2>
                        <p className="text-muted-foreground mt-2">
                            Você já tem acesso a este Plano de Trabalho.
                        </p>
                        <Button onClick={() => navigate('/ptrab')} className="mt-6">
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Ir para P Trabs
                        </Button>
                    </div>
                );
            case 'ready':
                if (!previewData) return null; // Deve ter previewData se o status for 'ready'
                
                const isUserLoggedIn = !!user;
                
                return (
                    <div className="py-6">
                        <div className="text-center mb-6">
                            <Share2 className="h-10 w-10 text-primary mx-auto mb-3" />
                            <h2 className="text-2xl font-bold">Compartilhamento de P Trab</h2>
                            <p className="text-muted-foreground mt-2">
                                Você foi convidado a acessar o seguinte Plano de Trabalho:
                            </p>
                        </div>
                        
                        <Card className="border-primary/50 bg-primary/5 mb-6">
                            <CardContent className="p-4">
                                <p className="text-lg font-semibold text-foreground">{previewData.ptrabName}</p>
                                <p className="text-sm text-muted-foreground">Proprietário: {previewData.ownerName}</p>
                            </CardContent>
                        </Card>

                        {isUserLoggedIn ? (
                            <>
                                <p className="text-center text-sm text-muted-foreground mb-4">
                                    Clique abaixo para solicitar acesso ao proprietário.
                                </p>
                                <Button 
                                    onClick={handleRequestAccess} 
                                    disabled={isRequesting}
                                    className="w-full"
                                >
                                    {isRequesting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Solicitar Acesso
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-center text-sm text-muted-foreground mb-4">
                                    Você precisa estar logado para solicitar acesso.
                                </p>
                                <Button onClick={handleLogin} className="w-full">
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Fazer Login
                                </Button>
                            </>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <PageMetadata 
                title="Acesso Compartilhado" 
                description="Solicite acesso a um Plano de Trabalho compartilhado."
                canonicalPath="/share-ptrab"
            />
            <Card className="w-full max-w-md">
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
};

export default SharePTrab;