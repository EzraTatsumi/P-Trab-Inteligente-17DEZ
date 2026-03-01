import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2, ArrowLeft, Printer, FileText, Download, LayoutDashboard, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { formatCurrency, formatNumber, calculateDays, formatCodug } from "@/lib/formatUtils";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import PTrabHorasVooReport from "@/components/reports/PTrabHorasVooReport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tables } from "@/integrations/supabase/types";

// =================================================================
// TIPOS E CONSTANTES
// =================================================================

export type PTrabData = Tables<'p_trab'>;
export type ClasseIRegistro = Tables<'classe_i_registros'>;
export type ClasseIIRegistro = Tables<'classe_ii_registros'>;
export type ClasseIIIRegistro = Tables<'classe_iii_registros'>;

export const CLASSE_V_CATEGORIES = ['Armamento', 'Munição'];
export const CLASSE_VI_CATEGORIES = ['Material de Engenharia', 'Equipamento de Engenharia (Custo Mnt)'];
export const CLASSE_VII_CATEGORIES = ['Material de Comunicações', 'Material de Eletrônica'];
export const CLASSE_VIII_CATEGORIES = ['Saúde - KPSI/KPT', 'Remonta/Veterinária'];
export const CLASSE_IX_CATEGORIES = ['Material de Manutenção (Vtr/Anv/Eng)', 'Peças e Acessórios'];

export interface LinhaTabela {
    tipo: 'QS' | 'QR' | 'OP';
    registro: ClasseIRegistro;
}

export interface LinhaClasseII {
    registro: ClasseIIRegistro;
}

export interface LinhaClasseIII {
    tipo_suprimento: 'COMBUSTIVEL_DIESEL' | 'COMBUSTIVEL_GASOLINA' | 'LUBRIFICANTE';
    categoria_equipamento: string;
    total_litros_linha: number;
    preco_litro_linha: number;
    valor_total_linha: number;
    memoria_calculo: string;
    registro: ClasseIIIRegistro;
}

export interface GrupoOM {
  linhasQS: LinhaTabela[];
  linhasQR: LinhaTabela[];
  linhasClasseII: LinhaClasseII[];
  linhasClasseV: LinhaClasseII[];
  linhasClasseVI: LinhaClasseII[];
  linhasClasseVII: LinhaClasseII[];
  linhasClasseVIII: LinhaClasseII[];
  linhasClasseIX: LinhaClasseII[];
  linhasClasseIII: LinhaClasseIII[];
}

// =================================================================
// FUNÇÕES DE MEMÓRIA DE CÁLCULO
// =================================================================

export const getClasseIILabel = (categoria: string) => {
    if (CLASSE_V_CATEGORIES.includes(categoria)) return categoria;
    if (CLASSE_VI_CATEGORIES.includes(categoria)) return categoria;
    if (CLASSE_VII_CATEGORIES.includes(categoria)) return categoria;
    if (CLASSE_VIII_CATEGORIES.includes(categoria)) return categoria;
    if (CLASSE_IX_CATEGORIES.includes(categoria)) return categoria;
    return categoria;
};

export const generateClasseIMemoriaCalculo = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => {
    if (registro.memoria_calculo_op_customizada && tipo === 'OP') return registro.memoria_calculo_op_customizada;
    if (registro.memoria_calculo_qs_customizada && tipo === 'QS') return registro.memoria_calculo_qs_customizada;
    if (registro.memoria_calculo_qr_customizada && tipo === 'QR') return registro.memoria_calculo_qr_customizada;

    const efetivo = registro.efetivo;
    const dias = registro.dias_operacao;
    const nrRef = registro.nr_ref_int || 1;

    if (tipo === 'QS') {
        const valQS = registro.valor_qs;
        const total = registro.total_qs;
        return `Efetivo: ${efetivo} Militares - Nr Dias: ${dias} - Etapa QS: ${formatCurrency(valQS)} - Nr Refeições: ${nrRef}\nMemória: (${efetivo} mil x ${dias} dias x ${formatCurrency(valQS)} x ${nrRef} ref.) = ${formatCurrency(total)}`;
    } else if (tipo === 'QR') {
        const valQR = registro.valor_qr;
        const total = registro.total_qr;
        return `Efetivo: ${efetivo} Militares - Nr Dias: ${dias} - Etapa QR: ${formatCurrency(valQR)}\nMemória: (${efetivo} mil x ${dias} dias x ${formatCurrency(valQR)}) = ${formatCurrency(total)}`;
    } else {
        const totalOp = (registro.quantidade_r2 || 0) + (registro.quantidade_r3 || 0);
        return `Rações Operacionais (Lote/Unid.): ${totalOp} unid.\nMemória: (Custo a cargo do COLOG)`;
    }
};

