import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Loader2, Plus, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { fetchPTrabData, updatePTrabStatusIfAberto, fetchDiretrizesOperacionais } from "@/lib/ptrabUtils";
import { formatCurrency, numberToRawDigits } from "@/lib/formatUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import CurrencyInput from "@/components/CurrencyInput";
import PageMetadata from "@/components/PageMetadata";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VerbaOperacionalForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const { user } = useSession();
  const { handleEnterToNextField } = useFormNavigation();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ptrabData, setPtrabData] = useState<any>(null);
  const [diretrizes, setDiretrizes] = useState<any>(null);

  const [formData, setFormData] = useState({
    organizacao: "",
    ug: "",
    om_detentora: "",
    ug_detentora: "",
    dias_operacao: 1,
    quantidade_equipes: 1,
    valor_total_solicitado: 0,
    fase_atividade: "",
    objeto_aquisicao: "",
    objeto_contratacao: "",
    proposito: "",
    finalidade: "",
    local: "",
    tarefa: "",
    detalhamento_customizado: "",
    valor_nd_30: 0,
    valor_nd_39: 0,
  });

  const [rawTotalInput, setRawTotalInput] = useState("");
  const [rawND30Input, setRawND30Input] = useState("");
  const [rawND39Input, setRawND39Input] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!ptrabId) {
        toast.error("P Trab não selecionado");
        navigate('/ptrab');
        return;
      }

      try {
        const data = await fetchPTrabData(ptrabId);
        setPtrabData(data);
        
        setFormData(prev => ({
          ...prev,
          organizacao: data.nome_om,
          ug: data.codug_om || "",
          om_detentora: data.nome_om,
          ug_detentora: data.codug_om || "",
          dias_operacao: calculateDays(data.periodo_inicio, data.periodo_fim),
        }));

        const year = new Date(data.periodo_inicio).getFullYear();
        const dir = await fetchDiretrizesOperacionais(year);
        setDiretrizes(dir);

        const { data: existingRecord } = await supabase
          .from('verba_operacional_registros')
          .select('*')
          .eq('p_trab_id', ptrabId)
          .maybeSingle();

        if (existingRecord) {
          setFormData({
            organizacao: existingRecord.organizacao,
            ug: existingRecord.ug,
            om_detentora: existingRecord.om_detentora || data.nome_om,
            ug_detentora: existingRecord.ug_detentora || data.codug_om || "",
            dias_operacao: existingRecord.dias_operacao,
            quantidade_equipes: existingRecord.quantidade_equipes,
            valor_total_solicitado: Number(existingRecord.valor_total_solicitado),
            fase_atividade: existingRecord.fase_atividade || "",
            objeto_aquisicao: existingRecord.objeto_aquisicao || "",
            objeto_contratacao: existingRecord.objeto_contratacao || "",
            proposito: existingRecord.proposito || "",
            finalidade: existingRecord.finalidade || "",
            local: existingRecord.local || "",
            tarefa: existingRecord.tarefa || "",
            detalhamento_customizado: existingRecord.detalhamento_customizado || "",
            valor_nd_30: Number(existingRecord.valor_nd_30),
            valor_nd_39: Number(existingRecord.valor_nd_39),
          });
          setRawTotalInput(numberToRawDigits(existingRecord.valor_total_solicitado));
          setRawND30Input(numberToRawDigits(existingRecord.valor_nd_30));
          setRawND39Input(numberToRawDigits(existingRecord.valor_nd_39));
        }

      } catch (error: any) {
        toast.error(error.message);
        navigate('/ptrab');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [ptrabId, navigate]);

  const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };

  const handleCurrencyChange = (field: 'valor_total_solicitado' | 'valor_nd_30' | 'valor_nd_39', digits: string) => {
    const numericValue = Number(digits) / 100;
    setFormData(prev => ({ ...prev, [field]: numericValue }));
    if (field === 'valor_total_solicitado') setRawTotalInput(digits);
    if (field === 'valor_nd_30') setRawND30Input(digits);
    if (field === 'valor_nd_39') setRawND39Input(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ptrabId) return;

    const totalND = formData.valor_nd_30 + formData.valor_nd_39;
    if (Math.abs(totalND - formData.valor_total_solicitado) > 0.01) {
      toast.error("A soma dos valores por Natureza de Despesa deve ser igual ao Valor Total Solicitado.");
      return;
    }

    setIsSaving(true);
    try {
      const { data: existingRecord } = await supabase
        .from('verba_operacional_registros')
        .select('id')
        .eq('p_trab_id', ptrabId)
        .maybeSingle();

      const recordData = {
        ...formData,
        p_trab_id: ptrabId,
      };

      if (existingRecord) {
        const { error } = await supabase
          .from('verba_operacional_registros')
          .update(recordData)
          .eq('id', existingRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('verba_operacional_registros')
          .insert([recordData]);
        if (error) throw error;
      }

      await updatePTrabStatusIfAberto(ptrabId);
      toast.success("Dados da Verba Operacional salvos com sucesso!");
      navigate(`/ptrab/form?ptrabId=${ptrabId}`);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
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

  const isPTrabEditable = ptrabData?.status !== 'completo' && ptrabData?.status !== 'arquivado';

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <PageMetadata 
        title="Verba Operacional" 
        description="Detalhamento de custos de Verba Operacional para o Plano de Trabalho."
      />
      
      <div className="container max-w-4xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao P Trab
        </Button>

        <Card className="shadow-lg border-primary/20">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl font-bold text-primary">Verba Operacional</CardTitle>
                <CardDescription>
                  {ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="om_detentora">OM Detentora do Recurso *</Label>
                  <Input
                    id="om_detentora"
                    value={formData.om_detentora}
                    onChange={(e) => setFormData({ ...formData, om_detentora: e.target.value })}
                    required
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ug_detentora">UG Detentora *</Label>
                  <Input
                    id="ug_detentora"
                    value={formData.ug_detentora}
                    onChange={(e) => setFormData({ ...formData, ug_detentora: e.target.value })}
                    required
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_operacao">Dias de Operação *</Label>
                  <Input
                    id="dias_operacao"
                    type="number"
                    min="1"
                    value={formData.dias_operacao}
                    onChange={(e) => setFormData({ ...formData, dias_operacao: parseInt(e.target.value) || 1 })}
                    required
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade_equipes">Quantidade de Equipes *</Label>
                  <Input
                    id="quantidade_equipes"
                    type="number"
                    min="1"
                    value={formData.quantidade_equipes}
                    onChange={(e) => setFormData({ ...formData, quantidade_equipes: parseInt(e.target.value) || 1 })}
                    required
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_total_solicitado">Valor Total Solicitado *</Label>
                  <CurrencyInput
                    id="valor_total_solicitado"
                    value={formData.valor_total_solicitado}
                    rawDigits={rawTotalInput}
                    onChange={(_, digits) => handleCurrencyChange('valor_total_solicitado', digits)}
                    placeholder="Ex: 1.500,00"
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fase_atividade">Fase/Atividade</Label>
                  <Input
                    id="fase_atividade"
                    value={formData.fase_atividade}
                    onChange={(e) => setFormData({ ...formData, fase_atividade: e.target.value })}
                    placeholder="Ex: Concentração"
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="space-y-2">
                  <Label htmlFor="valor_nd_30">Valor ND 33.90.30 (Material de Consumo)</Label>
                  <CurrencyInput
                    id="valor_nd_30"
                    value={formData.valor_nd_30}
                    rawDigits={rawND30Input}
                    onChange={(_, digits) => handleCurrencyChange('valor_nd_30', digits)}
                    placeholder="0,00"
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_nd_39">Valor ND 33.90.39 (Outros Serviços de Terceiros)</Label>
                  <CurrencyInput
                    id="valor_nd_39"
                    value={formData.valor_nd_39}
                    rawDigits={rawND39Input}
                    onChange={(_, digits) => handleCurrencyChange('valor_nd_39', digits)}
                    placeholder="0,00"
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Detalhamento da Solicitação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="objeto_aquisicao">Objeto de Aquisição</Label>
                    <Input
                      id="objeto_aquisicao"
                      value={formData.objeto_aquisicao}
                      onChange={(e) => setFormData({ ...formData, objeto_aquisicao: e.target.value })}
                      placeholder="Ex: Gêneros alimentícios"
                      disabled={!isPTrabEditable || isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="objeto_contratacao">Objeto de Contratação</Label>
                    <Input
                      id="objeto_contratacao"
                      value={formData.objeto_contratacao}
                      onChange={(e) => setFormData({ ...formData, objeto_contratacao: e.target.value })}
                      placeholder="Ex: Serviço de lavanderia"
                      disabled={!isPTrabEditable || isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposito">Propósito</Label>
                    <Input
                      id="proposito"
                      value={formData.proposito}
                      onChange={(e) => setFormData({ ...formData, proposito: e.target.value })}
                      placeholder="Ex: Manutenção da tropa"
                      disabled={!isPTrabEditable || isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finalidade">Finalidade</Label>
                    <Input
                      id="finalidade"
                      value={formData.finalidade}
                      onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                      placeholder="Ex: Operação Ágata"
                      disabled={!isPTrabEditable || isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="local">Local</Label>
                    <Input
                      id="local"
                      value={formData.local}
                      onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                      placeholder="Ex: Posto de Fronteira"
                      disabled={!isPTrabEditable || isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tarefa">Tarefa</Label>
                    <Input
                      id="tarefa"
                      value={formData.tarefa}
                      onChange={(e) => setFormData({ ...formData, tarefa: e.target.value })}
                      placeholder="Ex: Patrulhamento"
                      disabled={!isPTrabEditable || isSaving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detalhamento_customizado">Observações Adicionais</Label>
                  <Textarea
                    id="detalhamento_customizado"
                    value={formData.detalhamento_customizado}
                    onChange={(e) => setFormData({ ...formData, detalhamento_customizado: e.target.value })}
                    rows={3}
                    placeholder="Informações complementares para a memória de cálculo..."
                    disabled={!isPTrabEditable || isSaving}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!isPTrabEditable || isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Verba Operacional
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerbaOperacionalForm;