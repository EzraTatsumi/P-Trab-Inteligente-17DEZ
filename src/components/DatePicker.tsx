// ... (código anterior)
// Se a data for válida, atualiza o estado principal
        setDate(parsedDate);
      }
    } else {
      // Permite limpar a data
        setDate(undefined);
    }
  };

  const handleSelectDate: SelectSingleEventHandler = (selectedDate) => { // Removendo modifiers e e
    setDate(selectedDate); // Chamada corrigida
    if (selectedDate) {
// ... (código restante)