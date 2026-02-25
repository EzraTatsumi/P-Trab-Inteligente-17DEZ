import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Copy, Trash2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface YearManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    availableYears: number[];
    defaultYear: number | null;
    onCopy: (sourceYear: number, targetYear: number) => Promise<void>;
    onDelete: (year: number) => Promise<void>;
    loading: boolean;
}

export const YearManagementDialog: React.FC<YearManagementDialogProps> = ({
    open,
    onOpenChange,
    availableYears,
    defaultYear,
    onCopy,
    onDelete,
    loading
}) => {
    const [sourceYear, setSourceYear] = useState<string>("");
    const [targetYear, setTargetYear] = useState<string>("");

    const handleCopy = async () => {
        if (!sourceYear || !targetYear) {
            toast.error("Selecione o ano de origem e informe o ano de destino.");
            return;
        }
        if (sourceYear === targetYear) {
            toast.error("O ano de destino deve ser diferente do ano de origem.");
            return;
        }
        await onCopy(parseInt(sourceYear), parseInt(targetYear));
        setTargetYear("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Gerenciamento de Anos de Referência</DialogTitle>
                    <DialogDescription>
                        Copie diretrizes de um ano para outro ou exclua anos que não são mais necessários.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <Copy className="h-4 w-4" />
                            Copiar Diretrizes
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Origem</Label>
                                <Select value={sourceYear} onValueChange={setSourceYear}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Ano" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYears.map(year => (
                                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Destino</Label>
                                <Input 
                                    type="number" 
                                    placeholder="Ex: 2025" 
                                    value={targetYear}
                                    onChange={(e) => setTargetYear(e.target.value)}
                                />
                            </div>
                        </div>
                        <Button 
                            className="w-full" 
                            variant="secondary" 
                            onClick={handleCopy}
                            disabled={loading || !sourceYear || !targetYear}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                            Iniciar Cópia de Dados
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            Excluir Anos
                        </h3>
                        <div className="space-y-2">
                            {availableYears.map(year => (
                                <div key={year} className="flex items-center justify-between p-2 border rounded-md">
                                    <span className="text-sm font-medium">
                                        {year} {year === defaultYear && "(Ano Padrão)"}
                                    </span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        disabled={loading || year === defaultYear}
                                        onClick={() => onDelete(year)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};