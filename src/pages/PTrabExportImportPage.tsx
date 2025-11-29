import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Upload, AlertCircle, Check, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

export default function PTrabExportImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [loading, setLoading] = useState(false);
  const [ptrabName, setPtrabName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadPTrabName();
  }, [ptrabId]);

  const loadPTrabName = async () => {
    if (!ptrabId) return;
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("numero_ptrab, nome_operacao")
        .eq("id", ptrabId)
        .single();

      if (error) throw error;
      setPtrabName(`${data.numero_ptrab} - ${data.nome_operacao}`);
    } catch (error) {
      console.error("Erro ao carregar P Trab:", error);
      toast.error("Erro ao carregar nome do P Trab.");
    }
  };

  const handleExport = async () => {
    if (!ptrabId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('export_ptrab_data', {
        p_ptrab_id: ptrabId,
      });

      if (error) throw error;

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ptrab_export_${ptrabName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("P Trab exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar P Trab:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!ptrabId || !file || !user) return;

    if (!confirm("Atenção: A importação irá SOBRESCREVER os dados de Classes I, II e III existentes neste P-Trab. Deseja continuar?")) {
        return;
    }

    setLoading(true);
    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const jsonContent = JSON.parse(event.target?.result as string);
                
                const { data, error } = await supabase.rpc('import_ptrab_data', {
                    p_ptrab_id: ptrabId,
                    p_user_id: user.id,
                    p_data: jsonContent,
                });

                if (error) throw error;

                toast.success(`Importação concluída! ${data.total_records} registros importados/atualizados.`);
                setFile(null);
                // Opcional: Redirecionar ou recarregar dados
                navigate(`/ptrab/form?ptrabId=${ptrabId}`);

            } catch (e) {
                console.error("Erro durante o processamento do arquivo:", e);
                toast.error(`Erro ao processar o arquivo: ${e instanceof Error ? e.message : 'Formato inválido.'}`);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);

    } catch (error) {
        console.error("Erro ao iniciar importação:", error);
        toast.error(sanitizeError(error));
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Exportação e Importação de Dados
            </CardTitle>
            <CardDescription>
              Gerencie os dados de Classes I, II e III do P-Trab: <span className="font-semibold">{ptrabName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            
            {/* Seção de Exportação */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-5 w-5 text-blue-600" />
                Exportar Dados
              </h3>
              <p className="text-sm text-muted-foreground">
                Exporte todos os registros de Classes I, II e III deste P-Trab para um arquivo JSON.
              </p>
              <div className="flex justify-end">
                <Button onClick={handleExport} disabled={loading}>
                  {loading ? "Exportando..." : "Exportar JSON"}
                </Button>
              </div>
            </div>

            {/* Seção de Importação */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-600" />
                Importar Dados
              </h3>
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  A importação irá SOBRESCREVER os registros de Classes I, II e III existentes neste P-Trab. Use apenas arquivos JSON gerados por esta aplicação.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="import-file" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Selecione o Arquivo JSON
                  </label>
                  <Input
                    id="import-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </div>
                <Button 
                  onClick={handleImport} 
                  disabled={loading || !file}
                  className="md:col-span-1"
                >
                  {loading ? "Importando..." : "Importar Dados"}
                </Button>
              </div>
              
              {file && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    Arquivo selecionado: {file.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}