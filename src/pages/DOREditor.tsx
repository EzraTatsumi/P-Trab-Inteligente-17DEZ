"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Printer, Loader2, FileText, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSession } from "@/components/SessionContextProvider";
import { cn } from "@/lib/utils";

const DOREditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ptrab, setPtrab] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    numero_dor: "",
    email: "",
    telefone: "",
    acao_orcamentaria: "2000",
    plano_orcamentario: "0000",
    evento: "",
    finalidade: "",
    motivacao: "",
    consequencia: "",
    observacoes: ""
  });

  const loadData = useCallback(async () => {
    if (!ptrabId) return;
    setLoading(true);
    try {
      // Carregar dados do P Trab
      const { data: ptrabData, error: ptrabError } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", ptrabId)
        .single();

      if (ptrabError) throw ptrabError;
      setPtrab(ptrabData);

      // Carregar dados existentes do DOR
      const { data: dorData, error: dorError } = await supabase
        .from("dor_registros")
        .select("*")
        .eq("p_trab_id", ptrabId)
        .maybeSingle();

      if (dorData) {
        setFormData({
          numero_dor: dorData.numero_dor || "",
          email: dorData.email || "",
          telefone: dorData.telefone || "",
          acao_orcamentaria: dorData.acao_orcamentaria || "2000",
          plano_orcamentario: dorData.plano_orcamentario || "0000",
          evento: dorData.evento || "",
          finalidade: dorData.finalidade || "",
          motivacao: dorData.motivacao || "",
          consequencia: dorData.consequencia || "",
          observacoes: dorData.observacoes || ""
        });
      } else {
        // Pre-fill com dados do P Trab se for novo
        setFormData(prev => ({
          ...prev,
          evento: ptrabData.nome_operacao,
          finalidade: ptrabData.acoes || ""
        }));
      }
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [ptrabId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!ptrabId || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("dor_registros")
        .upsert({
          p_trab_id: ptrabId,
          user_id: user.id,
          ...formData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'p_trab_id' });

      if (error) throw error;
      toast.success("DOR salvo com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando esqueleto do documento...</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 pb-20">
      <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center sticky top-4 z-10 bg-slate-100/80 backdrop-blur-sm p-2 rounded-lg border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ptrab")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-lg font-bold hidden md:block">Editor de DOR</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info("Impressão do DOR em desenvolvimento")}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Documento
          </Button>
        </div>
      </div>

      {/* Esqueleto do Documento */}
      <Card className="max-w-[210mm] mx-auto bg-white shadow-2xl p-[1.5cm] min-h-[297mm] font-serif text-[#1a1a1a]">
        {/* Cabeçalho Oficial */}
        <div className="text-center mb-8 space-y-1 uppercase font-bold text-[11pt]">
          <p>Ministério da Defesa</p>
          <p>Exército Brasileiro</p>
          <p>{ptrab?.comando_militar_area}</p>
          <p>{ptrab?.nome_om_extenso || ptrab?.nome_om}</p>
        </div>

        {/* Título do Documento */}
        <div className="text-center mb-10">
          <h2 className="text-[14pt] font-bold underline decoration-2 underline-offset-4">
            DOCUMENTO OFICIAL DA REQUISIÇÃO (DOR)
          </h2>
          <div className="flex justify-center items-center gap-2 mt-2 font-bold">
            <span>Nr</span>
            <Input 
              value={formData.numero_dor}
              onChange={(e) => setFormData({...formData, numero_dor: e.target.value})}
              className="w-16 h-8 text-center border-b-2 border-t-0 border-x-0 rounded-none focus-visible:ring-0 font-bold p-0"
              placeholder="00"
            />
            <span>- {currentYear}</span>
          </div>
        </div>

        {/* Seção 1: Identificação */}
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-[180px_1fr] items-start gap-2">
            <span className="font-bold">1. OPERAÇÃO:</span>
            <span className="border-b border-dotted border-slate-400 pb-1">{ptrab?.nome_operacao}</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] items-start gap-2">
            <span className="font-bold">2. OM REQUISITANTE:</span>
            <span className="border-b border-dotted border-slate-400 pb-1">{ptrab?.nome_om} ({ptrab?.codug_om})</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] items-center gap-2">
            <span className="font-bold">3. CONTATO:</span>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-slate-500 italic">E-mail:</span>
                <Input 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="h-7 border-b border-t-0 border-x-0 rounded-none focus-visible:ring-0 p-0 text-sm"
                  placeholder="exemplo@eb.mil.br"
                />
              </div>
              <div className="flex items-center gap-2 w-40">
                <span className="text-sm text-slate-500 italic">Tel:</span>
                <Input 
                  value={formData.telefone}
                  onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                  className="h-7 border-b border-t-0 border-x-0 rounded-none focus-visible:ring-0 p-0 text-sm"
                  placeholder="(00) 0000-0000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Seção 2: Classificação Orçamentária */}
        <div className="mb-8">
          <h3 className="font-bold mb-3">4. CLASSIFICAÇÃO ORÇAMENTÁRIA:</h3>
          <div className="grid grid-cols-2 gap-8 pl-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Ação Orçamentária:</span>
              <Input 
                value={formData.acao_orcamentaria}
                onChange={(e) => setFormData({...formData, acao_orcamentaria: e.target.value})}
                className="w-24 h-8 border border-slate-300 rounded px-2 text-center font-mono"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Plano Orçamentário (PO):</span>
              <Input 
                value={formData.plano_orcamentario}
                onChange={(e) => setFormData({...formData, plano_orcamentario: e.target.value})}
                className="w-24 h-8 border border-slate-300 rounded px-2 text-center font-mono"
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Justificativa e Detalhamento */}
        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <h3 className="font-bold">5. EVENTO / ATIVIDADE:</h3>
            <Textarea 
              value={formData.evento}
              onChange={(e) => setFormData({...formData, evento: e.target.value})}
              className="min-h-[60px] border-slate-200 focus-visible:ring-primary resize-none"
              placeholder="Descreva o evento ou atividade principal..."
            />
          </div>

          <div className="space-y-2">
            <h3 className="font-bold">6. FINALIDADE:</h3>
            <Textarea 
              value={formData.finalidade}
              onChange={(e) => setFormData({...formData, finalidade: e.target.value})}
              className="min-h-[80px] border-slate-200 focus-visible:ring-primary"
              placeholder="Qual o objetivo desta requisição?"
            />
          </div>

          <div className="space-y-2">
            <h3 className="font-bold">7. MOTIVAÇÃO / JUSTIFICATIVA:</h3>
            <Textarea 
              value={formData.motivacao}
              onChange={(e) => setFormData({...formData, motivacao: e.target.value})}
              className="min-h-[100px] border-slate-200 focus-visible:ring-primary"
              placeholder="Por que este recurso é necessário agora?"
            />
          </div>

          <div className="space-y-2">
            <h3 className="font-bold">8. CONSEQUÊNCIA DO NÃO ATENDIMENTO:</h3>
            <Textarea 
              value={formData.consequencia}
              onChange={(e) => setFormData({...formData, consequencia: e.target.value})}
              className="min-h-[80px] border-slate-200 focus-visible:ring-primary"
              placeholder="O que acontece se o recurso não for liberado?"
            />
          </div>
        </div>

        {/* Seção 4: Observações */}
        <div className="space-y-2 mb-12">
          <h3 className="font-bold italic">9. OBSERVAÇÕES ADICIONAIS:</h3>
          <Textarea 
            value={formData.observacoes}
            onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
            className="min-h-[60px] border-slate-200 focus-visible:ring-primary"
            placeholder="Informações complementares..."
          />
        </div>

        {/* Assinatura */}
        <div className="mt-20 text-center space-y-1">
          <div className="w-64 h-px bg-slate-400 mx-auto mb-2"></div>
          <p className="font-bold uppercase text-[10pt]">{ptrab?.nome_cmt_om || 'Comandante da OM'}</p>
          <p className="text-[9pt]">Ordenador de Despesas da {ptrab?.nome_om}</p>
        </div>
      </Card>

      {/* Dica Flutuante */}
      <div className="fixed bottom-6 right-6 max-w-xs bg-primary text-primary-foreground p-3 rounded-lg shadow-lg flex gap-3 items-start animate-in fade-in slide-in-from-bottom-4">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">
          Este editor simula o layout oficial do DOR. Os campos em destaque são editáveis e serão salvos no banco de dados vinculado ao P Trab Nr {ptrab?.numero_ptrab}.
        </p>
      </div>
    </div>
  );
};

export default DOREditor;