import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Package, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { defaultClasseIIConfig } from "@/data/classeIIData";

// Placeholder for the actual form logic
const ClasseIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(true);
  const [ptrabNome, setPtrabNome] = useState<string>("");

  useEffect(() => {
    if (!ptrabId) {
      toast.error("Nenhum P Trab selecionado");
      navigate("/ptrab");
      return;
    }
    loadPTrab(ptrabId);
  }, [ptrabId, navigate]);

  const loadPTrab = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("numero_ptrab, nome_operacao")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPtrabNome(`${data.numero_ptrab} - ${data.nome_operacao}`);
    } catch (error: any) {
      toast.error("Erro ao carregar P Trab");
      navigate("/ptrab");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Classe II - Material de Intendência
            </CardTitle>
            <CardDescription>
              Gerencie os itens de Classe II para o P Trab: {ptrabNome}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Funcionalidade em desenvolvimento. Usando dados padrão de diretriz.
              </AlertDescription>
            </Alert>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">Itens Padrão (Diretriz)</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Valor Mnt/Dia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaultClasseIIConfig.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.categoria}</TableCell>
                    <TableCell>{item.item}</TableCell>
                    <TableCell className="text-right">{item.valor_mnt_dia.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClasseIIForm;