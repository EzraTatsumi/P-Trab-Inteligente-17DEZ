import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Check, XCircle, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tables } from "@/integrations/supabase/types";
import { generateUniquePTrabNumber, isPTrabNumberDuplicate } from "@/lib/ptrabNumberUtils";
import { OmSelector } from "./OmSelector";
import { OMData } from "@/lib/omUtils";

interface ImportPTrabOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importedPTrab: Tables<'p_trab'>;
  existingPTrabNumbers: string[];
  userOms: OMData[]; // Lista de OMs do usuário
  onConfirmImport: (newPTrabData: Tables<'p_trab'>) => void;
}

export const ImportPTrabOptionsDialog = ({
  open,
  onOpenChange,
  importedPTrab,
  existingPTrabNumbers,
  userOms,
  onConfirmImport,
}: ImportPTrabOptionsDialogProps) => {
  const [selectedOm, setSelectedOm] = useState<OMData | undefined>(undefined);
  const [customPTrabNumber, setCustomPTrabNumber] = useState(importedPTrab.numero_ptrab);
  const [loading, setLoading] = useState(false);

  const importedOmName = importedPTrab.nome_om;
  const originalPTrabNumber = importedPTrab.numero_ptrab;

  // 1. Lógica de Análise de Numeração
  const analysis = useMemo(() => {
    const targetOmName = selectedOm?.nome_om;
    let suggestedNumber = originalPTrabNumber;
    let isConflict = false;
    let message = "";

    if (!selectedOm) {
      message = "Selecione a OM de destino para analisar a numeração.";
      // Não há sugestão válida até que a OM seja selecionada
      suggestedNumber = ""; 
    } else {
      const isSameOm = importedOmName.trim().toLowerCase() === targetOmName!.trim().toLowerCase();

      if (isSameOm) {
        // Cenário 1: Mesma OM. Verificar conflito de número.
        isConflict = isPTrabNumberDuplicate(originalPTrabNumber, existingPTrabNumbers);

        if (isConflict) {
          suggestedNumber = generateUniquePTrabNumber(existingPTrabNumbers);
          message = `Conflito detectado! O P Trab original já existe. Foi sugerido o próximo número base único.`;
        } else {
          message = `OM de destino é a mesma. O número original será mantido.`;
          suggestedNumber = originalPTrabNumber;
        }
      } else {
        // Cenário 2: OM Diferente. Adicionar sufixo /OM_ORIGEM.
        const omSigla = importedOmName.trim().toUpperCase();
        const newNumberWithSuffix = `${originalPTrabNumber}/${omSigla}`;
        
        isConflict = isPTrabNumberDuplicate(newNumberWithSuffix, existingPTrabNumbers);
        
        if (isConflict) {
          suggestedNumber = generateUniquePTrabNumber(existingPTrabNumbers);
          message = `OM de destino diferente da original (${importedOmName}). O número proposto (${newNumberWithSuffix}) conflita. Foi sugerido o próximo número base único.`;
        } else {
          suggestedNumber = newNumberWithSuffix;
          message = `OM de destino diferente da original (${importedOmName}). Sugestão: ${newNumberWithSuffix}`;
        }
      }
    }

    return { isSameOm: !!selectedOm && importedOmName.trim().toLowerCase() === targetOmName!.trim().toLowerCase(), isConflict, suggestedNumber, message };
  }, [selectedOm, importedOmName, originalPTrabNumber, existingPTrabNumbers]);

  // 2. Efeito para preencher o campo com a sugestão quando a OM é selecionada
  useEffect(() => {
    if (open && selectedOm) {
      // Preenche o campo com a sugestão calculada
      setCustomPTrabNumber(analysis.suggestedNumber);
    } else if (open && !selectedOm) {
      // Limpa o campo se a OM for deselecionada
      setCustomPTrabNumber("");
    }
  }, [open, selectedOm, analysis.suggestedNumber]);


  const handleFinalConfirm = () => {
    if (!selectedOm) {
      toast.error("Selecione a OM de destino.");
      return;
    }
    if (!customPTrabNumber.trim()) {
      toast.error("O número do P Trab não pode ser vazio.");
      return;
    }
    
    // Final check for duplication before saving
    const isFinalNumberDuplicate = isPTrabNumberDuplicate(customPTrabNumber, existingPTrabNumbers);
    if (isFinalNumberDuplicate) {
        toast.error(`O número ${customPTrabNumber} já existe. Por favor, altere.`);
        return;
    }

    setLoading(true);
    
    // Prepare the final PTrab data with the new number and OM name
    const finalPTrabData = {
        ...importedPTrab,
        numero_ptrab: customPTrabNumber,
        nome_om: selectedOm.nome_om, // Usar o nome da OM selecionada
        comando_militar_area: selectedOm.rm_vinculacao, // Usar a RM como CMA (simplificação)
    };

    onConfirmImport(finalPTrabData);
    // O fechamento e o estado de loading são gerenciados pelo componente pai.
  };

  const isFinalNumberDuplicate = isPTrabNumberDuplicate(customPTrabNumber, existingPTrabNumbers);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Opções de Importação</DialogTitle>
          <DialogDescription>
            P Trab Original: <span className="font-medium">{originalPTrabNumber} - {importedOmName}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          
          {/* Passo 1: Seleção da OM de Destino */}
          <div className="space-y-2 p-3 border rounded-md bg-muted/50">
            <h4 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                1. Selecione a OM que está importando o P Trab
            </h4>
            <OmSelector
                selectedOmId={selectedOm?.id}
                onChange={setSelectedOm}
                placeholder="Selecione a OM que será a proprietária..."
                omsList={userOms} // Passar a lista de OMs
            />
            {selectedOm && (
                <p className="text-xs text-muted-foreground">
                    OM Selecionada: {selectedOm.nome_om} (UG: {selectedOm.codug_om})
                </p>
            )}
          </div>

          {/* Passo 2: Análise de Numeração */}
          {selectedOm && (
            <div className="space-y-3 p-3 border rounded-md bg-muted/50">
              <h4 className="font-semibold text-sm">2. Análise e Confirmação de Numeração</h4>
              
              <Alert variant={isFinalNumberDuplicate ? "destructive" : "default"}>
                {isFinalNumberDuplicate ? <XCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                <AlertDescription className="text-sm">
                  {analysis.message}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="custom-ptrab-number">Número Final do P Trab</Label>
                <Input
                  id="custom-ptrab-number"
                  value={customPTrabNumber}
                  onChange={(e) => setCustomPTrabNumber(e.target.value)}
                  placeholder={analysis.suggestedNumber}
                />
                {isFinalNumberDuplicate && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Este número já existe na sua lista. Por favor, altere.
                    </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleFinalConfirm} 
            disabled={loading || !selectedOm || isFinalNumberDuplicate || !customPTrabNumber.trim()}
          >
            {loading ? "Importando..." : "Confirmar Importação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};