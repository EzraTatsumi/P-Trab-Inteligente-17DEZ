import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustosEquipamentosClasseIII = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Diretrizes de Equipamentos Classe III</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">A configuração dos equipamentos de Classe III será implementada aqui.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustosEquipamentosClasseIII;