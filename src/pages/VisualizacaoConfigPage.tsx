import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Importar Switch
import { ArrowLeft, Sun, Moon } from "lucide-react"; // Importar ícones
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes"; // Importar useTheme

const VisualizacaoConfigPage = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme(); // Usar o hook useTheme

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Planos de Trabalho
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Configurações de Visualização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Aqui você pode personalizar como a plataforma é exibida.
            </p>

            <div className="flex items-center justify-between space-x-2 border-t pt-4">
              <div className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <Label htmlFor="dark-mode-toggle" className="text-base">
                  Modo Escuro
                </Label>
              </div>
              <Switch
                id="dark-mode-toggle"
                checked={theme === "dark"}
                onCheckedChange={handleThemeToggle}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VisualizacaoConfigPage;