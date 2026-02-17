import React from 'react';

export const useFormNavigation = () => {
  const handleEnterToNextField = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault(); // Previne o comportamento padrão (ex: submissão do formulário)
      const form = (event.currentTarget as HTMLInputElement).form;
      if (form) {
        // Se o campo atual for um input de senha, submete o formulário diretamente
        if ((event.currentTarget as HTMLInputElement).type === 'password') {
          const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (submitButton) {
            submitButton.click();
          } else {
            // Fallback: tenta encontrar o primeiro botão que não seja type="button"
            const firstDefaultButton = form.querySelector('button:not([type="button"]):not([disabled])') as HTMLButtonElement;
            if (firstDefaultButton) {
              firstDefaultButton.click();
            }
          }
          return; // Interrompe a execução para não mover o foco
        }

        // Lógica existente para mover o foco para o próximo campo
        const focusableElements = Array.from(
          form.querySelectorAll(
            'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"]), ' +
            'textarea:not([disabled]):not([tabindex="-1"]), ' +
            'select:not([disabled]):not([tabindex="-1"]), ' +
            'button:not([disabled]):not([tabindex="-1"]), ' +
            'a[href]:not([disabled]):not([tabindex="-1"]), ' +
            '[tabindex]:not([tabindex="-1"]):not([disabled])'
          )
        ) as HTMLElement[];
        
        const currentElementIndex = focusableElements.indexOf(event.currentTarget as HTMLElement);
        
        if (currentElementIndex > -1 && currentElementIndex < focusableElements.length - 1) {
          focusableElements[currentElementIndex + 1].focus();
        } else {
          const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (submitButton) {
            submitButton.click();
          } else {
            const firstDefaultButton = form.querySelector('button:not([type="button"]):not([disabled])') as HTMLButtonElement;
            if (firstDefaultButton) {
              firstDefaultButton.click();
            }
          }
        }
      }
    }
  };

  return { handleEnterToNextField };
};