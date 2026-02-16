"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save, Printer, Loader2, Info } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatUtils";

// Componente auxiliar para Inputs que parecem texto do documento
const DocumentInput = ({ value, onChange, placeholder, className, readOnly = false, style }: any) => (
  <input
    type="text"
    value={value || ""}
    onChange={onChange}
    placeholder={placeholder}
    readOnly={readOnly}
    style={style}
    className={cn(
      "bg-transparent border-none p-0 focus:ring-1 focus:ring-primary/30 focus:bg-yellow-50/50 outline-none text-black placeholder:text-gray-300 font-normal transition-colors",
      className
    )}
  />
);

// Componente auxiliar para Textareas que se integram ao layout
const DocumentTextArea = ({ value, onChange, placeholder, className, rows = 3, style }: any) => (
  <textarea
    value={value || ""}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    style={style}
    className={cn(
      "w-full bg-transparent border-none p-0 focus:ring-1 focus:ring-primary/30 focus:bg-yellow-50/50 outline-none resize-none text-black placeholder:text-gray-300 font-normal text-justify transition-colors",
      className
    )}
  />
);

const DOREditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ptrab, setPtrab] = useState<any>(null);
  const [dorItems, setDorItems] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    numero_dor: "",
    email: "",
    telefone: "",
    acao_orcamentaria: "A cargo do MD.",
    plano_orcamentario: "A cargo do MD.",
    anexos: "----",
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
      // 1. Carregar dados do P-Trab
      const { data: ptrabData, error: ptrabError } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", ptrabId)
        .single();

      if (ptrabError) throw ptrabError;
      setPtrab(ptrabData);

      // 2. Carregar dados do DOR (se existirem)
      const { data: dorData } = await supabase
        .from("dor_registros")
        .select("*")
        .eq("p_trab_id", ptrabId)
        .maybeSingle();

      if (dorData) {
        setFormData({
          numero_dor: dorData.numero_dor || "",
          email: dorData.email || "",
          telefone: dorData.telefone || "",
          acao_orcamentaria: dorData.acao_orcamentaria || "A cargo do MD.",
          plano_orcamentario: dorData.plano_orcamentario || "A cargo do MD.",
          anexos: (dorData as any).anexos || "----",
          evento: dorData.evento || "",
          finalidade: dorData.finalidade || "",
          motivacao: dorData.motivacao || "",
          consequencia: dorData.consequencia || "",
          observacoes: dorData.observacoes || ""
        });
      } else {
        setFormData(prev => ({
          ...prev,
          evento: ptrabData.nome_operacao,
          finalidade: ptrabData.acoes || "",
          numero_dor: "" 
        }));
      }

      // 3. Consolidar Itens para a Tabela
      const tables = [
        { name: 'classe_i_registros', gnd: 3, desc: 'COMPLEMENTAÇÃO DE ALIMENTAÇÃO' },
        { name: 'classe_ii_registros', gnd: 3, desc: 'MATERIAL DE INTENDÊNCIA' },
        { name: 'classe_iii_registros', gnd: 3, desc: 'AQUISIÇÃO DE COMBUSTÍVEL' },
        { name: 'classe_v_registros', gnd: 3, desc: 'ARMAMENTO' },
        { name: 'classe_vi_registros', gnd: 3, desc: 'MATERIAL DE ENGENHARIA' },
        { name: 'classe_vii_registros', gnd: 3, desc: 'COMUNICAÇÕES E INFORMÁTICA' },
        { name: 'classe_viii_saude_registros', gnd: 3, desc: 'MATERIAL DE SAÚDE' },
        { name: 'classe_viii_remonta_registros', gnd: 3, desc: 'REMONTA E VETERINÁRIA' },
        { name: 'classe_ix_registros', gnd: 3, desc: 'MANUTENÇÃO DE VIATURA' },
        { name: 'diaria_registros', gnd: 3, desc: 'PAGAMENTO DE DIÁRIA' },
        { name: 'verba_operacional_registros', gnd: 3, desc: 'VERBA OPERACIONAL' },
        { name: 'passagem_registros', gnd: 3, desc: 'AQUISIÇÃO DE PASSAGENS' },
        { name: 'concessionaria_registros', gnd: 3, desc: 'PAGAMENTO DE CONCESSIONÁRIA' },
        { name: 'horas_voo_registros', gnd: 3, desc: 'FRETAMENTO AÉREO' },
        { name: 'material_consumo_registros', gnd: 3, desc: 'MATERIAL DE CONSUMO' },
        { name: 'complemento_alimentacao_registros', gnd: 3, desc: 'COMPLEMENTAÇÃO DE ALIMENTAÇÃO' },
        { name: 'servicos_terceiros_registros', gnd: 3, desc: 'SERVIÇOS DE TERCEIROS' },
        { name: 'material_permanente_registros', gnd: 4, desc: 'MATERIAL PERMANENTE' }
      ];

      const aggregatedItems: any[] = [];

      for (const table of tables) {
        const { data, error } = await (supabase.from(table.name as any) as any)
          .select('organizacao, ug, valor_total')
          .eq('p_trab_id', ptrabId);

        if (!error && data) {
          data.forEach((row: any) => {
            const ugeLabel = `${row.organizacao} (${row.ug})`;
            const existing = aggregatedItems.find(i => i.uge === ugeLabel && i.descricao === table.desc);
            
            if (existing) {
              existing.valor_num += Number(row.valor_total || 0);
            } else {
              aggregatedItems.push({
                uge: ugeLabel,
                gnd: table.gnd,
                descricao: table.desc,
                valor_num: Number(row.valor_total || 0)
              });
            }
          });
        }
      }

      setDorItems(aggregatedItems.filter(i => i.valor_num > 0));

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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando esqueleto do documento...</p>
      </div>
    );
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const anoAtual = new Date().getFullYear();

  // Estilo base para o corpo do documento (Calibri 12pt)
  const bodyStyle = { fontFamily: 'Calibri, sans-serif', fontSize: '12pt', color: 'black', lineHeight: '1.2' };
  const headerTitleStyle = { backgroundColor: '#BFBFBF' };

  return (
    <div className="min-h-screen bg-slate-200 py-8 px-4 print:p-0 print:bg-white">
      {/* Barra de Ferramentas Flutuante */}
      <div className="fixed top-4 right-4 z-50 flex gap-2 print:hidden bg-white/90 backdrop-blur p-2 rounded-lg shadow-xl border border-slate-200">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir / PDF
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      {/* A FOLHA A4 */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none min-h-[297mm] relative text-black print:w-full">
        
        <div className="p-[20mm]">
          
          {/* CABEÇALHO OFICIAL PADRONIZADO (3 COLUNAS) - MANTIDO 11PT */}
          <div className="border border-black grid grid-cols-[180px_1fr_200px] items-stretch mb-4">
            <div className="border-r border-black p-1 flex items-center justify-center text-center overflow-hidden">
              <img 
                src="/logo_md.png" 
                alt="Ministério da Defesa" 
                className="max-h-16 w-auto object-contain"
                onError={(e: any) => {
                  e.target.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Coat_of_arms_of_Brazil.svg/100px-Coat_of_arms_of_Brazil.svg.png";
                }}
              />
            </div>

            <div 
              className="border-r border-black p-1 flex flex-col items-center justify-center text-center font-bold uppercase leading-tight"
              style={{ fontFamily: 'Calibri, sans-serif', fontSize: '11pt' }}
            >
              <p>Ministério da Defesa</p>
              <p>Exército Brasileiro</p>
              <p>{ptrab?.comando_militar_area}</p>
              <p>{ptrab?.nome_om_extenso || ptrab?.nome_om}</p>
            </div>

            <div 
              className="p-1 flex flex-col items-center justify-center text-center leading-tight font-bold"
              style={{ fontFamily: 'Calibri, sans-serif', fontSize: '11pt' }}
            >
              <p>Documento de Oficialização da Requisição – DOR</p>
              <div className="flex items-center justify-center gap-0.5 mt-1">
                <span>nº</span>
                <DocumentInput 
                  value={formData.numero_dor}
                  onChange={(e: any) => setFormData({...formData, numero_dor: e.target.value})}
                  placeholder="01"
                  className="w-8 text-center font-bold"
                  style={{ fontSize: '11pt' }}
                />
                <span>/ {anoAtual}</span>
              </div>
              <p className="mt-2">{dataAtual}</p>
            </div>
          </div>

          {/* ESTRUTURA TABULAR DO DOR - CALIBRI 12PT */}
          <div style={bodyStyle}>
            
            {/* SEÇÃO 1: DADOS DO REQUISITANTE */}
            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                DADOS DO ÓRGÃO REQUISITANTE
              </div>
              
              <div className="border-b border-black py-0 px-2 font-bold">
                Órgão:
              </div>
              <div className="border-b border-black py-0 px-2">
                {ptrab?.nome_om_extenso || ptrab?.nome_om}
              </div>
              
              <div className="grid grid-cols-2 border-b border-black">
                <div className="py-0 px-2 border-r border-black font-bold">
                  Responsável pela Demanda:
                </div>
                <div className="py-0 px-2"></div>
              </div>
              
              <div className="border-b border-black py-0 px-2">
                {ptrab?.nome_cmt_om || "Não informado"}
              </div>

              <div className="grid grid-cols-2">
                <div className="py-0 px-2 border-r border-black flex items-center gap-1">
                  <span className="font-bold whitespace-nowrap">E-mail:</span>
                  <DocumentInput 
                    value={formData.email}
                    onChange={(e: any) => setFormData({...formData, email: e.target.value})}
                    placeholder="exemplo@eb.mil.br"
                    className="w-full"
                    style={bodyStyle}
                  />
                </div>
                <div className="py-0 px-2 flex items-center gap-1">
                  <span className="font-bold whitespace-nowrap">Telefone:</span>
                  <DocumentInput 
                    value={formData.telefone}
                    onChange={(e: any) => setFormData({...formData, telefone: e.target.value})}
                    placeholder="(00) 0000-0000"
                    className="w-full"
                    style={bodyStyle}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO: ANEXOS */}
            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                Anexos
              </div>
              <div className="py-0 px-2 text-center">
                <DocumentInput 
                  value={formData.anexos}
                  onChange={(e: any) => setFormData({...formData, anexos: e.target.value})}
                  className="w-full text-center"
                  style={bodyStyle}
                />
              </div>
            </div>

            {/* SEÇÃO 2: DADOS ORÇAMENTÁRIOS */}
            <div className="border border-black mb-4">
              <div className="border-b border-black py-0 px-2 flex items-center gap-2" style={headerTitleStyle}>
                <span className="font-bold shrink-0">Ação Orçamentária (AO):</span>
                <DocumentInput 
                  value={formData.acao_orcamentaria}
                  onChange={(e: any) => setFormData({...formData, acao_orcamentaria: e.target.value})}
                  className="w-full"
                  style={bodyStyle}
                />
              </div>
              <div className="py-0 px-2 flex items-center gap-2">
                <span className="font-bold shrink-0">Plano Orçamentário (PO):</span>
                <DocumentInput 
                  value={formData.plano_orcamentario}
                  onChange={(e: any) => setFormData({...formData, plano_orcamentario: e.target.value})}
                  className="w-full"
                  style={bodyStyle}
                />
              </div>
            </div>

            {/* SEÇÃO 3: OBJETO E ITENS */}
            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                OBJETO DE REQUISIÇÃO
              </div>
              
              <div className="grid grid-cols-[120px_1fr] border-b border-black">
                <div className="py-0 px-2 border-r border-black font-bold flex items-center">
                  Evento:
                </div>
                <div className="py-0 px-2">
                  <DocumentInput 
                    value={formData.evento}
                    onChange={(e: any) => setFormData({...formData, evento: e.target.value})}
                    placeholder="Nome da Operação / Atividade"
                    className="w-full font-bold uppercase"
                    style={bodyStyle}
                  />
                </div>
              </div>

              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                DESCRIÇÃO DO ITEM (BEM E/OU SERVIÇO)
              </div>

              <div className="grid grid-cols-[1fr_60px_140px_1fr] border-b border-black font-bold text-center text-[10pt]">
                <div className="border-r border-black py-0 px-1">UGE</div>
                <div className="border-r border-black py-0 px-1">GND</div>
                <div className="border-r border-black py-0 px-1">VALOR</div>
                <div className="py-0 px-1">Descrição</div>
              </div>

              {/* Linhas de Itens Consolidadas */}
              {dorItems.length > 0 ? (
                dorItems.map((item, idx) => (
                  <div key={idx} className={cn("grid grid-cols-[1fr_60px_140px_1fr] text-[10pt] text-center", idx !== dorItems.length - 1 && "border-b border-black")}>
                    <div className="border-r border-black py-0 px-1 text-left leading-tight flex items-center">{item.uge}</div>
                    <div className="border-r border-black py-0 px-1 flex items-center justify-center">{item.gnd}</div>
                    <div className="border-r border-black py-0 px-1 flex items-center justify-end">{formatNumber(item.valor_num)}</div>
                    <div className="py-0 px-1 text-left leading-tight uppercase flex items-center">{item.descricao}</div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 italic text-[10pt]">
                  Nenhum item de custo encontrado para este P-Trab.
                </div>
              )}
            </div>

            {/* SEÇÃO 5: JUSTIFICATIVAS */}
            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                5. Justificativas da Contratação / Requisição
              </div>
              
              <div className="border-b border-black p-1 px-2">
                <span className="block font-bold uppercase mb-0.5">5.1. Finalidade:</span>
                <DocumentTextArea 
                  value={formData.finalidade}
                  onChange={(e: any) => setFormData({...formData, finalidade: e.target.value})}
                  placeholder="Descreva a finalidade desta requisição..."
                  rows={2}
                  style={bodyStyle}
                />
              </div>

              <div className="border-b border-black p-1 px-2">
                <span className="block font-bold uppercase mb-0.5">5.2. Motivação / Justificativa:</span>
                <DocumentTextArea 
                  value={formData.motivacao}
                  onChange={(e: any) => setFormData({...formData, motivacao: e.target.value})}
                  placeholder="Justifique a necessidade técnica e operacional..."
                  rows={3}
                  style={bodyStyle}
                />
              </div>

              <div className="p-1 px-2">
                <span className="block font-bold uppercase mb-0.5">5.3. Consequência do Não Atendimento:</span>
                <DocumentTextArea 
                  value={formData.consequencia}
                  onChange={(e: any) => setFormData({...formData, consequencia: e.target.value})}
                  placeholder="Descreva os riscos e prejuízos caso a requisição não seja atendida..."
                  rows={2}
                  style={bodyStyle}
                />
              </div>
            </div>

            {/* SEÇÃO 6: OBSERVAÇÕES */}
            <div className="border border-black mb-4">
               <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                6. Observações Gerais
              </div>
              <div className="p-1 px-2">
                <DocumentTextArea 
                  value={formData.observacoes}
                  onChange={(e: any) => setFormData({...formData, observacoes: e.target.value})}
                  placeholder="Informações adicionais relevantes..."
                  rows={2}
                  style={bodyStyle}
                />
              </div>
            </div>

          </div>

          {/* RODAPÉ E ASSINATURAS */}
          <div className="mt-8 flex flex-col items-center" style={bodyStyle}>
            <div className="text-center mb-6 w-full">
              <p>{ptrab?.local_om || "Local não informado"}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
            </div>

            <div className="w-2/3 border-t border-black mt-6"></div>
            <div className="text-center mt-1">
              <p className="font-bold uppercase">{ptrab?.nome_cmt_om || "NOME DO ORDENADOR DE DESPESAS"}</p>
              <p className="uppercase">Ordenador de Despesas da {ptrab?.nome_om}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Dica Flutuante */}
      <div className="fixed bottom-6 right-6 max-w-xs bg-primary text-primary-foreground p-3 rounded-lg shadow-lg flex gap-3 items-start animate-in fade-in slide-in-from-bottom-4 print:hidden">
        <Info className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">
          Este editor permite preencher o DOR diretamente no layout oficial. Clique nos campos para editar. As alterações são vinculadas ao P-Trab Nr {ptrab?.numero_ptrab}.
        </p>
      </div>
    </div>
  );
};

export default DOREditor;