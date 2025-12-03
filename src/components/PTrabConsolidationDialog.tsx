import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Check, FileText, ArrowRight, Plus, AlertCircle, ChevronsUpDown, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { generateUniqueMinutaNumber } from "@/lib/ptrabNumberUtils"; // Importar apenas a função de Minuta
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SimplePTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
}

interface PTrabConsolidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pTrabsList: SimplePTrab[];
  existingPTrabNumbers: string[];
  onConfirm: (
    sourcePTrabIds: string[],
    targetPTrabId: string | 'new',
    newPTrabNumber?: string,
    templatePTrabId?: string // Novo parâmetro para o ID do template
  ) => void;
  loading: boolean;
}

const PTrabConsolidationDialog = ({
  open,
  onOpenChange,
  pTrabsList,
  existingPTrabNumbers,
  onConfirm,
  loading,
}: PTrabConsolidationDialogProps) => {
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | 'new'>('new');
  const [templatePTrabId, setTemplatePTrabId] = useState<string>(''); // Estado para o template
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSourcePopoverOpen, setIsSourcePopoverOpen] = useState(false);
  const [isTargetPopoverOpen, setIsTargetPopoverOpen] = useState(false);

  const availableSourcePTrabs = pTrabsList.filter(p => p.id !== targetId);
  const availableTargetPTrabs = pTrabsList.filter(p => !sourceIds.includes(p.id));

  // Gera o número de minuta sugerido (apenas para exibição/uso interno)
  const suggestedNewNumber = useMemo(() => {
    return generateUniqueMinutaNumber(existingPTrabNumbers);
  }, [existingPTrabNumbers]);

  useEffect(() => {
    if (open) {
      setSourceIds([]);
      setTargetId('new');
      setTemplatePTrabId(''); // Resetar template
      
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      }, 50);
    }
  }, [open, suggestedNewNumber]);

  // Atualiza o template ID quando a lista de origem muda, se o template atual não for mais válido
  useEffect(() => {
    if (sourceIds.length > 0 && !sourceIds.includes(templatePTrabId)) {
      setTemplatePTrabId(sourceIds[0]); // Define o primeiro selecionado como padrão
    } else if (sourceIds.length === 0) {
      setTemplatePTrabId('');
    }
  }, [sourceIds, templatePTrabId]);

  const handleToggleSource = (id: string) => {
    setSourceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleTargetChange = (id: string | 'new') => {
    setTargetId(id);
    setSourceIds(prev => prev.filter(i => i !== id));
    setIsTargetPopoverOpen(false);
  };

  const handleConfirm = () => {
    if (sourceIds.length === 0) {
      toast.error("Selecione pelo menos um P Trab de origem.");
      return;
    }

    if (targetId === 'new') {
      if (!templatePTrabId) {
        toast.error("Selecione um P Trab para usar como template de cabeçalho.");
        return;
      }
      
      // Gera o número de minuta único no momento da confirmação
      const newPTrabNumber = generateUniqueMinutaNumber(existingPTrabNumbers);
      
      onConfirm(sourceIds, 'new', newPTrabNumber, templatePTrabId);
    } else {
      onConfirm(sourceIds, targetId);
    }
  };
  
  const selectedTargetPTrab = targetId !== 'new' ? pTrabsList.find(p => p.id === targetId) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        ref={contentRef}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Consolidar Planos de Trabalho
          </DialogTitle>
          <DialogDescription>
            Selecione os P Trabs de origem (que fornecerão os dados) e o P Trab de destino (que receberá os dados).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
          {/* Coluna 1: P Trab de Origem */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              P Trab de Origem ({sourceIds.length})
            </Label>
            <p className="text-sm text-muted-foreground">
              Os registros de Classes I, II e III destes P Trabs serão copiados.
            </p>
            
            <Popover open={isSourcePopoverOpen} onOpenChange={setIsSourcePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isSourcePopoverOpen}
                  className="w-full justify-between h-auto py-2"
                >
                  {sourceIds.length === 0 ? (
                    "Selecione os P Trab..."
                  ) : (
                    <span className="truncate">
                      {sourceIds.map(id => pTrabsList.find(p => p.id === id)?.numero_ptrab).join(', ')}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar P Trab de origem..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>Nenhum P Trab disponível.</CommandEmpty>
                    <CommandGroup>
                      {availableSourcePTrabs.map((ptrab) => (
                        <CommandItem
                          key={ptrab.id}
                          value={`${ptrab.numero_ptrab} ${ptrab.nome_operacao}`}
                          onSelect={() => handleToggleSource(ptrab.id)}
                          className={cn(
                            "cursor-pointer",
                            sourceIds.includes(ptrab.id) && "bg-primary/10 text-primary"
                          )}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              sourceIds.includes(ptrab.id) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{ptrab.numero_ptrab}</span>
                            <span className="text-xs text-muted-foreground">{ptrab.nome_operacao}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* Lista de P Trabs selecionados (visível abaixo do Popover) */}
            {sourceIds.length > 0 && (
              <div className="space-y-2 max-h-[150px] overflow-y-auto p-2 border rounded-lg bg-background">
                {sourceIds.map(id => {
                  const ptrab = pTrabsList.find(p => p.id === id);
                  return ptrab ? (
                    <div key={id} className="flex items-center justify-between text-sm p-1 rounded bg-muted/50">
                      <span className="font-medium">{ptrab.numero_ptrab}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => handleToggleSource(id)}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Coluna 2: P Trab de Destino */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              P Trab de Destino
            </Label>
            <p className="text-sm text-muted-foreground">
              O P Trab que receberá os novos registros.
            </p>
            
            <div className="space-y-4">
              {/* Opção 1: Novo P Trab */}
              <div 
                className={cn(
                  "p-4 border rounded-lg cursor-pointer transition-colors",
                  targetId === 'new' ? "border-primary ring-2 ring-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                )}
                onClick={() => handleTargetChange('new')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Criar Novo P Trab (Minuta)</span>
                  </div>
                  {targetId === 'new' && <Check className="h-4 w-4 text-primary" />}
                </div>
                
                {targetId === 'new' && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      O novo P Trab será criado como Minuta ({suggestedNewNumber}) e terá o status "Aberto".
                    </p>

                    {/* CAMPO: Template de Cabeçalho */}
                    <div className="space-y-2">
                      <Label htmlFor="template-ptrab" className="text-sm">Aproveitar Cabeçalho e Rodapé de *</Label>
                      <Select
                        value={templatePTrabId}
                        onValueChange={setTemplatePTrabId}
                        disabled={sourceIds.length === 0}
                      >
                        <SelectTrigger id="template-ptrab">
                          <SelectValue placeholder="Selecione um P Trab de origem..." />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceIds.map(id => {
                            const ptrab = pTrabsList.find(p => p.id === id);
                            return ptrab ? (
                              <SelectItem key={id} value={id}>
                                {ptrab.numero_ptrab} - {ptrab.nome_operacao}
                              </SelectItem>
                            ) : null;
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Os dados da Operação, OM, C Mil A, Período, Efetivo, Comandante e Local serão copiados deste P Trab.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Opção 2: Selecionar Existente */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ou selecione um P Trab existente:</Label>
                
                <Popover open={isTargetPopoverOpen} onOpenChange={setIsTargetPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isTargetPopoverOpen}
                      className={cn(
                        "w-full justify-between h-auto py-2",
                        targetId !== 'new' ? "border-primary ring-2 ring-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => targetId !== 'new' && handleTargetChange('new')} // Desseleciona se já estiver selecionado
                    >
                      {selectedTargetPTrab ? (
                        <span className="truncate">{selectedTargetPTrab.numero_ptrab} - {selectedTargetPTrab.nome_operacao}</span>
                      ) : (
                        <span className="text-muted-foreground">Selecione o P Trab de destino...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar P Trab existente..." />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhum P Trab disponível.</CommandEmpty>
                        <CommandGroup>
                          {availableTargetPTrabs.map((ptrab) => (
                            <CommandItem
                              key={ptrab.id}
                              value={`${ptrab.numero_ptrab} ${ptrab.nome_operacao}`}
                              onSelect={() => handleTargetChange(ptrab.id)}
                              className={cn(
                                "cursor-pointer",
                                targetId === ptrab.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                              )}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  targetId === ptrab.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{ptrab.numero_ptrab}</span>
                                <span className="text-xs text-muted-foreground">{ptrab.nome_operacao}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Exibir detalhes do P Trab selecionado se não for 'new' */}
                {targetId !== 'new' && selectedTargetPTrab && (
                    <div className="mt-2 p-2 border rounded-lg bg-muted/50 text-sm">
                        <p className="font-medium">Destino: {selectedTargetPTrab.numero_ptrab}</p>
                        <p className="text-xs text-muted-foreground">Operação: {selectedTargetPTrab.nome_operacao}</p>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading || sourceIds.length === 0 || (targetId === 'new' && !templatePTrabId)}
          >
            {loading ? "Consolidando..." : `Consolidar ${sourceIds.length} P Trab(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PTrabConsolidationDialog;