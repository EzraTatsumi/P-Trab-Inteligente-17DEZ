import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplet, Check, XCircle } from "lucide-react";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { formatCurrencyInput, parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
import { toast } from 'sonner';

// Re-define ItemClasseIII structure needed here
interface ItemClasseIII {
  item: string;
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  consumo_lubrificante_litro: number;
  preco_lubrificante: number;
  preco_lubrificante_input: string;
  consumo_lubrificante_input: string;
  om_destino_lub: string;
  ug_destino_lub: string;
  selectedOmDestinoId_lub?: string;
}

interface LubricantConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemClasseIII;
  onConfirm: (updatedItem: ItemClasseIII) => void;
  loading: boolean;
}

export const LubricantConfigDialog: React.FC<LubricantConfigDialogProps> = ({
  open,
  onOpenChange,
  item,
  onConfirm,
  loading,
}) => {
  const [localItem, setLocalItem] = useState<ItemClasseIII>(item);

  useEffect(() => {
    if (open) {
      // Reset local state when dialog opens
      setLocalItem(item);
    }
  }, [open, item]);

  const handleNumericChange = (field: keyof ItemClasseIII, inputString: string) => {
    if (field === 'preco_lubrificante_input') {
      const digits = inputString.replace(/\D/g, '');
      const { numericValue } = formatCurrencyInput(digits);
      
      setLocalItem(prev => ({
        ...prev,
        preco_lubrificante_input: digits,
        preco_lubrificante: numericValue,
      }));
      return;
    }
    
    if (field === 'consumo_lubrificante_input') {
      const numericValue = parseInputToNumber(inputString);
      setLocalItem(prev => ({
        ...prev,
        consumo_lubrificante_input: inputString,
        consumo_lubrificante_litro: numericValue,
      }));
      return;
    }
  };

  const handleNumericBlur = (field: keyof ItemClasseIII, inputString: string) => {
    if (field === 'consumo_lubrificante_input') {
      const numericValue = parseInputToNumber(inputString);
      const formattedString = numericValue === 0 
        ? "" 
        : formatNumberForInput(numericValue, 2);
      setLocalItem(prev => ({ ...prev, consumo_lubrificante_input: formattedString }));
      return;
    }
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    setLocalItem(prev => ({
        ...prev,
        om_destino_lub: omData?.nome_om || "",
        ug_destino_lub: omData?.codug_om || "",
        selectedOmDestinoId_lub: omData?.id,
    }));
  };

  const handleConfirm = () => {
    const { consumo_lubrificante_litro, preco_lubrificante, om_destino_lub, ug_destino_lub } = localItem;
    
    if (consumo_lubrificante_litro > 0 || preco_lubrificante > 0) {
        if (!om_destino_lub || !ug_destino_lub) {
            toast.error("Selecione a OM de destino do recurso de lubrificante.");
            return;
        }
    }
    
    let finalItem = localItem;
    
    // Se consumo/preço for zero, limpa os campos de destino para evitar salvar dados inválidos
    if (consumo_lubrificante_litro === 0 && preco_lubrificante === 0) {
        finalItem = {
            ...localItem,
            om_destino_lub: "",
            ug_destino_lub: "",
            selectedOmDestinoId_lub: undefined,
        };
    }
    
    onConfirm(finalItem);
    // onOpenChange(false) é chamado dentro de onConfirm no componente pai
  };
  
  const formattedPriceInput = formatCurrencyInput(localItem.preco_lubrificante_input).formatted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5 text-purple-600" />
            Configurar Lubrificante
          </DialogTitle>
          <DialogDescription>
            Ajuste o consumo e o preço do lubrificante para {item.item}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          
          {/* OM DESTINO RECURSO LUBRIFICANTE (ND 30) */}
          <div className="space-y-2">
            <Label>OM Destino Recurso (ND 30) *</Label>
            <OmSelector 
              selectedOmId={localItem.selectedOmDestinoId_lub} 
              onChange={handleOMDestinoChange} 
              placeholder="Selecione a OM de destino..."
              disabled={loading}
            />
            {localItem.ug_destino_lub && (
              <p className="text-xs text-muted-foreground">UG: {localItem.ug_destino_lub}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Consumo ({item.categoria === 'GERADOR' ? 'L/100h' : 'L/h'})</Label>
              <Input 
                type="text"
                inputMode="decimal"
                value={localItem.consumo_lubrificante_input}
                onChange={(e) => handleNumericChange('consumo_lubrificante_input', e.target.value)}
                onBlur={(e) => handleNumericBlur('consumo_lubrificante_input', e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$/L)</Label>
              <Input 
                type="text"
                inputMode="numeric"
                value={formattedPriceInput}
                onChange={(e) => handleNumericChange('preco_lubrificante_input', e.target.value)}
                placeholder="0,00"
                onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={handleConfirm}
            disabled={loading || (localItem.consumo_lubrificante_litro > 0 && !localItem.om_destino_lub)}
          >
            <Check className="h-4 w-4 mr-2" />
            Confirmar Configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};