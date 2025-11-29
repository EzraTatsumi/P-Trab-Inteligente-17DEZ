import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';

export function ScrollIndicatorButton() {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = useCallback(() => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [toggleVisibility]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isVisible && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="rounded-full shadow-lg transition-opacity duration-300"
          aria-label="Voltar ao topo"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}