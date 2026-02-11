import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileJson, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { DiretrizServicoTerceiro, ItemServico } from "@/types/diretrizesServicosTerceiros";

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

                <div className="grid gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Exportar Dados</h4>
                        <p className="text-xs text-muted-foreground">
                            Baixe um arquivo JSON com todos os subitens e itens de serviço cadastrados neste ano.
                        </p>
                        <Button variant="outline" onClick={handleExport} disabled={diretrizes.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Baixar JSON ({diretrizes.length} subitens)
                        </Button>
                    </div>

                    <div className="border-t pt-4 flex flex-col gap-2">
                        <h4 className="text-sm font-medium">Importar Dados</h4>
                        <p className="text-xs text-muted-foreground">
                            Selecione um arquivo JSON para importar. <span className="text-destructive font-semibold">Atenção: Isso substituirá todos os dados de serviços do ano {selectedYear}.</span>
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

                <DialogFooter>
                    <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-muted p-2 rounded">
                        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                            O arquivo deve seguir o formato padrão de exportação do sistema para garantir a integridade dos dados.
                        </span>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosExportImportDialog;