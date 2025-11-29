import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function Hero() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleStart = () => {
    if (isAuthenticated) {
      navigate("/ptrab");
    } else {
      navigate("/login");
    }
  };

  return (
    <section className="relative w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Otimize seu P-Trab
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
              Geração automática de memórias de cálculo e consolidação de custos para Classes I, II e III.
            </p>
          </div>
          <div className="space-x-4">
            <Button onClick={handleStart} className="group">
              {isAuthenticated ? "Acessar P-Trab" : "Começar Agora"}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}