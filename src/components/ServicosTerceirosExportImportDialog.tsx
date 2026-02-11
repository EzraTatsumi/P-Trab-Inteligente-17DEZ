import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileJson, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { DiretrizServicoTerceiro } from "@/types/diretrizesServicosTerceiros";

interface ServicosTerceirosExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizServicoTerceiro[];
    onImportSuccess: () => void;
}

const ServicosTerceirosExportImportDialog = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizes,
    onImportSuccess
}: ServicosTerceirosExportImportDialogProps) => {
    const { user } = useSession();
    const [isImporting, setIsImporting] = useState(false);

    const handleExport = () => {
        try {
            // Remove IDs e campos de sistema para exportação limpa
            const dataToExport = diretrizes.map(({ id, created_at, updated_at, user_id, ...rest }) => rest);
            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `diretrizes_servicos_${selectedYear}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success("Diretrizes exportadas com sucesso!");
        } catch (error) {
            toast.error("Erro ao exportar diretrizes.");
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        setIsImporting(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const importedData = JSON.parse(content);

                if (!Array.isArray(importedData)) {
                    throw new Error("Formato de arquivo inválido. Esperado um array de diretrizes.");
                }

                // Deletar diretrizes existentes para o ano
                const { error: deleteError } = await supabase
                    .from("diretrizes_servicos_terceiros")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("ano_referencia", selectedYear);

                if (deleteError) throw deleteError;

                // Inserir novas diretrizes
                const dataToInsert = importedData.map((d: any) => ({
                    ...d,
                    user_id: user.id,
                    ano_referencia: selectedYear,
                    itens_aquisicao: d.itens_aquisicao || []
                }));

                const { error: insertError } = await supabase
                    .from("diretrizes_servicos_terceiros")
                    .insert(dataToInsert);

                if (insertError) throw insertError;

                toast.success(`${dataToInsert.length} subitens importados com sucesso!`);
                onImportSuccess();
                onOpenChange(false);
            } catch (error: any) {
                console.error("Erro na importação:", error);
                toast.error(`Erro ao importar: ${error.message}`);
            } finally {
                setIsImporting(false);
                // Limpa o input para permitir importar o mesmo arquivo novamente se necessário
                event.target.value = "";
            }
        };

        reader.readAsText(file);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5 text-primary" />
                        Exportar / Importar Serviços
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie suas diretrizes de serviços de terceiros para o ano {selectedYear}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex flex-col gap-3">
                        <h4 className="text-sm font-semibold">Exportar Dados</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Baixe um arquivo JSON contendo todos os subitens e itens de serviço cadastrados para o ano de {selectedYear}.
                        </p>
                        <Button 
                            variant="outline" 
                            onClick={handleExport} 
                            disabled={diretrizes.length === 0}
                            className="w-full"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Baixar JSON ({diretrizes.length} subitens)
                        </Button>
                    </div>

                    <div className="border-t pt-6 flex flex-col gap-3">
                        <h4 className="text-sm font-semibold">Importar Dados</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Selecione um arquivo JSON para importar. <span className="text-destructive font-bold">Atenção: Esta ação substituirá permanentemente todos os dados de serviços do ano {selectedYear}.</span>
                        </p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                disabled={isImporting}
                            />
                            <Button variant="secondary" className="w-full" disabled={isImporting}>
                                {isImporting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="mr-2 h-4 w-4" />
                                )}
                                Selecionar Arquivo JSON
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="sm:justify-start">
                    <div className="flex items-start gap-3 text-[11px] text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50 w-full">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                        <p className="leading-normal">
                            Certifique-se de que o arquivo segue o formato padrão. Recomenda-se fazer um backup (exportação) antes de realizar uma nova importação.
                        </p>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosExportImportDialog;