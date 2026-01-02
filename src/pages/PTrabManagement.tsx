import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PTrabManagementPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Planos de Trabalho</h1>
          <Button onClick={() => navigate('/ptrab/form')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo P Trab
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Lista de P Trabs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">A lista de Planos de Trabalho será exibida aqui.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PTrabManagementPage;