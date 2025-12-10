import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ClasseIXForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Classe IX - Material de Manutenção (Em Desenvolvimento)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Esta seção será implementada em breve.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClasseIXForm;