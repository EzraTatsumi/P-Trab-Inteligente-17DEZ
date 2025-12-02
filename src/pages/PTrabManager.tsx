// ... (imports)

// Define a base type for PTrab data fetched from DB, including the missing 'origem' field
type PTrabDB = Tables<'p_trab'> & {
// ... (PTrabDB definition)
};

interface PTrab extends PTrabDB {
// ... (PTrab interface)
}

const PTrabManager = () => {
// ... (states and hooks)

  // Efeito para atualizar o número sugerido no diálogo de clonagem
  useEffect(() => {
    if (ptrabToClone) {
      let newSuggestedNumber = "";
      
      // Tanto para 'new' quanto para 'variation', o novo P Trab deve começar como uma Minuta única
      newSuggestedNumber = generateUniqueMinutaNumber(existingPTrabNumbers); 
      
      setSuggestedCloneNumber(newSuggestedNumber);
      setCustomCloneNumber(newSuggestedNumber); // Inicializa o campo editável com a sugestão
    }
  }, [ptrabToClone, cloneType, existingPTrabNumbers]);


  const checkAuth = async () => {
// ... (checkAuth function)
// ... (rest of the component logic)