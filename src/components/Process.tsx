import { Card } from "@/components/ui/card";
import { Upload, Brain, CheckCircle, Download } from "lucide-react";

const steps = [
  {
    icon: Download, // Corrigido: Seta para baixo para Importação
    number: "01",
    title: "Importação",
    description: "Carregue dados das OM e atas de pregão. Sistema organiza automaticamente as informações.",
  },
  {
    icon: Brain,
    number: "02",
    title: "Processamento IA",
    description: "Inteligência artificial aplica diretrizes do COLOG e do COTER e gera cálculos e justificativas.",
  },
  {
    icon: CheckCircle,
    number: "03",
    title: "Validação",
    description: "Verificação de conformidade e ajustes com controle total de versões.",
  },
  {
    icon: Upload, // Corrigido: Seta para cima para Exportação
    number: "04",
    title: "Exportação",
    description: "PTrab finalizado em formatos oficiais Excel e PDF conforme padrões do COLOG e COTER.",
  }
];

export const Process = () => {
  return (
    <section className="py-32 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      
      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <div className="inline-block mb-4">
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">Processo</span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6">
            Simples e eficiente
            <span className="block mt-2 text-primary">em 4 etapas</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Fluxo otimizado para máxima produtividade
          </p>
        </div>

        {/* Process timeline */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Connector line (hidden on last item and mobile) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 left-[calc(50%+2rem)] w-[calc(100%-2rem)] h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                
                <Card className="relative h-full p-8 border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-card">
                  {/* Step number */}
                  <div className="absolute -top-4 -right-4 w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
                    <span className="text-sm font-bold text-primary-foreground">{step.number}</span>
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-primary p-0.5 mb-6">
                    <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-primary" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-foreground mb-3 font-display">
                    {step.title}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </Card>
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div className="mt-16 text-center">
            <Card className="inline-block p-6 border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Rastreabilidade completa:</strong> Cada operação é registrada 
                com timestamp e usuário responsável para auditoria total.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};