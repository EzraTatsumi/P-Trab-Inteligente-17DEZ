import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PageMetadata from '@/components/PageMetadata';

const PTrabPrint = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  
  // Simulação de carregamento de dados
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    // Simula a busca de dados do PTrab
    if (ptrabId) {
      setLoading(false);
    } else {
      navigate('/ptrab');
    }
  }, [ptrabId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando relatório...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <PageMetadata 
        title={`Relatório P Trab ${ptrabId}`} 
        description="Visualização e exportação do Plano de Trabalho para impressão."
        canonicalPath={`/ptrab/print?ptrabId=${ptrabId}`}
      />
      
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Edição
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <Card className="shadow-lg print:shadow-none print:border-none">
          <CardHeader>
            <CardTitle className="text-2xl">Visualização do Relatório</CardTitle>
            <CardDescription>
              P Trab ID: {ptrabId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-6 border rounded-lg bg-white min-h-[500px] print:border-none">
              <h2 className="text-xl font-bold mb-4 text-center print:text-black">
                [Conteúdo do Relatório de Impressão]
              </h2>
              <p className="text-muted-foreground text-center">
                O conteúdo detalhado do P Trab será renderizado aqui para visualização e impressão.
              </p>
              {/* Aqui será implementada a lógica de renderização do relatório completo */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PTrabPrint;