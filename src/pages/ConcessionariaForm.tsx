import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Droplet, Zap } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ConcessionariaFormPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    
    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Droplet className="h-5 w-5 text-blue-500" />
                            <Zap className="h-5 w-5 text-yellow-600" />
                            Pagamento de Concessionárias
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">
                            O formulário para adicionar registros de Concessionária (Água/Esgoto e Energia Elétrica) será implementado aqui.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ConcessionariaFormPage;