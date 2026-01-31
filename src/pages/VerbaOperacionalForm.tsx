import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save, CheckCircle, XCircle, MessageSquare, Printer, Copy, GitBranch, Users, Share2, Link, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePTrabContext, PTrabProvider } from "@/pages/ptrab/PTrabContext";
import { usePTrabData } from "@/hooks/usePTrabData";
import { useSession } from "@/components/SessionContextProvider";
import { sanitizeError } from "@/lib/errorUtils";
import { formatCurrency } from "@/lib/utils";
import { usePTrabRecords } from "@/hooks/usePTrabRecords";
import { useDiretrizesOperacionais } from "@/hooks/useDiretrizesOperacionais";
import { useUserCredits } from "@/hooks/useUserCredits";
import { updateUserCredits } from "@/lib/creditUtils";
import { CreditPromptDialog } from "@/components/CreditPromptDialog";
import { HelpDialog } from "@/components/HelpDialog";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { generateUniqueMinutaNumber, generateVariationPTrabNumber } from "@/lib/ptrabNumberUtils";
import { TablesInsert } from "@/integrations/supabase/types";
import VerbaOperacionalFormContent from "@/pages/ptrab/components/forms/VerbaOperacionalForm"; // Componente de conteúdo

// =================================================================
// TIPOS E CONSTANTES
// =================================================================

const TABS = [
  { id: "verba_operacional", label: "Verba Operacional" },
  // Adicione outras abas se houver mais seções
];

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

const VerbaOperacionalPageContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const { user } = useSession();
  
  const { ptrabData, loading: isPTrabLoading, refetch: refetchPTrabData } = usePTrabData(ptrabId);
  const { setLoading, setGlobalError, loading: isGlobalLoading } = usePTrabContext();
  
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [isPTrabEditable, setIsPTrabEditable] = useState(false);
  
  // Estados para o diálogo de comentário
  const [showComentarioDialog, setShowComentarioDialog] = useState(false);
  const [comentarioText, setComentarioText] = useState("");
  
  // Estados para o diálogo de clonagem
  const [showCloneOptionsDialog, setShowCloneOptionsDialog] = useState(false);
  const [cloneType, setCloneType] = useState<'new' | 'variation'>('new');
  const [suggestedCloneNumber, setSuggestedCloneNumber] = useState<string>("");
  const [showCloneVariationDialog, setShowCloneVariationDialog] = useState(false);
  
  // Créditos
  const { data: credits, isLoading: isCreditsLoading, refetch: refetchCredits } = useUserCredits(user?.id);
  const [showCreditPrompt, setShowCreditPrompt] = useState(false);
  const [isCalculationReady, setIsCalculationReady] = useState(false); // Estado para habilitar o botão Salvar

  // =================================================================
  // LÓGICA DE DADOS E ESTADO
  // =================================================================

  useEffect(() => {
    if (ptrabData) {
      const isOwner = ptrabData.user_id === user?.id;
      const isShared = (ptrabData.shared_with || []).includes(user?.id);
      const isFinalStatus = ptrabData.status === 'aprovado' || ptrabData.status === 'arquivado';
      
      setIsPTrabEditable((isOwner || isShared) && !isFinalStatus);
      setComentarioText(ptrabData.comentario || "");
    }
  }, [ptrabData, user?.id]);
  
  // Simulação de cálculo pronto (para fins de demonstração do botão Salvar)
  useEffect(() => {
      // Em um cenário real, você teria que verificar se todos os sub-formulários estão válidos
      // Por enquanto, apenas verifica se o PTrab está carregado
      if (ptrabData) {
          setIsCalculationReady(true);
      }
  }, [ptrabData]);

  const handleSavePTrab = async () => {
    if (!ptrabId || !ptrabData) return;
    
    setIsSaving(true);
    setLoading(true);

    try {
      // Aqui você faria a lógica de salvar os dados de todas as classes
      // Como este é um formulário de classe única, apenas atualizamos o timestamp do PTrab
      
      const { error } = await supabase
        .from("p_trab")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ptrabId);

      if (error) throw error;

      toast.success("P Trab salvo com sucesso!");
      await refetchPTrabData();
      
    } catch (error: any) {
      setGlobalError("Erro ao salvar P Trab: " + sanitizeError(error));
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };
  
  const handleSaveComentario = async () => {
    if (!ptrabId) return;

    try {
      const { error } = await supabase
        .from('p_trab')
        .update({ comentario: comentarioText || null }) 
        .eq('id', ptrabId);

      if (error) throw error;

      toast.success("Comentário salvo com sucesso!");
      setShowComentarioDialog(false);
      await refetchPTrabData();
    } catch (error) {
      console.error("Erro ao salvar comentário:", error);
      toast.error("Erro ao salvar comentário. Tente novamente.");
    }
  };
  
  // =================================================================
  // LÓGICA DE CLONAGEM (MANTIDA SIMPLIFICADA)
  // =================================================================
  
  const handleOpenCloneOptions = () => {
    if (!ptrabData) return;
    
    // Simulação de busca de números existentes (em um app real, viria do PTrabManager)
    const existingNumbers = ["Minuta 1", "Minuta 2"]; 
    const newSuggestedNumber = generateUniqueMinutaNumber(existingNumbers);
    
    setSuggestedCloneNumber(newSuggestedNumber);
    setCloneType('new');
    setShowCloneOptionsDialog(true);
  };

  const handleConfirmCloneOptions = () => {
    if (!ptrabData) return;

    if (cloneType === 'new') {
      // Navega para o formulário principal para clonar o cabeçalho
      navigate(`/ptrab/form?cloneId=${ptrabData.id}`);
    } else {
      setShowCloneOptionsDialog(false);
      setShowCloneVariationDialog(true);
    }
  };
  
  const handleConfirmCloneVariation = async (versionName: string) => {
    if (!ptrabData || !user?.id) return;
    
    setShowCloneVariationDialog(false);
    setLoading(true);

    try {
        // Simulação de criação de variação (apenas atualiza o rótulo e cria um novo PTrab)
        const { 
            id, created_at, updated_at, user_id, share_token, shared_with,
            ...restOfPTrab 
        } = ptrabData;
        
        const newPTrabData: TablesInsert<'p_trab'> = {
            ...restOfPTrab,
            user_id: user.id,
            numero_ptrab: generateVariationPTrabNumber(ptrabData.numero_ptrab, suggestedCloneNumber),
            status: "aberto",
            origem: ptrabData.origem,
            comentario: null,
            rotulo_versao: versionName,
        };

        const { data: newPTrab, error: insertError } = await supabase
            .from("p_trab")
            .insert([newPTrabData])
            .select('id')
            .single();
            
        if (insertError || !newPTrab) throw insertError;
        
        // Em um cenário real, a clonagem dos registros de classe ocorreria aqui.
        
        await updateUserCredits(user.id, 0, 0);
        
        toast.success(`Variação "${versionName}" criada!`);
        navigate(`/ptrab/verba-operacional?ptrabId=${newPTrab.id}`);
        
    } catch (error: any) {
        console.error("Erro ao clonar variação:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  // =================================================================
  // RENDERIZAÇÃO
  // =================================================================

  if (isPTrabLoading || isGlobalLoading || isCreditsLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!ptrabData) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">P Trab não encontrado ou acesso negado.</h1>
        <Button onClick={() => navigate("/ptrab")} className="mt-4">
          Voltar para o Gerenciador
        </Button>
      </div>
    );
  }
  
  const isOwner = ptrabData.user_id === user?.id;
  const isShared = (ptrabData.shared_with || []).includes(user?.id);
  const isFinalStatus = ptrabData.status === 'aprovado' || ptrabData.status === 'arquivado';
  
  const statusConfig = {
    'aberto': { label: 'Aberto', className: 'bg-yellow-500 text-white' },
    'em_andamento': { label: 'Em Andamento', className: 'bg-blue-600 text-white' },
    'aprovado': { label: 'Aprovado', className: 'bg-green-600 text-white' },
    'arquivado': { label: 'Arquivado', className: 'bg-gray-500 text-white' }
  };
  
  const currentStatus = statusConfig[ptrabData.status as keyof typeof statusConfig] || statusConfig.aberto;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabeçalho e Ações */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate("/ptrab")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {ptrabData.numero_ptrab} - {ptrabData.nome_operacao}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{ptrabData.nome_om}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${currentStatus.className}`}>
                  {currentStatus.label}
                </span>
                {ptrabData.rotulo_versao && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground flex items-center">
                        <GitBranch className="h-3 w-3 mr-1" />
                        {ptrabData.rotulo_versao}
                    </span>
                )}
                {isShared && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white flex items-center">
                        <Share2 className="h-3 w-3 mr-1" />
                        Compartilhado
                    </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => navigate(`/ptrab/print?ptrabId=${ptrabId}`)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Visualizar Impressão</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => setShowComentarioDialog(true)}
                  >
                    <MessageSquare className={`h-4 w-4 ${ptrabData.comentario ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Comentário</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleOpenCloneOptions}
                    disabled={isFinalStatus}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clonar P Trab</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <HelpDialog />
            
            <div className="flex justify-end gap-3 pt-4">
                <Button 
                    type="submit" 
                    onClick={handleSavePTrab}
                    disabled={!isPTrabEditable || isSaving || !isCalculationReady}
                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                >
                    {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSaving ? "Salvando..." : "Salvar P Trab"}
                </Button>
            </div>
          </div>
        </div>
        
        <Separator />
        
        {/* Navegação por Abas (Seções) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-1">
            {TABS.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Conteúdo das Abas - Adicionando forceMount */}
          <TabsContent value="verba_operacional" className="mt-4" forceMount>
            <VerbaOperacionalFormContent />
          </TabsContent>
          
          {/* Adicione TabsContent para outras seções aqui, se houver */}
          
        </Tabs>
        
      </div>
      
      {/* Diálogo de Comentário */}
      <Dialog open={showComentarioDialog} onOpenChange={setShowComentarioDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comentário do P Trab</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {ptrabData.numero_ptrab} - {ptrabData.nome_operacao}
            </p>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Digite seu comentário sobre este P Trab..."
              value={comentarioText}
              onChange={(e) => setComentarioText(e.target.value)}
              className="min-h-[150px]"
              disabled={!isPTrabEditable}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleSaveComentario} disabled={!isPTrabEditable}>
              Salvar
            </Button>
            <Button variant="outline" onClick={() => setShowComentarioDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Opções de Clonagem */}
      <Dialog open={showCloneOptionsDialog} onOpenChange={setShowCloneOptionsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Plano de Trabalho</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Clonando: <span className="font-medium">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</span>
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <RadioGroup 
              value={cloneType} 
              onValueChange={(value: 'new' | 'variation') => setCloneType(value)}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="clone-new"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem id="clone-new" value="new" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Novo P Trab</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria um P Trab totalmente novo, iniciando como Minuta para posterior numeração.
                </p>
              </Label>
              <Label
                htmlFor="clone-variation"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem id="clone-variation" value="variation" className="sr-only" />
                <span className="mb-3 text-lg font-semibold">Variação do Trabalho</span>
                <p className="text-sm text-muted-foreground text-center">
                  Cria uma variação do P Trab atual, gerando um novo número de Minuta.
                </p>
              </Label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleConfirmCloneOptions}>Continuar</Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Variação do Trabalho (Simulado) */}
      <Dialog open={showCloneVariationDialog} onOpenChange={setShowCloneVariationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Variação</DialogTitle>
            <DialogDescription>
              Crie um rótulo para a nova versão do P Trab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="version-name">Rótulo da Versão</Label>
            <Input id="version-name" placeholder="Ex: Versão 1.1 - Ajuste de Efetivo" />
          </div>
          <DialogFooter>
            <Button onClick={() => handleConfirmCloneVariation("Versão Clonada")}>Criar Variação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Crédito */}
      <CreditPromptDialog
        open={showCreditPrompt}
        onConfirm={() => setShowCreditPrompt(false)}
        onCancel={() => setShowCreditPrompt(false)}
      />
      
    </div>
  );
};

// Wrapper para o Contexto
const VerbaOperacionalForm = () => {
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  return (
    <PTrabProvider>
      <VerbaOperacionalPageContent />
    </PTrabProvider>
  );
};

export default VerbaOperacionalForm;