import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PTrabPrintContent } from "@/components/PTrabPrintContent";
import { sanitizeError } from "@/lib/errorUtils";

type PTrabData = Tables<'p_trab'> & {
  // Sobrescreve a tipagem para garantir que campos que podem ser nulos no DB sejam tratados como tal
  acoes: string;
  codug_om: string;
  codug_rm_vinculacao: string;
  comentario: string | null;
  data_fim: string;
  data_inicio: string;
  nome_om_extenso: string | undefined; // Pode ser undefined se não for carregado
  nome_operacao: string;
  numero_ptrab: string;
  organizacao: string;
  rm_vinculacao: string;
  status: 'aberto' | 'em_andamento' | 'concluido';
  tipo_operacao: string;
  valor_total: number;
  efetivo_empregado: number;
};

type ClasseIRegistro = Tables<'classe_i_registros'>;
type ClasseIIIRegistro = Tables<'classe_iii_registros'>;

// Usando Tables<'classe_ii_registros'> para tipar o registro do DB
type ClasseIIRegistroDB = Tables<'classe_ii_registros'>;

interface ClasseIIRegistro extends ClasseIIRegistroDB {
    // Adicionar campos que podem ser nulos no DB mas são úteis aqui
    detalhamento_customizado: string | null;
}

export default function PTrabPrint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [loading, setLoading] = useState(true);
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadData(ptrabId);
  }, [ptrabId]);

  const loadData = async (id: string) => {
    setLoading(true);
    try {
      // 1. P Trab Data
      const { data: ptrab, error: ptrabError } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", id)
        .single();

      if (ptrabError) throw ptrabError;
      
      // 2. Registros Classe I
      const { data: classeIData, error: errorI } = await supabase
        .from('classe_i_registros')
        .select('*')
        .eq('p_trab_id', id)
        .order('organizacao', { ascending: true });
      if (errorI) throw errorI;

      // 3. Registros Classe II
      // Usando 'as any' para contornar o erro de sobrecarga do Supabase Client
      const { data: classeIIData, error: errorII } = await supabase
        .from('classe_ii_registros' as any)
        .select('*, detalhamento_customizado')
        .eq('p_trab_id', id)
        .order('organizacao', { ascending: true });
      if (errorII) throw errorII;

      // 4. Registros Classe III
      const { data: classeIIIData, error: errorIII } = await supabase
        .from('classe_iii_registros')
        .select('*')
        .eq('p_trab_id', id)
        .order('organizacao', { ascending: true });
      if (errorIII) throw errorIII;

      // Atualiza estados
      setPtrabData(ptrab as PTrabData);
      setRegistrosClasseI(classeIData || []);
      setRegistrosClasseII((classeIIData || []) as ClasseIIRegistro[]);
      setRegistrosClasseIII(classeIIIData || []);

    } catch (error: any) {
      toast.error("Erro ao carregar dados para impressão: " + sanitizeError(error));
      navigate("/ptrab");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const totalClasseI = registrosClasseI.reduce((sum, r) => sum + (r.total_qs || 0) + (r.total_qr || 0), 0);
  const totalClasseII_ND30 = registrosClasseII.reduce((sum, r) => sum + (r.valor_nd_30 || 0), 0);
  const totalClasseII_ND39 = registrosClasseII.reduce((sum, r) => sum + (r.valor_nd_39 || 0), 0);
  const totalClasseII = totalClasseII_ND30 + totalClasseII_ND39;
  const totalClasseIII = registrosClasseIII.reduce((sum, r) => sum + (r.valor_total || 0), 0);
  const totalGeral = totalClasseI + totalClasseII + totalClasseIII;

  if (loading || !ptrabData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto print:hidden">
        <div className="flex justify-between items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Edição
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / Gerar PDF
          </Button>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização de Impressão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Classe I</p>
                <p className="font-bold text-lg text-green-600">{formatCurrency(totalClasseI)}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Classe II</p>
                <p className="font-bold text-lg text-blue-600">{formatCurrency(totalClasseII)}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Classe III</p>
                <p className="font-bold text-lg text-amber-600">{formatCurrency(totalClasseIII)}</p>
              </div>
              <div className="col-span-3 p-3 border-2 border-primary/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Geral</p>
                <p className="font-extrabold text-2xl text-primary">{formatCurrency(totalGeral)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo de Impressão */}
      <div className="max-w-4xl mx-auto print:block">
        <PTrabPrintContent
          ptrabData={ptrabData}
          registrosClasseI={registrosClasseI}
          registrosClasseII={registrosClasseII}
          registrosClasseIII={registrosClasseIII}
          totalGeral={totalGeral}
        />
      </div>
    </div>
  );
}