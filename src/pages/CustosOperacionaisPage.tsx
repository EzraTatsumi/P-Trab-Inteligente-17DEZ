import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Save, DollarSign, Package, Fuel, HardHat, HeartPulse, Activity, Car } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";

// Definição das classes de custo operacional
const CLASSES_CUSTO = [
  { key: "CLASSE_I", label: "Classe I - Alimentação", icon: Package },
  { key: "CLASSE_II", label: "Classe II - Material de Intendência", icon: Package },
  { key: "CLASSE_III", label: "Classe III - Combustíveis e Lubrificantes", icon: Fuel },
  { key: "CLASSE_V", label: "Classe V - Armamento", icon: HardHat },
  { key: "CLASSE_VI", label: "Classe VI - Material de Engenharia", icon: Activity },
  { key: "CLASSE_VII", label: "Classe VII - Comunicações e Informática", icon: Activity },
  { key: "CLASSE_VIII", label: "Classe VIII - Saúde e Remonta/Veterinária", icon: HeartPulse },
  { key: "CLASSE_IX", label: "Classe IX - Motomecanização", icon: Car },
];

const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Inicializa todas as seções como fechadas
    const initialExpandedState = CLASSES_CUSTO.reduce((acc, curr) => {
      acc[curr.key] = false;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedSections(initialExpandedState);
  }, []);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };
  
  const handleSave = () => {
    // Lógica de salvamento futura
    toast.info("Funcionalidade de salvar Custos Operacionais será implementada aqui.");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Verificando autenticação...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Planos de Trabalho
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Custos Operacionais
            </CardTitle>
            <CardDescription>
              Configuração dos valores de referência para cálculo de custos logísticos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              
              {CLASSES_CUSTO.map(({ key, label, icon: Icon }) => (
                <div key={key} className="border-t pt-4 mt-6">
                  <div 
                    className="flex items-center justify-between cursor-pointer py-2" 
                    onClick={() => toggleSection(key)}
                  >
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      {label}
                    </h3>
                    {expandedSections[key] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                  
                  {expandedSections[key] && (
                    <Card className="mt-2">
                      <CardContent className="pt-4">
                        {/* Conteúdo específico para a classe {key} será implementado aqui */}
                        <p className="text-sm text-muted-foreground">
                          Conteúdo da seção {label} (A ser implementado).
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-3 mt-6">
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Configurações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustosOperacionaisPage;