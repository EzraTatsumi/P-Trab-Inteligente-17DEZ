import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Briefcase, Fuel, Utensils, Loader2, HardHat, Plane, TrendingUp, ClipboardList } from "lucide-react";
import { formatCurrency } from "@/lib/formatUtils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type PTrab = Tables<'p_trab'>;
type ClasseIRegistro = Tables<'classe_i_registros'>;
type ClasseIIIRegistro = Tables<'classe_iii_registros'>;

// Definindo um tipo auxiliar para os itens de Classe II (já que o DB armazena como JSONB)
interface ItemClasseII {
    item: string;
    quantidade: number;
    valor_mnt_dia: number;
    categoria: string;
}

interface PTrabCostSummaryProps {
  ptrabId: string;
  ptrabData: PTrab | null;
}

export function PTrabCostSummary({ ptrabId, ptrabData }: PTrabCostSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [totalClasseI, setTotalClasseI] = useState(0);
  const [totalClasseII, setTotalClasseII] = useState(0);
  const [totalClasseIII, setTotalClasseIII] = useState(0);
  const [totalGeral, setTotalGeral] = useState(0);

  useEffect(() => {
    if (ptrabId) {
      fetchCosts();
    }
  }, [ptrabId]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      // 1. Fetch Classe I
      const { data: classeIData, error: errorI } = await supabase
        .from('classe_i_registros')
        .select('total_qs, total_qr')
        .eq('p_trab_id', ptrabId);
      
      if (errorI) throw errorI;
      
      const totalI = (classeIData || []).reduce((sum, record) => sum + (Number(record.total_qs) || 0) + (Number(record.total_qr) || 0), 0);
      setTotalClasseI(totalI);

      // 2. Fetch Classe II
      // Usando 'as any' para contornar o erro de sobrecarga do Supabase Client
      const { data: classeIIData, error: errorII } = await supabase
        .from('classe_ii_registros' as any)
        .select('valor_total, itens_equipamentos, dias_operacao, organizacao')
        .eq('p_trab_id', ptrabId);
      
      if (errorII) throw errorII;
      
      let totalII = 0;
      
      // O cálculo de Classe II é complexo, mas aqui só precisamos somar o valor_total
      (classeIIData as any[] || []).forEach(record => {
        totalII += record.valor_total;
      });
      
      setTotalClasseII(totalII);

      // 3. Fetch Classe III
      const { data: classeIIIData, error: errorIII } = await supabase
        .from('classe_iii_registros')
        .select('valor_total')
        .eq('p_trab_id', ptrabId);
      
      if (errorIII) throw errorIII;
      
      const totalIII = (classeIIIData || []).reduce((sum, record) => sum + (record.valor_total || 0), 0);
      setTotalClasseIII(totalIII);

      const totalGeralCalculado = totalI + totalII + totalIII;
      setTotalGeral(totalGeralCalculado);
      
      // Opcional: Atualizar o valor total no PTrab se for diferente
      if (ptrabData && !areNumbersEqual(ptrabData.valor_total || 0, totalGeralCalculado)) {
        await supabase.from('p_trab').update({ valor_total: totalGeralCalculado }).eq('id', ptrabId);
      }

    } catch (error) {
      console.error("Erro ao carregar custos:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Função auxiliar para comparação de números de ponto flutuante
  const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
  };

  const summaryData = useMemo(() => [
    {
      title: "Classe I (Subsistência)",
      value: totalClasseI,
      icon: Utensils,
      color: "text-green-600",
    },
    {
      title: "Classe II (Intendência)",
      value: totalClasseII,
      icon: Briefcase,
      color: "text-blue-600",
    },
    {
      title: "Classe III (Combustível/Lub)",
      value: totalClasseIII,
      icon: Fuel,
      color: "text-amber-600",
    },
    {
      title: "Total Geral",
      value: totalGeral,
      icon: TrendingUp,
      color: "text-primary",
      isTotal: true,
    },
  ], [totalClasseI, totalClasseII, totalClasseIII, totalGeral]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {summaryData.map((item, index) => (
        <Card key={index} className={item.isTotal ? "border-2 border-primary/50 shadow-lg" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                formatCurrency(item.value)
              )}
            </div>
            {item.isTotal && ptrabData && (
                <p className="text-xs text-muted-foreground mt-1">
                    P-Trab: {ptrabData.numero_ptrab}
                </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}