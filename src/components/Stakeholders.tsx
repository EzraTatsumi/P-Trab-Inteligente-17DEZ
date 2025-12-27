import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Shield, Users, FileCheck, Briefcase, Network } from "lucide-react";

const stakeholders = [
  {
    icon: Shield,
    name: "COLOG / COTER",
    role: "Comando Logístico e Comando de Operações Terrestres",
    interest: "Conformidade e padronização do custeio",
    influence: "Alta"
  },
  {
    icon: Network,
    name: "DCT", // Alterado de "CITEx / DCT" para "DCT"
    role: "Centro de Telemática",
    interest: "Homologação técnica da solução",
    influence: "Alta"
  },
  {
    icon: Building2,
    name: "Comando Militar de Área",
    role: "Centro de Coordenação de Operações",
    interest: "Eficiência das PTrabs",
    influence: "Alta"
  },
  {
    icon: FileCheck,
    name: "Tribunais",
    role: "TCU / TCM / CGU",
    interest: "Transparência e rastreabilidade",
    influence: "Média"
  },
  {
    icon: Briefcase,
    name: "Fornecedores",
    role: "Suporte Técnico",
    interest: "Manutenção e licenciamento",
    influence: "Média"
  },
  {
    icon: Users,
    name: "OM Subordinadas",
    role: "Usuários Finais",
    interest: "Facilidade de uso",
    influence: "Alta"
  }
];

export const Stakeholders = () => {
  return (
    <section className="py-32 bg-muted/30 relative">
      <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
      
      <div className="container px-4 md:px-6 relative z-10">
        {/* Section header */}
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <div className="inline-block mb-4">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Ecossistema</span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-6">
            Alinhamento
            <span className="block mt-2 text-primary">institucional</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Desenvolvido para atender todos os níveis da hierarquia militar
          </p>
        </div>

        {/* Stakeholders grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {stakeholders.map((stakeholder, index) => (
            <Card 
              key={index}
              className="group p-6 border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-card"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                  <stakeholder.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-foreground mb-1 font-display">
                    {stakeholder.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {stakeholder.role}
                  </p>
                </div>
              </div>

              <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
                {stakeholder.interest}
              </p>

              <Badge variant="outline" className="text-xs">
                Influência {stakeholder.influence}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};