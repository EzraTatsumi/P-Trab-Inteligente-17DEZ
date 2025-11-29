"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react"; // Manter ChevronUp e ChevronDown
import { cn } from "@/lib/utils";

interface ScrollIndicatorButtonProps {
  onScrollToFeatures: () => void;
}

const ScrollIndicatorButton = ({ onScrollToFeatures }: ScrollIndicatorButtonProps) => {
  const [isAtTop, setIsAtTop] = useState(true);
  const [arrowColorClass, setArrowColorClass] = useState("text-primary"); // Estado para a cor da seta

  const handleScroll = useCallback(() => {
    const viewportHeight = window.innerHeight;
    const featuresSection = document.getElementById('features-section');
    const footer = document.getElementById('main-footer'); // Obter o rodapé

    // Lógica para o botão de rolagem para cima/baixo
    if (featuresSection) {
      const featuresSectionRect = featuresSection.getBoundingClientRect();
      setIsAtTop(featuresSectionRect.top >= viewportHeight / 2);
    } else {
      setIsAtTop(window.pageYOffset === 0);
    }

    // Lógica para a cor da seta do botão de rolagem para cima
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      // A posição do botão fixo é bottom-8, então seu 'bottom' real na viewport é viewportHeight - 8px
      // Considerando a altura do botão (h-10 = 40px), o topo do botão seria viewportHeight - 8px - 40px
      const buttonTopInViewport = viewportHeight - 8 - 40; // Aproximadamente, para ter uma margem

      // Se o topo do botão estiver acima do topo do rodapé, a seta é azul.
      // Caso contrário (se o botão estiver sobrepondo ou abaixo do rodapé), a seta é a mesma do scroll-down.
      if (buttonTopInViewport > footerRect.top) {
        setArrowColorClass("text-primary-foreground/40"); // Cor da seta do botão de rolar para baixo
      } else {
        setArrowColorClass("text-primary"); // Azul
      }
    } else {
      setArrowColorClass("text-primary"); // Padrão azul se o rodapé não for encontrado
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Inicializa o estado na montagem
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (isAtTop) {
    return (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce ml-[-0.5rem]">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-primary-foreground/40 hover:text-primary-foreground/80 transition-colors"
          onClick={onScrollToFeatures}
          aria-label="Rolar para baixo"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
      </div>
    );
  } else { // Se não estiver no topo, mostra o botão de rolagem para cima
    return (
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] animate-bounce ml-[-0.5rem]">
        <Button
          onClick={scrollToTop}
          variant="ghost"
          size="icon"
          className={cn(
            "h-10 w-10 rounded-full transition-colors z-[9999]", // Adicionado z-[9999] diretamente ao Button
            "text-primary-foreground/40 hover:text-primary-foreground/80", // Cor padrão do botão
            arrowColorClass // Aplica a cor da seta dinâmica
          )}
          aria-label="Voltar ao Topo"
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
      </div>
    );
  }
};

export default ScrollIndicatorButton;