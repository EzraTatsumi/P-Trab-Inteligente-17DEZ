import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Check, 
  Search, 
  FileSpreadsheet,
  X,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Configuração do Worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ExtractedData {
  header: {
    pregao: string;
    unidade: string;
    objeto: string;
    ptrab_id?: string;
  };
  items: Array<{
    id: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
    confianca: 'alta' | 'baixa';
  }>;
  cardapio?: Array<{
    dia: string;
    refeicao: string;
    composicao: string;
  }>;
}

const ImportadorRelatorioPTrab = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'validation'>('upload');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [userOM, setUserOM] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Busca os dados da OM diretamente do usuário ou de uma tabela relacionada se houver
        // Por enquanto, vamos assumir que os dados virão do perfil se existissem, 
        // mas como om_id não existe em profiles, vamos buscar de p_trab anteriores ou usar default
        const { data: lastPTrab } = await supabase
          .from('p_trab')
          .select('nome_om, codug_om, comando_militar_area')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lastPTrab) {
          setUserOM(lastPTrab.nome_om);
          // Podemos armazenar outros metadados necessários aqui
        }
      }
    };
    fetchUserData();
  }, []);

  const handleHeaderChange = (field: keyof ExtractedData['header'], value: string) => {
    if (!extractedData) return;
    setExtractedData({
      ...extractedData,
      header: { ...extractedData.header, [field]: value }
    });
  };

  const handleItemChange = (id: string, field: string, value: string | number) => {
    if (!extractedData) return;
    const newItems = extractedData.items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantidade' || field === 'valorUnitario') {
          updatedItem.valorTotal = Number(updatedItem.quantidade) * Number(updatedItem.valorUnitario);
        }
        return updatedItem;
      }
      return item;
    });
    setExtractedData({ ...extractedData, items: newItems });
  };

  const handleSave = async () => {
    if (!extractedData) {
      toast.error("Dados incompletos.");
      return;
    }
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Criar o PTrab principal (usando a tabela 'p_trab' correta)
      const { data: ptrab, error: ptrabError } = await supabase
        .from('p_trab')
        .insert({
          user_id: user.id,
          nome_om: extractedData.header.unidade || "OM Importada",
          nome_operacao: extractedData.header.objeto || "Operação Importada",
          numero_ptrab: extractedData.header.pregao || "00/0000",
          comando_militar_area: "CMA", // Valor default ou extraído
          efetivo_empregado: "0",
          periodo_inicio: new Date().toISOString().split('T')[0],
          periodo_fim: new Date().toISOString().split('T')[0],
          status: 'rascunho',
          origem: 'importacao'
        })
        .select()
        .single();

      if (ptrabError) throw ptrabError;

      // 2. Salvar os itens na tabela material_consumo_registros
      // Nota: Esta tabela exige campos como organizacao, ug, group_name
      const itemsToInsert = extractedData.items.map(item => ({
        p_trab_id: ptrab.id,
        organizacao: ptrab.nome_om,
        ug: "000000", // Valor default
        group_name: "Importado via PDF/Excel",
        fase_atividade: "Execução",
        categoria_item: "Consumo",
        descricao: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        dias_operacao: 1,
        efetivo: 1
      }));

      const { error: itemsError } = await supabase
        .from('material_consumo_registros')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("PTrab importado e criado com sucesso!");
      navigate(`/ptrab/form?id=${ptrab.id}`);
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(`Erro ao salvar: ${error.message || "Tente novamente."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    setFile(file);
    setIsProcessing(true);
    
    try {
      const fileType = file.name.split('.').pop()?.toLowerCase();
      
      if (fileType === 'pdf') {
        await processPDF(file);
      } else if (['xlsx', 'xls'].includes(fileType || '')) {
        await processExcel(file);
      } else {
        toast.error("Formato de arquivo não suportado. Use PDF ou Excel.");
      }
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar o arquivo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const processPDF = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    
    // Extração Inteligente com Regex
    const pregaoMatch = fullText.match(/(?:Pregão|PE|PR)\s*(?:nº|nr|n)?\s*(\d+[\/\-]\d+)/i);
    const unidadeMatch = fullText.match(/(?:Unidade|UASG|Órgão|OM)\s*[:\-]?\s*([^\n,.]+)/i);
    const objetoMatch = fullText.match(/(?:Objeto|Finalidade)\s*[:\-]?\s*([^\n.]+)/i);

    // Tenta extrair itens (Padrão: Número Descrição Quantidade ValorUnitario ValorTotal)
    const itemRegex = /(\d+)\s+([A-Z\s,.-]{10,})\s+(\d+(?:[.,]\d+)?)\s+(?:R\$?\s*)?(\d+(?:[.,]\d+)?)\s+(?:R\$?\s*)?(\d+(?:[.,]\d+)?)/gi;
    const items: Array<any> = [];
    let match;
    
    while ((match = itemRegex.exec(fullText)) !== null) {
      items.push({
        id: Math.random().toString(36).substr(2, 9),
        descricao: match[2].trim(),
        quantidade: parseFloat(match[3].replace(',', '.')),
        valorUnitario: parseFloat(match[4].replace(',', '.')),
        valorTotal: parseFloat(match[5].replace(',', '.')),
        confianca: 'alta'
      });
    }

    // Se não encontrou itens pelo padrão rígido, tenta um mais flexível
    if (items.length === 0) {
      const lines = fullText.split('\n');
      lines.forEach(line => {
        if (line.length > 20 && line.match(/\d+/)) {
          items.push({
            id: Math.random().toString(36).substr(2, 9),
            descricao: line.substring(0, 50).trim(),
            quantidade: 0,
            valorUnitario: 0,
            valorTotal: 0,
            confianca: 'baixa'
          });
        }
      });
    }
    
    setExtractedData({
      header: {
        pregao: pregaoMatch ? pregaoMatch[1] : "",
        unidade: unidadeMatch ? unidadeMatch[1].trim() : "",
        objeto: objetoMatch ? objetoMatch[1].trim() : ""
      },
      items: items.slice(0, 20) // Limitado para validação
    });
    setStep('validation');
  };

  const processExcel = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    let header = { pregao: "", unidade: "", objeto: "" };
    const items: any[] = [];

    jsonData.forEach((row: any[]) => {
      const rowStr = row.join(" ");
      
      // Busca cabeçalho nas linhas
      if (!header.pregao && rowStr.match(/pregão/i)) {
        const m = rowStr.match(/(\d+[\/\-]\d+)/);
        if (m) header.pregao = m[1];
      }

      // Tenta identificar linhas de itens (geralmente começam com número e tem descrição longa)
      if (row.length >= 4 && !isNaN(parseFloat(row[0]))) {
        items.push({
          id: Math.random().toString(36).substr(2, 9),
          descricao: String(row[1] || ""),
          quantidade: parseFloat(row[2]) || 0,
          valorUnitario: parseFloat(row[3]) || 0,
          valorTotal: parseFloat(row[4]) || (parseFloat(row[2]) * parseFloat(row[3])) || 0,
          confianca: row[1] ? 'alta' : 'baixa'
        });
      }
    });
    
    setExtractedData({ header, items });
    setStep('validation');
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Importador de Relatório PTrab</h1>
      </div>

      {step === 'upload' ? (
        <div className="grid gap-6">
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                {isProcessing ? (
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                ) : (
                  <Upload className="h-12 w-12 text-primary" />
                )}
              </div>
              <CardTitle className="mb-2 text-2xl">
                {isProcessing ? "Processando documento..." : "Upload de Relatório"}
              </CardTitle>
              <CardDescription className="text-center max-w-md mb-6">
                Arraste seu arquivo PDF ou Excel aqui, ou clique para selecionar. 
                O sistema tentará extrair automaticamente os itens e valores.
              </CardDescription>
              
              {!isProcessing && (
                <div className="flex flex-col items-center gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.xls,.xlsx"
                    className="hidden"
                  />
                  <Button onClick={() => fileInputRef.current?.click()} size="lg">
                    Selecionar Arquivo
                  </Button>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center"><FileText className="h-4 w-4 mr-1" /> PDF</span>
                    <span className="flex items-center"><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
            <Search className="h-4 w-4 text-blue-600" />
            <AlertTitle>Como funciona?</AlertTitle>
            <AlertDescription>
              Nossa tecnologia de extração identifica automaticamente o número do pregão, 
              unidade, itens e valores. Após o processamento, você poderá revisar e 
              corrigir qualquer dado antes de salvar no Supabase.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lado Esquerdo: Visualização ou Dados Brutos */}
          <Card className="h-[calc(100vh-250px)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Documento Original</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                <X className="h-4 w-4 mr-2" /> Alterar Arquivo
              </Button>
            </CardHeader>
            <CardContent className="h-full overflow-hidden p-0 flex items-center justify-center bg-muted/20">
              <div className="text-center p-8">
                <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Visualização em tempo real do PDF será implementada em breve.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lado Direito: Formulário de Validação */}
          <Card className="h-[calc(100vh-250px)] overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-lg">Revisão e Validação</CardTitle>
              <CardDescription>
                Confira os dados extraídos. Campos com <span className="text-amber-600 font-bold">borda amarela</span> indicam baixa confiança na extração automática.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 pb-20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pregao">Número do Pregão</Label>
                    <Input 
                      id="pregao"
                      value={extractedData?.header.pregao || ""} 
                      onChange={(e) => handleHeaderChange('pregao', e.target.value)}
                      placeholder="Ex: 01/2024"
                      title="Número do Pregão"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Input 
                      id="unidade"
                      value={extractedData?.header.unidade || ""} 
                      onChange={(e) => handleHeaderChange('unidade', e.target.value)}
                      placeholder="Ex: Batalhão de Suprimento"
                      title="Unidade Requisitante"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="objeto">Objeto da Importação</Label>
                  <Input 
                    id="objeto"
                    value={extractedData?.header.objeto || ""} 
                    onChange={(e) => handleHeaderChange('objeto', e.target.value)}
                    placeholder="Ex: Aquisição de Gêneros Alimentícios"
                    title="Objeto do Relatório"
                  />
                </div>

                <div className="mt-8">
                  <h3 className="font-semibold mb-4 flex items-center">
                    Itens Identificados ({extractedData?.items.length || 0})
                  </h3>
                  <div className="space-y-4">
                    {extractedData?.items.map((item) => (
                      <div 
                        key={item.id} 
                        className={cn(
                          "p-4 rounded-lg border bg-card shadow-sm",
                          item.confianca === 'baixa' ? "border-amber-400 ring-1 ring-amber-400/50" : "border-border"
                        )}
                      >
                        <div className="grid gap-3">
                          <div className="space-y-1">
                            <Label htmlFor={`desc-${item.id}`} className="text-xs">Descrição do Item</Label>
                            <Input 
                              id={`desc-${item.id}`}
                              value={item.descricao} 
                              onChange={(e) => handleItemChange(item.id, 'descricao', e.target.value)}
                              className="font-medium" 
                              placeholder="Descrição do item" 
                              title="Descrição do Item"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label htmlFor={`qtd-${item.id}`} className="text-xs">Qtd</Label>
                              <Input 
                                id={`qtd-${item.id}`}
                                type="number" 
                                value={item.quantidade} 
                                onChange={(e) => handleItemChange(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                title="Quantidade"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`unit-${item.id}`} className="text-xs">Unitário (R$)</Label>
                              <Input 
                                id={`unit-${item.id}`}
                                type="number" 
                                value={item.valorUnitario} 
                                onChange={(e) => handleItemChange(item.id, 'valorUnitario', parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                title="Valor Unitário"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`total-${item.id}`} className="text-xs">Total (R$)</Label>
                              <Input 
                                id={`total-${item.id}`}
                                type="number" 
                                value={item.valorTotal.toFixed(2)} 
                                disabled 
                                placeholder="0.00"
                                title="Valor Total"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-4">
                <Button className="flex-1" variant="outline" onClick={() => setStep('upload')}>
                  Cancelar
                </Button>
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirmar e Transmitir
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ImportadorRelatorioPTrab;
