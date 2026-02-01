import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PTrabManagement = () => {
    const navigate = useNavigate();
    
    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">Gerenciamento de Planos de Trabalho (P Trab)</h1>
                <p className="text-muted-foreground">Esta é uma página placeholder. Navegue para o formulário de P Trab para continuar.</p>
                <Button onClick={() => navigate('/')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o Início
                </Button>
            </div>
        </div>
    );
};

export default PTrabManagement;