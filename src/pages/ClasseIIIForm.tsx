import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, Sparkles, Tractor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import RefLPCFormSection from "@/components/RefLPCFormSection";
import { ClasseIIIGeradorForm } from "@/components/ClasseIIIGeradorForm";
import { ClasseIIIViaturaForm } from "@/components/ClasseIIIViaturaForm"; // NOVO
import { ClasseIIIEmbarcacaoForm } from "@/components/ClasseIIIEmbarcacaoForm"; // NOVO
import { ClasseIIIEngenhariaForm } from "@/components/ClasseIIIEngenhariaForm"; // NOVO
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { TablesInsert } from "@/integrations/supabase/types";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: string;
  organizacao: string;
  ug: string;
  quantidade: number;
  potencia_hp?: number;
  horas_dia?: number;
  dias_operacao: number;
  consumo_hora?: number;
  consumo_km_litro?: number;
  km_dia?: number;
  tipo_combustivel: string;
  preco_litro: number;
  tipo_equipamento_detalhe?: string;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  itens_equipamentos?: any;
  total_litros_sem_margem?: number;
  fase_atividade?: string;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
}

export default function ClasseIIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoEquipamento | null>(null);
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<TipoEquipamentoDetalhado[]>([]);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  
  const lpcRef = useRef<HTMLDivElement>(null);
  
  // Estado para edição de registro (passado para os sub-formulários)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>(null); // Dados iniciais para o sub-formulário

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadRefLPC();
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);

  useEffect(() => {
    if (tipoSelecionado) {
      carregarEquipamentos();
    }
  }, [tipoSelecionado]);

  const loadRefLPC = async () => {
    try {
      const { data, error } = await supabase
        .from("p_trab_ref_lpc")
        .select("*")
        .eq("p_trab_id", ptrabId!)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRefLPC(data as RefLPC);
      } else {
        setRefLPC(null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar referência LPC:", error);
      setRefLPC(null);
    }
  };
  
  const handleRefLPCUpdate = (newRefLPC: RefLPC) => {
    setRefLPC(newRefLPC);
    toast.success("Referência LPC atualizada!");
  };

  const carregarEquipamentos = async () => {
    if (!tipoSelecionado) return;
    const equipamentos = await getEquipamentosPorTipo(tipoSelecionado);
    setEquipamentosDisponiveis(equipamentos);
  };
  
  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado, consumo_lubrificante_litro, preco_lubrificante")
      .eq("p_trab_id", ptrabId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    setRegistros((data || []) as ClasseIIIRegistro[]);
    setEditingId(null); // Reset editing state after fetch
    setInitialData(null);
    setTipoSelecionado(null);
  };

  // Funções de gerenciamento de memória customizada
  const handleIniciarEdicaoMemoria = (registro: ClasseIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || registro.detalhamento || "");
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: memoriaEdit.trim() || null,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_iii_registros'>)
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      setEditingMemoriaId(null);
      setMemoriaEdit("");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error("Erro ao salvar memória de cálculo");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_iii_registros'>)
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Deseja realmente deletar este registro?")) return;

    const { error } = await supabase
      .from("classe_iii_registros")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao deletar registro");
      console.error(error);
      return;
    }

    toast.success("Registro deletado!");
    fetchRegistros();
  };

  const getTipoLabel = (tipo: TipoEquipamento | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO') => {
    switch (tipo) {
      case 'GERADOR': return 'Gerador';
      case 'EMBARCACAO': return 'Embarcação';
      case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamento de Engenharia';
      case 'MOTOMECANIZACAO': return 'Motomecanização';
      case 'LUBRIFICANTE_GERADOR': return 'Gerador (Lubrificante)';
      case 'LUBRIFICANTE_EMBARCACAO': return 'Embarcação (Lubrificante)';
    }
  };

  const handleSelectEquipmentType = (type: TipoEquipamento) => {
    if (!refLPC) {
      toast.error("Configure a referência LPC antes de adicionar equipamentos.");
      if (lpcRef.current) {
        lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    setEditingId(null);
    setInitialData(null);
    setTipoSelecionado(type);
  };

  const handleEditar = async (registro: ClasseIIIRegistro) => {
    setLoading(true);
    setEditingId(registro.id);
    setTipoSelecionado(registro.tipo_equipamento as TipoEquipamento);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let defaultRmName = "";
    let defaultRmCodug = "";
    let selectedOmIdForEdit: string | undefined = undefined;

    if (registro.organizacao) {
      try {
        const { data: omData, error: omError } = await supabase
          .from('organizacoes_militares')
          .select('id, rm_vinculacao, codug_rm_vinculacao')
          .eq('nome_om', registro.organizacao)
          .eq('codug_om', registro.ug)
          .maybeSingle();
        if (omData && !omError) {
          selectedOmIdForEdit = omData.id;
          defaultRmName = omData.rm_vinculacao;
          defaultRmCodug = omData.codug_rm_vinculacao;
        }
      } catch (error) {
        console.error("Erro ao buscar OM para edição:", error);
      }
    }

    // Tenta extrair RM/CODUG do detalhamento (para registros antigos ou importados)
    const rmMatch = registro.detalhamento?.match(/Fornecido por: (.*?) \(CODUG: (.*?)\)/);
    const rmName = rmMatch ? rmMatch[1] : defaultRmName;
    const rmCodug = rmMatch ? rmMatch[2] : defaultRmCodug;
    
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    const fasesAtividade = fasesSalvas.filter(f => fasesPadrao.includes(f));
    const customFaseAtividade = fasesSalvas.find(f => !fasesPadrao.includes(f)) || "";

    const baseData = {
        form: {
            selectedOmId: selectedOmIdForEdit,
            organizacao: registro.organizacao,
            ug: registro.ug,
            dias_operacao: registro.dias_operacao,
            itens: (registro.itens_equipamentos as any) || [],
        },
        rmFornecimento: rmName,
        codugRmFornecimento: rmCodug,
        fasesAtividade: fasesAtividade,
        customFaseAtividade: customFaseAtividade,
    };

    if (registro.tipo_equipamento === 'GERADOR' || registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR') {
      const { data: relatedRecords } = await supabase
        .from("classe_iii_registros")
        .select("*, consumo_lubrificante_litro, preco_lubrificante")
        .eq("p_trab_id", ptrabId!)
        .in("tipo_equipamento", ["GERADOR", "LUBRIFICANTE_GERADOR"])
        .eq("organizacao", registro.organizacao)
        .eq("ug", registro.ug);
        
      const lubrificanteRecord = relatedRecords?.find(r => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR');
      
      let lubOmId: string | undefined = selectedOmIdForEdit;
      let lubOmName = registro.organizacao;
      let lubUg = registro.ug;

      if (lubrificanteRecord) {
        lubOmName = lubrificanteRecord.organizacao;
        lubUg = lubrificanteRecord.ug;
        try {
          const { data: lubOmData } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', lubOmName)
            .eq('codug_om', lubUg)
            .maybeSingle();
          lubOmId = lubOmData?.id;
        } catch (error) {
          console.error("Erro ao buscar OM de lubrificante para edição:", error);
        }
      }
      
      setInitialData({
        ...baseData,
        omLubrificante: lubOmName,
        ugLubrificante: lubUg,
        selectedOmLubrificanteId: lubOmId,
      });

    } else if (registro.tipo_equipamento === 'EMBARCACAO' || registro.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO') {
      const { data: relatedRecords } = await supabase
        .from("classe_iii_registros")
        .select("*, consumo_lubrificante_litro, preco_lubrificante")
        .eq("p_trab_id", ptrabId!)
        .in("tipo_equipamento", ["EMBARCACAO", "LUBRIFICANTE_EMBARCACAO"])
        .eq("organizacao", registro.organizacao)
        .eq("ug", registro.ug);
        
      const lubrificanteRecord = relatedRecords?.find(r => r.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO');
      
      let lubOmId: string | undefined = selectedOmIdForEdit;
      let lubOmName = registro.organizacao;
      let lubUg = registro.ug;

      if (lubrificanteRecord) {
        lubOmName = lubrificanteRecord.organizacao;
        lubUg = lubrificanteRecord.ug;
        try {
          const { data: lubOmData } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', lubOmName)
            .eq('codug_om', lubUg)
            .maybeSingle();
          lubOmId = lubOmData?.id;
        } catch (error) {
          console.error("Erro ao buscar OM de lubrificante para edição:", error);
        }
      }
      
      setInitialData({
        ...baseData,
        omLubrificante: lubOmName,
        ugLubrificante: lubUg,
        selectedOmLubrificanteId: lubOmId,
      });
    } else {
        setInitialData(baseData);
    }
    
    setLoading(false);
  };

  // Cálculo dos totais separados
  const registrosCombustivel = registros.filter(r => r.tipo_equipamento !== 'LUBRIFICANTE_GERADOR' && r.tipo_equipamento !== 'LUBRIFICANTE_EMBARCACAO');
  const totalGasolinaValor = registrosCombustivel.filter(r => r.tipo_combustivel === 'GASOLINA' || r.tipo_combustivel === 'GAS').reduce((sum, r) => sum + r.valor_total, 0);
  const totalDieselValor = registrosCombustivel.filter(r => r.tipo_combustivel === 'DIESEL' || r.tipo_combustivel === 'OD').reduce((sum, r) => sum + r.valor_total, 0);
  const registrosLubrificante = registros.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || r.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO');
  const totalLubrificanteValor = registrosLubrificante.reduce((sum, r) => sum + r.valor_total, 0);
  const custoTotalClasseIII = totalGasolinaValor + totalDieselValor + totalLubrificanteValor;

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

        {/* NOVO COMPONENTE LPC */}
        <div ref={lpcRef}>
          <RefLPCFormSection 
            ptrabId={ptrabId!} 
            refLPC={refLPC} 
            onUpdate={handleRefLPCUpdate} 
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Classe III - Combustíveis e Lubrificantes</CardTitle>
            <CardDescription>
              Selecione o tipo de equipamento para cadastrar as necessidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!refLPC && (
              <Alert className="mb-4">
                <Fuel className="h-4 w-4" />
                <AlertDescription>
                  Configure a referência LPC antes de adicionar equipamentos.
                </AlertDescription>
              </Alert>
            )}
            
            {/* SELEÇÃO DE TIPO DE EQUIPAMENTO */}
            {!tipoSelecionado && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('GERADOR')}
                  disabled={!refLPC}
                >
                  <Zap className="mr-3 h-6 w-6" />
                  Gerador
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('EMBARCACAO')}
                  disabled={!refLPC}
                >
                  <Ship className="mr-3 h-6 w-6" />
                  Embarcação
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('EQUIPAMENTO_ENGENHARIA')}
                  disabled={!refLPC}
                >
                  <Tractor className="mr-3 h-6 w-6" />
                  Equipamento de Engenharia
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('MOTOMECANIZACAO')}
                  disabled={!refLPC}
                >
                  <Truck className="mr-3 h-6 w-6" />
                  Motomecanização
                </Button>
              </div>
            )}

            {/* RENDERIZAÇÃO DOS SUB-FORMULÁRIOS */}
            {tipoSelecionado === 'GERADOR' && refLPC && (
              <ClasseIIIGeradorForm
                ptrabId={ptrabId!}
                refLPC={refLPC}
                equipamentosDisponiveis={equipamentosDisponiveis}
                onSaveSuccess={fetchRegistros}
                editingRegistroId={editingId}
                setEditingRegistroId={setEditingId}
                initialData={initialData}
              />
            )}
            
            {tipoSelecionado === 'MOTOMECANIZACAO' && refLPC && (
              <ClasseIIIViaturaForm
                ptrabId={ptrabId!}
                refLPC={refLPC}
                equipamentosDisponiveis={equipamentosDisponiveis}
                onSaveSuccess={fetchRegistros}
                editingRegistroId={editingId}
                setEditingRegistroId={setEditingId}
                initialData={initialData}
              />
            )}
            
            {tipoSelecionado === 'EMBARCACAO' && refLPC && (
              <ClasseIIIEmbarcacaoForm
                ptrabId={ptrabId!}
                refLPC={refLPC}
                equipamentosDisponiveis={equipamentosDisponiveis}
                onSaveSuccess={fetchRegistros}
                editingRegistroId={editingId}
                setEditingRegistroId={setEditingId}
                initialData={initialData}
              />
            )}
            
            {tipoSelecionado === 'EQUIPAMENTO_ENGENHARIA' && refLPC && (
              <ClasseIIIEngenhariaForm
                ptrabId={ptrabId!}
                refLPC={refLPC}
                equipamentosDisponiveis={equipamentosDisponiveis}
                onSaveSuccess={fetchRegistros}
                editingRegistroId={editingId}
                setEditingRegistroId={setEditingId}
                initialData={initialData}
              />
            )}
            
            {/* RENDERIZAÇÃO DE REGISTROS SALVOS */}
            {registros.length > 0 && !tipoSelecionado && (
              <>
                <div className="space-y-4 mt-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      OMs Cadastradas
                    </h3>
                    <Badge variant="secondary" className="text-sm">
                      {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
                    </Badge>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 font-semibold text-sm w-[20%]">OM</th>
                            <th className="text-left p-3 font-semibold text-sm w-[12%]">UG</th>
                            <th className="text-left p-3 font-semibold text-sm w-[15%]">Tipo</th>
                            <th className="text-left p-3 font-semibold text-sm w-[12%]">Suprimento</th>
                            <th className="text-right p-3 font-semibold text-sm w-[13%]">Total Litros</th>
                            <th className="text-right p-3 font-semibold text-sm w-[13%]">Valor Total</th>
                            <th className="text-center p-3 font-semibold text-sm w-[15%]">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map((registro) => {
                            const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || registro.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO';
                            const tipoLabel = getTipoLabel(registro.tipo_equipamento as TipoEquipamento | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO');
                            
                            let suprimentoBadgeClass = '';
                            let suprimentoText = '';

                            if (isLubrificante) {
                              suprimentoBadgeClass = 'bg-purple-600 text-white hover:bg-purple-700';
                              suprimentoText = 'Lubrificante';
                            } else if (registro.tipo_combustivel === 'DIESEL' || registro.tipo_combustivel === 'OD') {
                              suprimentoBadgeClass = 'bg-cyan-600 text-white hover:bg-cyan-700';
                              suprimentoText = 'Diesel';
                            } else if (registro.tipo_combustivel === 'GASOLINA' || registro.tipo_combustivel === 'GAS') {
                              suprimentoBadgeClass = 'bg-amber-500 text-white hover:bg-amber-600';
                              suprimentoText = 'Gasolina';
                            } else {
                              suprimentoBadgeClass = 'bg-primary text-primary-foreground';
                              suprimentoText = 'Combustível';
                            }
                            
                            return (
                              <tr key={registro.id} className="border-t hover:bg-muted/50 transition-colors">
                                <td className="p-3 text-sm">{registro.organizacao}</td>
                                <td className="p-3 text-sm">{registro.ug}</td>
                                <td className="p-3 text-sm">{tipoLabel}</td>
                                <td className="p-3 text-sm">
                                  <Badge variant="default" className={suprimentoBadgeClass}>
                                    {suprimentoText}
                                  </Badge>
                                </td>
                                <td className="p-3 text-sm text-right font-medium">{formatNumber(registro.total_litros)} L</td>
                                <td className="p-3 text-sm text-right font-medium">{formatCurrency(registro.valor_total)}</td>
                                <td className="p-3 text-sm">
                                  <div className="flex gap-1 justify-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleEditar(registro)}
                                      disabled={!refLPC}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeletar(registro.id)}
                                      disabled={loading}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-muted/50 border-t-2">
                          <tr className="bg-primary/10 border-t-2">
                            <td colSpan={5} className="p-3 text-sm font-bold text-primary text-right">
                              CUSTO TOTAL CLASSE III
                            </td>
                            <td className="p-3 text-sm text-right font-extrabold text-primary text-base">
                              {formatCurrency(custoTotalClasseIII)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mt-8">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    📋 Memórias de Cálculo Detalhadas
                  </h3>
                  
                  {registros.map((registro) => {
                    const isEditing = editingMemoriaId === registro.id;
                    const hasCustomMemoria = !!registro.detalhamento_customizado;
                    const memoriaExibida = registro.detalhamento_customizado || registro.detalhamento || "";
                    const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || registro.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO';
                    
                    let suprimentoTipo = isLubrificante ? 'Lubrificante' : (registro.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel');
                    let equipamentoTipo = getTipoLabel(registro.tipo_equipamento as TipoEquipamento | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO');
                    
                    const tituloOM = `${registro.organizacao} (UG: ${registro.ug})`;
                    const tituloEquipamento = equipamentoTipo;

                    return (
                      <Card key={`memoria-${registro.id}`} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                              {tituloOM}
                            </h4>
                            <span className="text-lg font-semibold text-muted-foreground/80">
                              | {tituloEquipamento}
                            </span>
                            {hasCustomMemoria && !isEditing && (
                              <Badge variant="outline" className="text-xs">
                                Editada manualmente
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant="default" 
                            className={isLubrificante 
                              ? 'bg-purple-600 text-primary-foreground' 
                              : (registro.tipo_combustivel === 'GASOLINA' || registro.tipo_combustivel === 'GAS'
                                  ? 'bg-amber-500 text-primary-foreground' 
                                  : 'bg-cyan-600 text-primary-foreground')}
                          >
                            {suprimentoTipo}
                          </Badge>
                        </div>
                        
                        <div className="h-px bg-border my-4" />
                        
                        <div className="flex items-center justify-end gap-2 mb-4">
                          {!isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleIniciarEdicaoMemoria(registro)}
                                disabled={loading}
                                className="gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Editar Memória
                              </Button>
                              
                              {hasCustomMemoria && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                  disabled={loading}
                                  className="gap-2 text-muted-foreground"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Restaurar Automática
                                </Button>
                              )}
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                disabled={loading}
                                className="gap-2"
                              >
                                <Check className="h-4 w-4" />
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={loading}
                                className="gap-2"
                              >
                                <XCircle className="h-4 w-4" />
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                        
                        <Card className="p-4 bg-background rounded-lg border">
                          {isEditing ? (
                            <Textarea
                              value={memoriaEdit}
                              onChange={(e) => setMemoriaEdit(e.target.value)}
                              className="min-h-[300px] font-mono text-sm"
                              placeholder="Digite a memória de cálculo..."
                            />
                          ) : (
                            <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                              {memoriaExibida}
                            </pre>
                          )}
                        </Card>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}