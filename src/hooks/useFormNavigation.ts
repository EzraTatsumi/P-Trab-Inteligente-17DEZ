import { useCallback } from 'react';

/**
 * Hook para adicionar funcionalidade de navegação de formulário (pressionar Enter para ir para o próximo campo).
 */
export const useFormNavigation = () => {
  const handleEnterToNextField = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      const form = event.currentTarget.form;
      if (!form) return;

      const elements = Array.from(form.elements) as (HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement)[];
      const index = elements.indexOf(event.currentTarget);
      
      // Encontra o próximo elemento de entrada que não está desabilitado
      for (let i = index + 1; i < elements.length; i++) {
        const nextElement = elements[i];
        if (
          (nextElement instanceof HTMLInputElement || nextElement instanceof HTMLTextAreaElement) &&
          !nextElement.disabled
        ) {
          nextElement.focus();
          return;
        }
      }
    }
  }, []);

  return { handleEnterToNextField };
};