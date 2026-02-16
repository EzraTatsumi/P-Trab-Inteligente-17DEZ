"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Save, Printer, Loader2, Info, Download, RefreshCw } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/formatUtils";
import { PTrabImporter, DorGroup } from "@/components/PTrabImporter";

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

// Componente auxiliar para Textareas que se integram ao layout e auto-ajustam a altura
const DocumentTextArea = ({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  rows = 1, 
  style 
}: any) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ajusta a altura automaticamente baseada no scrollHeight
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      style={style}
      className={cn(
        "w-full bg-transparent border-none p-0 focus:ring-1 focus:ring-primary/30 focus:bg-yellow-50/50 outline-none resize-none text-black placeholder:text-gray-300 font-normal text-justify transition-colors overflow-hidden",
        className
      )}
    />
  );
};

const DOREditor = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ptrab, setPtrab] = useState<any>(null);
  const [dorItems, setDorItems] = useState<any[]>([]);
  const [showItemsTable, setShowItemsTable] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  
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
      const { data: ptrabData, error: ptrabError } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", ptrabId)
        .single();

      if (ptrabError) throw ptrabError;
      setPtrab(ptrabData);

      const { data: dorData } = await supabase
        .from("dor_registros" as any)
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
          finalidade: dorData.finalidade || ptrabData.acoes || "",
          motivacao: dorData.motivacao || "",
          consequencia: dorData.consequencia || "",
          observacoes: dorData.observacoes || ""
        });
        
        if (dorData.itens_dor && Array.isArray(dorData.itens_dor) && dorData.itens_dor.length > 0) {
          setDorItems(dorData.itens_dor);
          setShowItemsTable(true);
        }
      } else {
        const opName = ptrabData.nome_operacao || "";
        const formattedOp = opName.toLowerCase().startsWith("operação") ? opName : `Operação ${opName}`;
        
        setFormData(prev => ({
          ...prev,
          evento: formattedOp,
          finalidade: ptrabData.acoes || "",
          numero_dor: "" 
        }));
      }
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [ptrabId]);

  const handleImportConcluded = (groups: DorGroup[], selectedGnd: number) => {
    const finalItems: any[] = [];

    groups.forEach(group => {
      const ugeAggregated: Record<string, number> = {};
      
      group.items.forEach(typeItem => {
        typeItem.originalRecords.forEach(record => {
          const ugeLabel = `${record.organizacao} (${record.ug})`;
          ugeAggregated[ugeLabel] = (ugeAggregated[ugeLabel] || 0) + Number(record.valor_total);
        });
      });

      Object.entries(ugeAggregated).forEach(([uge, valor]) => {
        finalItems.push({
          uge,
          gnd: selectedGnd,
          descricao: group.name,
          valor_num: valor
        });
      });
    });

    setDorItems(finalItems);
    setShowItemsTable(true);
    toast.success(`Dados de GND ${selectedGnd} importados com sucesso!`);
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!ptrabId || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("dor_registros" as any)
        .upsert({
          p_trab_id: ptrabId,
          user_id: user.id,
          ...formData,
          itens_dor: dorItems, // Salvando os itens importados
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

  const importFinalidadeFromPtrab = () => {
    if (ptrab?.acoes) {
      setFormData(prev => ({ ...prev, finalidade: ptrab.acoes }));
      toast.success("Finalidade importada do P-Trab!");
    } else {
      toast.error("Nenhuma ação descrita no cabeçalho do P-Trab.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Carregando esqueleto do documento...</p>
      </div>
    );
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const anoAtual = new Date().getFullYear();

  const bodyStyle = { fontFamily: 'Calibri, sans-serif', fontSize: '12pt', color: 'black', lineHeight: '1.2' };
  const headerTitleStyle = { backgroundColor: '#BFBFBF' };

  return (
    <div className="min-h-screen bg-slate-200 py-8 px-4 print:p-0 print:bg-white">
      <style>{`
        @media print {
          @page {
            margin-top: 25mm;
            margin-bottom: 20mm;
            size: A4;
          }
          .continuation-header {
            position: fixed;
            top: 5mm;
            left: 20mm;
            right: 20mm;
            display: block !important;
            z-index: 1;
          }
          .first-page-header-cover {
            position: absolute;
            top: -25mm;
            left: -20mm;
            right: -20mm;
            height: 25mm;
            background: white;
            z-index: 10;
            display: block !important;
          }
          .page-number::after {
            content: counter(page);
          }
        }
      `}</style>

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

      <div className="continuation-header hidden pointer-events-none">
        <div className="flex items-end w-full text-[10pt] font-normal italic text-black">
          <span className="whitespace-nowrap">
            (Continuação do DOR Nr {formData.numero_dor || '___'} - {anoAtual} – {ptrab?.nome_om}, de {dataAtual}
          </span>
          <span className="flex-1 border-b border-dotted border-black mb-1 mx-1"></span>
          <span className="whitespace-nowrap">fl <span className="page-number"></span>)</span>
        </div>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none min-h-[297mm] relative text-black print:w-full">
        
        <div className="first-page-header-cover hidden"></div>

        <div className="p-[20mm]">
          
          <div className="border border-black grid grid-cols-[180px_1fr_200px] items-stretch mb-4">
            <div className="border-r border-black p-1 flex items-center justify-center text-center overflow-hidden">
              <img 
                src="/logo_md.png" 
                alt="Ministério da Defesa" 
                className="max-h-24 w-auto object-contain"
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
              <p className="mt-2">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div style={bodyStyle}>
            
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
                    className="w-full"
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

              {!showItemsTable ? (
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <p className="text-slate-600 font-medium font-sans">Para os dados da descrição dos itens pressionar o botão abaixo:</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsImporterOpen(true)}
                    className="print:hidden border-primary text-primary hover:bg-primary/5 font-sans"
                  >
                    <Download className="h-4 w-4 mr-2" /> Importar e Agrupar Dados do P Trab
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_60px_140px_1fr] border-b border-black font-bold text-center text-[10pt]">
                    <div className="border-r border-black py-0 px-1">UGE</div>
                    <div className="border-r border-black py-0 px-1">GND</div>
                    <div className="border-r border-black py-0 px-1">VALOR</div>
                    <div className="py-0 px-1">Descrição</div>
                  </div>

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
                  
                  <div className="p-2 text-center print:hidden border-t border-black bg-slate-50">
                    <Button 
                      variant="ghost" 
                      size="xs" 
                      onClick={() => setIsImporterOpen(true)}
                      className="text-primary hover:text-primary/80 font-sans text-[10px] uppercase font-bold"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" /> Refazer Agrupamento
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase relative group"
                style={headerTitleStyle}
              >
                FINALIDADE
                <button 
                  onClick={importFinalidadeFromPtrab}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded transition-colors print:hidden opacity-0 group-hover:opacity-100"
                  title="Importar do P-Trab"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
              <div className="p-1 px-2">
                <DocumentTextArea 
                  value={formData.finalidade}
                  onChange={(e: any) => setFormData({...formData, finalidade: e.target.value})}
                  placeholder="Msg Op nº 196 - CCOp/CMN, de 15 ABR 24."
                  style={bodyStyle}
                />
              </div>
            </div>

            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                MOTIVAÇÃO
              </div>
              <div className="p-1 px-2">
                <DocumentTextArea 
                  value={formData.motivacao}
                  onChange={(e: any) => setFormData({...formData, motivacao: e.target.value})}
                  placeholder="Msg Op nº 196 - CCOp/CMN, de 15 ABR 24."
                  style={bodyStyle}
                />
              </div>
            </div>

            <div className="border border-black mb-4">
              <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                CONSEQUÊNCIA DO NÃO ATENDIMENTO
              </div>
              <div className="p-1 px-2">
                <DocumentTextArea 
                  value={formData.consequencia}
                  onChange={(e: any) => setFormData({...formData, consequencia: e.target.value})}
                  placeholder="- Possível inviabilidade de atuação da tropa nas atividades/tarefas/ações na Operação (COP 30) por ausência de suporte logístico."
                  style={bodyStyle}
                />
              </div>
            </div>

            <div className="border border-black mb-4">
               <div 
                className="border-b border-black p-0.5 font-bold text-center uppercase"
                style={headerTitleStyle}
              >
                OBSERVAÇÕES GERAIS
              </div>
              <div className="p-1 px-2">
                <DocumentTextArea 
                  value={formData.observacoes}
                  onChange={(e: any) => setFormData({...formData, observacoes: e.target.value})}
                  placeholder={`1. Os valores e cálculos apresentados nesse DOR Complementar consideram as informações passadas pelo CCOp/CMN do aumento do efetivo a ser apoiado de 150 (cento e cinquenta) agentes, nos meses de maio, junho e julho de 2025.
2. Não há nesse DOR valores referentes ao emprego de aeronaves e embarcações em ações conduzidas sob a responsabilidade dos órgãos de Governo encarregados da Operação. Todos os valores solicitados nesse DOR consideram apenas missões de apoio logístico a ser prestada na Base de Operações, a semelhança do que ocorreu na Operação ARARIBOIA, MUNDURUKU, APYTEREWA e TRINCHEIRA BACAJÁ.
3. As memórias de cálculo detalhadas e parametrizadas das despesas custeadas serão mantidas em arquivos próprios.
4. O bem e/ou serviço requisitado estará de acordo com a “Descrição” da Ação Orçamentária adotada pelo MD e com a “Caracterização” do respectivo PO do Cadastro de Ações do Sistema Integrado de Planejamento e Orçamento (SIOP).
5. Os saldos não aplicados serão restituídos ao EMCFA com tempestividade.
6. Serão observados os potenciais riscos nas aquisições de bens e serviços da Mensagem SIAFI nº 2021/0612168, de 17 de novembro de 2021, item 1.
7. Considerando que não há uma definição exata da missão a ser executada, atividades logísticas que serão demandadas, eixos que serão utilizados pelos elementos apoiados (terrestres, fluviais e/ou aéreos), locais de instalações de bases e o efetivo de órgãos a serem apoiados, os valores poderão variar para mais ou para menos, exigindo a retificação do DOR, documentações e/ou planos complementares.`}
                  style={bodyStyle}
                />
              </div>
            </div>

          </div>

          <div className="mt-4 border border-black p-1 flex flex-col items-center min-h-[150px] justify-between" style={bodyStyle}>
            <div className="text-center w-full pt-1">
              <p>{ptrab?.local_om || "Local não informado"}, {dataAtual}.</p>
            </div>

            <div className="text-center pb-2">
              <p className="font-bold uppercase">{ptrab?.nome_cmt_om || "NOME DO ORDENADOR DE DESPESAS"}</p>
              <p>{ptrab?.nome_om_extenso || `Ordenador de Despesas da ${ptrab?.nome_om}`}</p>
            </div>
          </div>

        </div>
      </div>

      {ptrabId && (
        <PTrabImporter 
          isOpen={isImporterOpen}
          onClose={() => setIsImporterOpen(false)}
          ptrabId={ptrabId}
          onImportConcluded={handleImportConcluded}
        />
      )}

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