import { Card } from "@/components/ui/card";
import { 
  Clock, 
  Target, 
  ShieldCheck, 
  TrendingDown,
  Users,
  Sparkles,
  AlertCircle
} from "lucide-react";

const benefits = [
  {
    icon: Clock,
    metric: "60%",
    title: "Redução de Tempo",
    description: "Consolidação drasticamente mais rápida através de automação inteligente",
  },
  {
    icon: Target,
    metric: "95%",
    title: "Precisão Garantida",
    description: "Aumento significativo na acurácia dos cálculos e estimativas orçamentárias",
  },
  {
    icon: ShieldCheck,
    metric: "100%",
    title: "Conformidade COLOG / COTER",
    description: "Padronização total com diretrizes do Comando Logístico e Comando de Operações Terrestres",
  },
  {
    icon: TrendingDown,
    metric: "<5%",
    title: "Retrabalho Mínimo",
    description: "Eliminação de erros e inconsistências nos processos",
  },
  {
    icon: Users,
    metric: "80%+",
    title: "Satisfação",
    description: "Índice de aprovação dos usuários após implementação",
  },
  {
    icon: Sparkles,
    metric: "100%",
    title: "Rastreabilidade",
    description: "Auditoria completa com logs de todas as operações",
  }
];

const challenges = [
  "Processos manuais lentos e propensos a erro humano",
  "Dificuldade em atualizar cálculos após mudanças",
  "Falta de padronização entre diferentes OM",
  "Alto consumo de tempo dos oficiais",
  "Ausência de histórico e rastreabilidade",
  "Retrabalho constante em correções",
  "Risco de inconsistências em auditorias",
  "Baixa eficiência nos relatórios gerenciais"
];

export const Benefits = () => {
  return (
    <section className="py-32 bg-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
      
      <div className="container px-4 md:px-6 relative z-10">
        {/* Challenges section */}
        <div className="mb-32">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-destructive uppercase tracking-wider">Desafios</span>
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6">
              Problemas que
              <span className="block mt-2 text-primary">solucionamos</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Eliminando as principais barreiras do processo tradicional
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {challenges.map((challenge, index) => (
              <div 
                key={index}
                className="group relative p-6 rounded-2xl bg-card border border-destructive/20 hover:border-destructive/40 transition-all duration-300 hover:shadow-md"
              >
                <AlertCircle className="w-5 h-5 text-destructive mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-sm text-foreground leading-relaxed">{challenge}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits section */}
        <div>
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-block mb-4">
              <span className="text-sm font-semibold text-secondary uppercase tracking-wider">Resultados</span>
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6">
              Impacto mensurável
              <span className="block mt-2 text-primary">em sua operação</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Métricas de valor que transformam a eficiência operacional
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card 
                key={index}
                className="group relative overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-card"
              >
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <benefit.icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold font-display text-primary">
                        {benefit.metric}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold text-foreground mb-2 font-display">
                    {benefit.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};