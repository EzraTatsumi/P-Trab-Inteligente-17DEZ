import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PTrabListPage = () => {
    const navigate = useNavigate();
    
    const handleNewPTrab = () => {
        // Placeholder for navigation to PTrab creation form
        navigate('/ptrab/form');
    };
    
    return (
        <div className="container max-w-7xl mx-auto p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Gerenciamento de Planos de Trabalho (P Trab)</h2>
                <Button onClick={handleNewPTrab}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo P Trab
                </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Lista de P Trab</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        A lista de Planos de Trabalho será exibida aqui.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default PTrabListPage;