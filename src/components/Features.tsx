import { Card } from "@/components/ui/card";
import { 
  Calculator, 
  FileCheck, 
  Database, 
  Layout, 
  History, 
  FileSpreadsheet,
  BarChart3,
  Lock,
  Sparkles
} from "lucide-react";

const features = [
  {
    icon: Calculator,
    title: "Cálculos Automatizados",
    description: "Aplicação automática de fórmulas padronizadas pelo COLOG e COTER, com validação instantânea e memórias de cálculo geradas em tempo real.",
    gradient: "from-primary to-primary-light"
  },
  {
    icon: Sparkles,
    title: "Inteligência Artificial",
    description: "IA analisa dados, identifica inconsistências e sugere correções automaticamente, garantindo qualidade e conformidade.",
    gradient: "from-accent to-accent-light"
  },
  {
    icon: FileCheck,
    title: "Validação em Tempo Real",
    description: "Sistema inteligente verifica conformidade com diretrizes do COLOG e do COTER e alerta sobre possíveis erros antes da finalização.",
    gradient: "from-secondary to-secondary-light"
  },
  {
    icon: Database,
    title: "Importação Inteligente",
    description: "Leitura e processamento automático de planilhas das OM e atas de pregão com mapeamento inteligente de dados.",
    gradient: "from-primary-light to-primary"
  },
  {
    icon: Layout,
    title: "Interface Intuitiva",
    description: "Design moderno e amigável, desenvolvido para usuários de todos os níveis de experiência técnica.",
    gradient: "from-secondary-light to-secondary"
  },
  {
    icon: History,
    title: "Controle Total de Versões",
    description: "Histórico completo de alterações com rastreabilidade total, timestamps e identificação de responsáveis.",
    gradient: "from-primary to-secondary"
  },
  {
    icon: FileSpreadsheet,
    title: "Exportação Padronizada",
    description: "Geração automática em formatos oficiais Excel e PDF, totalmente conforme aos padrões exigidos.",
    gradient: "from-accent to-primary-light"
  },
  {
    icon: BarChart3,
    title: "Dashboards Gerenciais",
    description: "Painéis dinâmicos com análises detalhadas de custos, recursos e indicadores orçamentários.",
    gradient: "from-secondary to-primary"
  },
  {
    icon: Lock,
    title: "Segurança Institucional",
    description: "Conformidade com normas de cibersegurança do Exército Brasileiro e controle de acesso granular.",
    gradient: "from-primary-dark to-primary"
  }
];

export const Features = () => {
  return (
    <section id="features-section" className="py-32 bg-background relative"> {/* Adicionado id aqui */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      
      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <div className="inline-block mb-4">
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">Recursos</span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6">
            Tudo que você precisa
            <span className="block mt-2 text-primary">em uma plataforma</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Ferramentas profissionais integradas para gestão completa do Plano de Trabalho
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="group relative overflow-hidden border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-card/50 backdrop-blur-sm"
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="p-8 relative">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} p-0.5 mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-bold text-foreground mb-3 font-display">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};