export const generateClasseIIMemoriaCalculo = (registro: any, isClasseII: boolean = true) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    
    const itens = (registro.itens_equipamentos || []) as any[];
    if (itens.length === 0) return "Nenhum item detalhado.";

    const prefixo = isClasseII ? "Itens de Intendência" : "Itens da Classe";
    const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} ${item.unidade_medida || 'unid'} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
    
    return `${prefixo}:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
};

export const generateClasseVMemoriaCalculo = (registro: any) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const itens = (registro.itens_equipamentos || []) as any[];
    const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
    return `Itens de Armamento/Munição:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
};

export const generateClasseVIMemoriaCalculo = (registro: any) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const itens = (registro.itens_equipamentos || []) as any[];
    const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
    return `Itens de Engenharia:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
};

export const generateClasseVIIMemoriaCalculo = (registro: any) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const itens = (registro.itens_equipamentos || []) as any[];
    const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
    return `Itens de Com/Elt:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
};

export const generateClasseVIIIMemoriaCalculo = (registro: any) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    
    const isRemonta = registro.categoria === 'Remonta/Veterinária';
    
    if (isRemonta) {
        const itens = (registro.itens_remonta || []) as any[];
        const cabecalho = `Animal: ${registro.animal_tipo || 'N/A'} - Quantidade: ${registro.quantidade_animais || 0} - Dias: ${registro.dias_operacao || 0}`;
        const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
        return `${cabecalho}\n\nItens de Remonta:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
    } else {
        const itens = (registro.itens_saude || []) as any[];
        const cabecalho = `Categoria: Saúde - KPSI/KPT\nEfetivo: ${registro.efetivo || 0} - Dias: ${registro.dias_operacao || 0}`;
        const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
        return `${cabecalho}\n\nItens de Saúde:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
    }
};

export const generateClasseIXMemoriaCalculo = (registro: any) => {
    if (registro.detalhamento_customizado) return registro.detalhamento_customizado;
    const itens = (registro.itens_motomecanizacao || []) as any[];
    const linhas = itens.map(item => `- ${item.descricao_item}: ${item.quantidade} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(item.valor_total)}`);
    return `Itens de Manutenção:\n${linhas.join('\n')}\nSoma: ${formatCurrency(registro.valor_total)}`;
};

export const getTipoCombustivelLabel = (tipo: string) => {
    switch (tipo) {
        case 'COMBUSTIVEL_DIESEL': return 'ÓLEO DIESEL';
        case 'COMBUSTIVEL_GASOLINA': return 'GASOLINA';
        default: return tipo;
    }
};

