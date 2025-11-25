import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download, Upload, Lock, AlertCircle } from "lucide-react";
import { ExportPasswordDialog } from "@/components/ExportPasswordDialog";
import { ImportPTrabOptionsDialog } from "@/components/ImportPTrabOptionsDialog";
import { encryptData, decryptData } from "@/lib/encryption";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tables } from "@/integrations/supabase/types";
import { OMData } from "@/lib/omUtils";

export default function PTrabExportImportPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDataString, setImportDataString] = useState("");
  const [decryptedPTrab, setDecryptedPTrab] = useState<Tables<'p_trab'> | null>(null);
  const [existingPTrabNumbers, setExistingPTrabNumbers] = useState<string[]>([]);
  const [userOms, setUserOms] = useState<OMData[]>([]);

  useEffect(() => {
    loadExistingPTrabNumbers();
    loadUserOms();
  }, []);

  const loadExistingPTrabNumbers = async () => {
    const { data, error } = await supabase.from('p_trab').select('numero_ptrab');
    if (error) {
      console.error("Erro ao carregar números de PTrabs existentes:", error);
      return;
    }
    setExistingPTrabNumbers(data.map(p => p.numero_ptrab));
  };

  const loadUserOms = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado.");
      return;
    }
    const { data, error } = await supabase
      .from('organizacoes_militares')
      .select('*')
      .eq('user_id', user.id)
      .eq('ativo', true);
    
    if (error) {
      console.error("Erro ao carregar OMs do usuário:", error);
      toast.error("Erro ao carregar suas OMs.");
      return;
    }
    setUserOms(data as OMData[]);
  };

  const handleExportPTrab = async (password: string) => {
    setLoading(true);
    setExportDialogOpen(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Fetch all PTrab data including related records
      const { data: pTrabsData, error: pTrabsError } = await supabase
        .from("p_trab")
        .select(`
          *,
          classe_i_registros(*),
          classe_iii_registros(*),
          p_trab_ref_lpc(*)
        `)
        .eq('user_id', user.id);

      if (pTrabsError) throw pTrabsError;

      if (!pTrabsData || pTrabsData.length === 0) {
        toast.info("Nenhum PTrab encontrado para exportar.");
        setLoading(false);
        return;
      }

      // For simplicity, let's export the first PTrab found for now
      // In a real scenario, you'd likely allow selection or export all.
      const ptrabToExport = pTrabsData[0]; 

      const encrypted = await encryptData(JSON.stringify(ptrabToExport), password);
      
      // Provide the encrypted data to the user
      const blob = new Blob([encrypted], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ptrab_export_${ptrabToExport.numero_ptrab.replace(/\//g, '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PTrab exportado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao exportar PTrab:", error);
      toast.error(`Erro ao exportar PTrab: ${error.message || "Verifique o console."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDecryptImportData = async (password: string) => {
    setLoading(true);
    try {
      const decryptedString = await decryptData(importDataString, password);
      const importedPTrab = JSON.parse(decryptedString);
      
      // Basic validation to ensure it's a PTrab object
      if (!importedPTrab || !importedPTrab.numero_ptrab || !importedPTrab.nome_operacao) {
        throw new Error("O arquivo importado não parece ser um PTrab válido.");
      }

      setDecryptedPTrab(importedPTrab);
      setImportDialogOpen(true); // Open the options dialog
      toast.success("Dados decifrados com sucesso! Configure as opções de importação.");
    } catch (error: any) {
      console.error("Erro ao decifrar dados:", error);
      toast.error(`Erro ao decifrar dados: ${error.message || "Senha incorreta ou arquivo corrompido."}`);
      setDecryptedPTrab(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async (newPTrabData: Tables<'p_trab'>) => {
    setLoading(true);
    setImportDialogOpen(false); // Close the options dialog
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Insert the new PTrab record
      const { id, created_at, updated_at, classe_i_registros, classe_iii_registros, p_trab_ref_lpc, ...restOfPTrab } = newPTrabData;
      
      const { data: insertedPTrab, error: insertPTrabError } = await supabase
        .from("p_trab")
        .insert([{ ...restOfPTrab, user_id: user.id, status: 'aberto' }]) // Always start as 'aberto'
        .select()
        .single();

      if (insertPTrabError || !insertedPTrab) throw insertPTrabError;

      const newPTrabId = insertedPTrab.id;

      // 2. Insert related Classe I records
      if (classe_i_registros && classe_i_registros.length > 0) {
        const recordsToInsert = classe_i_registros.map(record => {
          const { id, created_at, updated_at, ...rest } = record;
          return { ...rest, p_trab_id: newPTrabId };
        });
        const { error: classeIInsertError } = await supabase
          .from("classe_i_registros")
          .insert(recordsToInsert as Tables<'classe_i_registros'>[]);
        if (classeIInsertError) console.error("Erro ao importar Classe I:", classeIInsertError);
      }

      // 3. Insert related Classe III records
      if (classe_iii_registros && classe_iii_registros.length > 0) {
        const recordsToInsert = classe_iii_registros.map(record => {
          const { id, created_at, updated_at, ...rest } = record;
          return { ...rest, p_trab_id: newPTrabId };
        });
        const { error: classeIIIInsertError } = await supabase
          .from("classe_iii_registros")
          .insert(recordsToInsert as Tables<'classe_iii_registros'>[]);
        if (classeIIIInsertError) console.error("Erro ao importar Classe III:", classeIIIInsertError);
      }

      // 4. Insert related p_trab_ref_lpc record
      if (p_trab_ref_lpc && p_trab_ref_lpc.length > 0) {
        const { id, created_at, updated_at, ...rest } = p_trab_ref_lpc[0];
        const { error: refLPCInsertError } = await supabase
          .from("p_trab_ref_lpc")
          .insert([{ ...rest, p_trab_id: newPTrabId }]);
        if (refLPCInsertError) console.error("Erro ao importar Ref LPC:", refLPCInsertError);
      }

      toast.success(`PTrab "${insertedPTrab.numero_ptrab}" importado com sucesso!`);
      navigate(`/ptrab/form?ptrabId=${newPTrabId}`); // Redirect to the new PTrab
    } catch (error: any) {
      console.error("Erro ao importar PTrab:", error);
      toast.error(`Erro ao importar PTrab: ${error.message || "Verifique o console."}`);
    } finally {
      setLoading(false);
      setImportDataString(""); // Clear textarea
      setDecryptedPTrab(null); // Clear decrypted data
      loadExistingPTrabNumbers(); // Reload numbers for next operations
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/config/diretrizes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Configurações
          </Button>
          <h1 className="text-3xl font-bold text-center flex-grow">Exportar/Importar PTrab</h1>
          <div className="w-fit"></div> {/* Placeholder para alinhar o título */}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Exportar PTrab
            </CardTitle>
            <CardDescription>
              Exporte um PTrab completo (incluindo registros de Classe I e III) para um arquivo criptografado.
              Você precisará de uma senha para proteger os dados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setExportDialogOpen(true)} disabled={loading}>
              {loading ? "Preparando..." : "Exportar PTrab"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importar PTrab
            </CardTitle>
            <CardDescription>
              Cole o conteúdo de um arquivo de exportação de PTrab e forneça a senha para importá-lo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-data">Dados do PTrab Exportado</Label>
              <Textarea
                id="import-data"
                placeholder="Cole o conteúdo do arquivo .txt exportado aqui..."
                value={importDataString}
                onChange={(e) => {
                  setImportDataString(e.target.value);
                  setDecryptedPTrab(null); // Clear decrypted data if text changes
                }}
                rows={10}
                className="font-mono text-xs"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-password">Senha de Segurança</Label>
              <ExportPasswordDialog // Reusing the dialog for password input
                open={false} // Controlled by the button below
                onOpenChange={() => {}} // No-op
                onConfirm={handleDecryptImportData}
                title="Decifrar Dados do PTrab"
                description="Digite a senha usada para criptografar o arquivo de exportação."
                confirmButtonText="Decifrar e Importar"
              >
                <Button 
                  onClick={() => {
                    if (!importDataString.trim()) {
                      toast.error("Cole os dados do PTrab exportado antes de decifrar.");
                      return;
                    }
                    // Manually trigger the password dialog
                    const passwordPrompt = prompt("Digite a senha de segurança para decifrar os dados:");
                    if (passwordPrompt) {
                      handleDecryptImportData(passwordPrompt);
                    } else {
                      toast.info("Operação de importação cancelada.");
                    }
                  }} 
                  disabled={loading || !importDataString.trim()}
                >
                  {loading ? "Decifrando..." : "Decifrar e Importar"}
                </Button>
              </ExportPasswordDialog>
            </div>
            {decryptedPTrab && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>PTrab Decifrado!</AlertTitle>
                <AlertDescription>
                  PTrab: <span className="font-semibold">{decryptedPTrab.numero_ptrab} - {decryptedPTrab.nome_operacao}</span>.
                  Clique em "Decifrar e Importar" novamente para configurar as opções de importação.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <ExportPasswordDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onConfirm={handleExportPTrab}
          title="Senha para Exportação do PTrab"
          description="Defina uma senha para criptografar seu arquivo de exportação. Você precisará dela para importar o PTrab novamente."
          confirmButtonText="Exportar PTrab"
        />

        {decryptedPTrab && (
          <ImportPTrabOptionsDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            importedPTrab={decryptedPTrab}
            existingPTrabNumbers={existingPTrabNumbers}
            userOms={userOms}
            onConfirmImport={handleConfirmImport}
          />
        )}
      </div>
    </div>
  );
}