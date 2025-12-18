import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Target, ChevronDown } from "lucide-react";
import ScrollIndicatorButton from "./ScrollIndicatorButton"; // Importar o novo componente

interface HeroProps {
  onScrollToFeatures: () => void;
}

export const Hero = ({ onScrollToFeatures }: HeroProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 bg-gradient-mesh" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(210 100% 16%) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(210 100% 16%) 1px, transparent 1px)
          `,
          backgroundSize: '4rem 4rem'
        }}
      />

      {/* Content */}
      <div className="container relative z-10 px-4 md:px-6 py-16"> {/* Alterado de py-24 para py-16 */}
        <div className="flex flex-col items-center text-center space-y-10 max-w-5xl mx-auto">
          {/* Badge */}
          <Badge 
            variant="outline" 
            className="px-5 py-2 border-accent/30 bg-accent/10 backdrop-blur-sm text-accent hover:bg-accent/20 transition-all duration-300"
          >
            by TATSUMI
          </Badge>

          {/* Main heading */}
          <div className="space-y-6">
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold text-primary-foreground tracking-tight leading-[1.1]">
              Gestão Inteligente
              <span className="block mt-2 bg-gradient-accent bg-clip-text text-transparent">
                do Plano de Trabalho
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto font-light leading-relaxed">
              Automatize processos, elimine erros e garanta conformidade total com as diretrizes do COLOG e do COTER, 
              através de inteligência artificial e validação em tempo real.
            </p>
          </div>

          {/* Key metrics - compact */}
          <div className="flex flex-wrap justify-center gap-8 pt-4">
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl md:text-5xl font-bold text-accent">60</span>
                <span className="text-2xl font-bold text-accent">%</span>
              </div>
              <span className="text-sm text-primary-foreground/70">Redução de Tempo</span>
            </div>
            
            <div className="w-px bg-primary-foreground/20" />
            
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl md:text-5xl font-bold text-accent">95</span>
                <span className="text-2xl font-bold text-accent">%</span>
              </div>
              <span className="text-sm text-primary-foreground/70">Precisão</span>
            </div>
            
            <div className="w-px bg-primary-foreground/20" />
            
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl md:text-5xl font-bold text-accent">100</span>
                <span className="2xl font-bold text-accent">%</span>
              </div>
              <span className="text-sm text-primary-foreground/70">Conformidade</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <Button 
              size="lg" 
              className="group bg-accent hover:bg-accent-light text-accent-foreground shadow-lg hover:shadow-glow transition-all duration-300"
              asChild
            >
              <a href="/login"> {/* ALTERADO: Aponta para /login */}
                Acessar Plataforma
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
            <Button 
              size="lg"
              variant="outline" 
              className="border-2 border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/10 hover:border-primary-foreground/30"
              onClick={onScrollToFeatures}
            >
              Conhecer Recursos
            </Button>
          </div>

          {/* Scroll indicator */}
          <ScrollIndicatorButton onScrollToFeatures={onScrollToFeatures} />
        </div>
      </div>
    </section>
  );
};