const PTrabReportManager = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const ptrabId = searchParams.get("ptrabId");

  const [loading, setLoading] = useState(true);
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
  const [registrosClasseV, setRegistrosClasseV] = useState<any[]>([]);
  const [registrosClasseVI, setRegistrosClasseVI] = useState<any[]>([]);
  const [registrosClasseVII, setRegistrosClasseVII] = useState<any[]>([]);
  const [registrosClasseVIII_Saude, setRegistrosClasseVIII_Saude] = useState<any[]>([]);
  const [registrosClasseVIII_Remonta, setRegistrosClasseVIII_Remonta] = useState<any[]>([]);
  const [registrosClasseIX, setRegistrosClasseIX] = useState<any[]>([]);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("P Trab não selecionado.");
      navigate("/ptrab");
      return;
    }

    const loadData = async () => {
      try {
        const { data: reportData, error } = await supabase.rpc('get_ptrab_full_report_data', {
            p_ptrab_id: ptrabId
        });

        if (error) throw error;
        
        const data = reportData as any;
        setPtrabData(data.p_trab);
        setRegistrosClasseI(data.classe_i || []);
        setRegistrosClasseII(data.classe_ii || []);
        setRegistrosClasseIII(data.classe_iii || []);
        setRegistrosClasseV(data.classe_v || []);
        setRegistrosClasseVI(data.classe_vi || []);
        setRegistrosClasseVII(data.classe_vii || []);
        setRegistrosClasseVIII_Saude(data.classe_viii_saude || []);
        setRegistrosClasseVIII_Remonta(data.classe_viii_remonta || []);
        setRegistrosClasseIX(data.classe_ix || []);
        
      } catch (error: any) {
        console.error("Erro ao carregar dados do relatório:", error);
        toast.error("Erro ao carregar dados do relatório.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [ptrabId, navigate]);

  const nomeRM = ptrabData?.rm_vinculacao || "RM Não Identificada";

  const { omsOrdenadas, gruposPorOM } = useMemo(() => {
    const grupos: Record<string, GrupoOM> = {};
    const todasOMs = new Set<string>();

    const getGrupo = (nome: string): GrupoOM => {
      if (!grupos[nome]) {
        grupos[nome] = { 
            linhasQS: [], linhasQR: [], linhasClasseII: [], 
            linhasClasseV: [], linhasClasseVI: [], linhasClasseVII: [], 
            linhasClasseVIII: [], linhasClasseIX: [], linhasClasseIII: [] 
        };
        todasOMs.add(nome);
      }
      return grupos[nome];
    };

    registrosClasseI.forEach(r => {
      if (r.total_qs > 0) getGrupo(r.om_qs).linhasQS.push({ tipo: 'QS', registro: r });
      if (r.total_qr > 0) getGrupo(r.organizacao).linhasQR.push({ tipo: 'QR', registro: r });
    });

    registrosClasseII.forEach(r => getGrupo(r.organizacao).linhasClasseII.push({ registro: r }));
    registrosClasseV.forEach(r => getGrupo(r.organizacao).linhasClasseV.push({ registro: r }));
    registrosClasseVI.forEach(r => getGrupo(r.organizacao).linhasClasseVI.push({ registro: r }));
    registrosClasseVII.forEach(r => getGrupo(r.organizacao).linhasClasseVII.push({ registro: r }));
    registrosClasseVIII_Saude.forEach(r => getGrupo(r.organizacao).linhasClasseVIII.push({ registro: r }));
    registrosClasseVIII_Remonta.forEach(r => getGrupo(r.organizacao).linhasClasseVIII.push({ registro: r }));
    registrosClasseIX.forEach(r => getGrupo(r.organizacao).linhasClasseIX.push({ registro: r }));

    registrosClasseIII.forEach(r => {
        const grupo = getGrupo(r.organizacao);
        if (r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'AMBOS') {
            const litrosDiesel = r.tipo_combustivel === 'AMBOS' ? (r.total_litros / 2) : r.total_litros;
            const valorDiesel = r.tipo_combustivel === 'AMBOS' ? (r.valor_total / 2) : r.valor_total;
            grupo.linhasClasseIII.push({
                tipo_suprimento: 'COMBUSTIVEL_DIESEL',
                categoria_equipamento: r.tipo_equipamento,
                total_litros_linha: litrosDiesel,
                preco_litro_linha: r.preco_litro,
                valor_total_linha: valorDiesel,
                memoria_calculo: `Cálculo p/ Diesel:\nQuant: ${r.quantidade} - Dias: ${r.dias_operacao} - Preço: ${formatCurrency(r.preco_litro)}\nConsumo: ${r.consumo_hora || r.consumo_km_litro || 0} ${r.consumo_hora ? 'L/h' : 'km/L'}`,
                registro: r
            });
        }
        if (r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'AMBOS') {
            const litrosGas = r.tipo_combustivel === 'AMBOS' ? (r.total_litros / 2) : r.total_litros;
            const valorGas = r.tipo_combustivel === 'AMBOS' ? (r.valor_total / 2) : r.valor_total;
            grupo.linhasClasseIII.push({
                tipo_suprimento: 'COMBUSTIVEL_GASOLINA',
                categoria_equipamento: r.tipo_equipamento,
                total_litros_linha: litrosGas,
                preco_litro_linha: r.preco_litro,
                valor_total_linha: valorGas,
                memoria_calculo: `Cálculo p/ Gasolina:\nQuant: ${r.quantidade} - Dias: ${r.dias_operacao} - Preço: ${formatCurrency(r.preco_litro)}\nConsumo: ${r.consumo_hora || r.consumo_km_litro || 0} ${r.consumo_hora ? 'L/h' : 'km/L'}`,
                registro: r
            });
        }
        if (r.consumo_lubrificante_litro && r.consumo_lubrificante_litro > 0) {
            const valorLub = (r.total_litros * r.consumo_lubrificante_litro) * (r.preco_lubrificante || 0);
            grupo.linhasClasseIII.push({
                tipo_suprimento: 'LUBRIFICANTE',
                categoria_equipamento: r.tipo_equipamento,
                total_litros_linha: r.total_litros * r.consumo_lubrificante_litro,
                preco_litro_linha: r.preco_lubrificante || 0,
                valor_total_linha: valorLub,
                memoria_calculo: `Lubrificante:\nFator: ${r.consumo_lubrificante_litro} L/comb - Preço: ${formatCurrency(r.preco_lubrificante || 0)}`,
                registro: r
            });
        }
    });

    const ordenadas = Array.from(todasOMs).sort();
    return { omsOrdenadas: ordenadas, gruposPorOM: grupos };
  }, [registrosClasseI, registrosClasseII, registrosClasseIII, registrosClasseV, registrosClasseVI, registrosClasseVII, registrosClasseVIII_Saude, registrosClasseVIII_Remonta, registrosClasseIX]);

  const calcularTotaisPorOM = (grupo: GrupoOM, nomeOM: string) => {
    const total_33_90_30 = 
        grupo.linhasQS.reduce((acc, l) => acc + l.registro.total_qs, 0) +
        grupo.linhasQR.reduce((acc, l) => acc + l.registro.total_qr, 0) +
        grupo.linhasClasseII.reduce((acc, l) => acc + l.registro.valor_nd_30, 0) +
        grupo.linhasClasseV.reduce((acc, l) => acc + l.registro.valor_nd_30, 0) +
        grupo.linhasClasseVI.reduce((acc, l) => acc + l.registro.valor_nd_30, 0) +
        grupo.linhasClasseVII.reduce((acc, l) => acc + l.registro.valor_nd_30, 0) +
        grupo.linhasClasseVIII.reduce((acc, l) => acc + l.registro.valor_nd_30, 0) +
        grupo.linhasClasseIX.reduce((acc, l) => acc + l.registro.valor_nd_30, 0) +
        grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'LUBRIFICANTE').reduce((acc, l) => acc + l.valor_total_linha, 0);

    const total_33_90_39 = 
        grupo.linhasClasseII.reduce((acc, l) => acc + l.registro.valor_nd_39, 0) +
        grupo.linhasClasseV.reduce((acc, l) => acc + l.registro.valor_nd_39, 0) +
        grupo.linhasClasseVI.reduce((acc, l) => acc + l.registro.valor_nd_39, 0) +
        grupo.linhasClasseVII.reduce((acc, l) => acc + l.registro.valor_nd_39, 0) +
        grupo.linhasClasseVIII.reduce((acc, l) => acc + l.registro.valor_nd_39, 0) +
        grupo.linhasClasseIX.reduce((acc, l) => acc + l.registro.valor_nd_39, 0);

    const total_combustivel = grupo.linhasClasseIII.filter(l => l.tipo_suprimento !== 'LUBRIFICANTE').reduce((acc, l) => acc + l.valor_total_linha, 0);
    
    const totalDieselLitros = grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_DIESEL').reduce((acc, l) => acc + l.total_litros_linha, 0);
    const totalGasolinaLitros = grupo.linhasClasseIII.filter(l => l.tipo_suprimento === 'COMBUSTIVEL_GASOLINA').reduce((acc, l) => acc + l.total_litros_linha, 0);

    return {
      total_33_90_30,
      total_33_90_39,
      total_parte_azul: total_33_90_30 + total_33_90_39,
      total_combustivel,
      total_gnd3: total_33_90_30 + total_33_90_39 + total_combustivel,
      totalDieselLitros,
      totalGasolinaLitros
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse font-medium">Consolidando dados do P Trab...</p>
        </div>
      </div>
    );
  }

  if (!ptrabData) return null;

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      <div className="max-w-[1200px] mx-auto pt-6 px-4 print:p-0 print:max-w-none">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="hover:bg-background">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Formulário
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Visualizando Relatórios de</p>
                <p className="text-sm font-bold text-foreground">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</p>
            </div>
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="logistico" className="w-full">
            <div className="flex items-center justify-between mb-4 print:hidden">
                <TabsList className="bg-muted/50 border">
                    <TabsTrigger value="logistico" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <Calculator className="h-4 w-4" /> Logístico
                    </TabsTrigger>
                    <TabsTrigger value="racao" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <FileText className="h-4 w-4" /> Ração
                    </TabsTrigger>
                    <TabsTrigger value="horasvoo" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <FileText className="h-4 w-4" /> Horas de Voo
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="logistico">
                <PTrabLogisticoReport 
                    ptrabData={ptrabData}
                    registrosClasseI={registrosClasseI}
                    registrosClasseII={registrosClasseII}
                    registrosClasseIII={registrosClasseIII}
                    nomeRM={nomeRM}
                    omsOrdenadas={omsOrdenadas}
                    gruposPorOM={gruposPorOM}
                    calcularTotaisPorOM={calcularTotaisPorOM}
                    fileSuffix="Logístico"
                    generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculo}
                    generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo}
                    generateClasseVMemoriaCalculo={generateClasseVMemoriaCalculo}
                    generateClasseVIMemoriaCalculo={generateClasseVIMemoriaCalculo}
                    generateClasseVIIMemoriaCalculo={generateClasseVIIMemoriaCalculo}
                    generateClasseVIIIMemoriaCalculo={generateClasseVIIIMemoriaCalculo}
                />
            </TabsContent>

            <TabsContent value="racao">
                <PTrabRacaoOperacionalReport 
                    ptrabData={ptrabData}
                    registrosClasseI={registrosClasseI}
                    omsOrdenadas={omsOrdenadas}
                    gruposPorOM={gruposPorOM}
                    fileSuffix="Ração"
                />
            </TabsContent>
            
            <TabsContent value="horasvoo">
                <PTrabHorasVooReport 
                    ptrabData={ptrabData}
                    registrosClasseIII={registrosClasseIII}
                    fileSuffix="Horas de Voo"
                />
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PTrabReportManager;