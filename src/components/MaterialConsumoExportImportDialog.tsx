import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, Upload, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import { exportMaterialConsumoToExcel, importMaterialConsumoFromExcel } from '@/lib/materialConsumoExportImport';
import { useSession } from '@/components/SessionContextProvider';
import { useQueryClient } from '@tanstack/react-query';

interface MaterialConsumoExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizMaterialConsumo[];
    onImportSuccess: () => void;
}

const MaterialConsumoExportImportDialog: React.FC<MaterialConsumoExportImportDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizes,
    onImportSuccess,
}) => {
    const { user } = useSession();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleExport = useCallback(async () => {
        if (diretrizes.length === 0) {
            toast.warning("Não há dados para exportar no ano selecionado.");
            return;
        }
        setIsProcessing(true);
        try {
            await exportMaterialConsumoToExcel(diretrizes, selectedYear);
            toast.success("Exportação concluída!", { description: `Arquivo Diretrzes_MaterialConsumo_${selectedYear}.xlsx baixado.` });
        } catch (error) {
            console.error("Erro na exportação:", error);
            toast.error("Falha ao exportar dados para Excel.");
        } finally {
            setIsProcessing(false);
        }
    }, [diretrizes, selectedYear]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && file.type !== 'application/vnd.ms-excel') {
                toast.error("Formato de arquivo inválido. Por favor, use um arquivo .xlsx.");
                setSelectedFile(null);
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleImport = useCallback(async () => {
        if (!selectedFile || !user?.id) {
            toast.error("Selecione um arquivo e certifique-se de estar logado.");
            return;
        }
        
        if (!confirm(`Atenção: A importação substituirá TODAS as diretrizes de Material de Consumo existentes para o ano ${selectedYear}. Deseja continuar?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            await importMaterialConsumoFromExcel(selectedFile, selectedYear, user.id);
            
            // Força a revalidação da query principal
            onImportSuccess(); 
            
            toast.success("Importação concluída!", { description: `As diretrizes de Material de Consumo para o ano ${selectedYear} foram atualizadas.` });
            
            // Limpa o estado e fecha o diálogo
            setSelectedFile(null);
            onOpenChange(false);

        } catch (error: any) {
            console.error("Erro na importação:", error);
            toast.error("Falha na importação.", { description: error.message || "Verifique o formato do arquivo e tente novamente." });
        } finally {
            setIsProcessing(false);
        }
    }, [selectedFile, selectedYear, user?.id, onOpenChange, onImportSuccess]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Exportar/Importar Material de Consumo
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie as diretrizes de Material de Consumo (Subitens da ND) para o ano {selectedYear}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 py-4">
                    {/* Seção de Exportação */}
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Download className="h-5 w-5 text-primary" />
                            Exportar Dados
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Baixe todas as diretrizes e itens de aquisição do ano {selectedYear} em formato Excel.
                        </p>
                        <Button 
                            onClick={handleExport} 
                            disabled={isProcessing || diretrizes.length === 0}
                            className="w-full"
                        >
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Exportar ({diretrizes.length} Subitens)
                        </Button>
                    </div>

                    {/* Seção de Importação */}
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Upload className="h-5 w-5 text-primary" />
                            Importar Dados
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Carregue um arquivo Excel (.xlsx) para substituir as diretrizes existentes.
                        </p>
                        
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".xlsx"
                            className="hidden"
                        />
                        
                        <Button 
                            onClick={() => fileInputRef.current?.click()}
                            variant="outline"
                            className="w-full"
                            disabled={isProcessing}
                        >
                            {selectedFile ? (
                                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                            ) : (
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                            )}
                            {selectedFile ? selectedFile.name : "Selecionar Arquivo (.xlsx)"}
                        </Button>
                        
                        <Button 
                            onClick={handleImport}
                            disabled={isProcessing || !selectedFile}
                            className="w-full bg-green-600 hover:bg-green-700"
                        >
                            {isProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            Confirmar Importação
                        </Button>
                        
                        <div className="flex items-start text-xs text-red-600 mt-2">
                            <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <p>A importação substituirá todos os dados de Material de Consumo do ano {selectedYear}.</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoExportImportDialog;