import { useCallback } from 'react';

/**
 * Hook customizado para facilitar a navegação entre campos de formulário usando a tecla Enter.
 * Nota: Este hook é um placeholder. A lógica de navegação real deve ser implementada aqui.
 */
export const useFormNavigation = () => {
  // Removido o uso de useNavigate para evitar erros de contexto se o hook for chamado fora do Router.

  const handleEnterToNextField = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Lógica simples para focar no próximo elemento
      const form = e.currentTarget.form;
      if (form) {
        const elements = Array.from(form.elements) as HTMLElement[];
        const index = elements.indexOf(e.currentTarget);
        
        // Encontra o próximo elemento que pode ser focado (Input, Select, Button, etc.)
        let nextElement = null;
        for (let i = index + 1; i < elements.length; i++) {
          const element = elements[i];
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.tagName === 'BUTTON') {
            nextElement = element;
            break;
          }
        }
        
        if (nextElement) {
          nextElement.focus();
        }
      }
    }
  }, []);

  return { handleEnterToNextField };
};