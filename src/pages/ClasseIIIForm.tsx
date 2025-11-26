// ... (imports e interfaces)

export default function ClasseIIIForm() {
// ... (estados)

  const handleFetchPrices = async () => {
    setApiLoading(true);
    setApiSource(null);
    
    const today = new Date().toISOString().split('T')[0];
    
    let ambitoBusca = formLPC.ambito;
    let nomeLocalBusca = formLPC.nome_local;
    let dataInicioBusca = formLPC.data_inicio_consulta;
    let dataFimBusca = formLPC.data_fim_consulta;

    // 1. Lógica de validação e ajuste de parâmetros
    if (ambitoBusca === 'Nacional') {
        // Para Nacional (Web Scraping), datas e local são ignorados, mas preenchemos com a data atual se vazios para salvar no DB
        dataInicioBusca = dataInicioBusca || today;
        dataFimBusca = dataFimBusca || today;
        nomeLocalBusca = ''; // Limpa o local para Nacional
    } else {
        // Para Estadual/Municipal, datas e local são obrigatórios
        if (!dataInicioBusca || !dataFimBusca) {
            toast.error("Preencha as datas de início e fim da consulta para consultas Estaduais/Municipais.");
            setApiLoading(false);
            return;
        }
        if (!nomeLocalBusca.trim()) {
            toast.error(`Preencha o nome do ${ambitoBusca === 'Estadual' ? 'Estado' : 'Município'} para buscar preços.`);
            setApiLoading(false);
            return;
        }
    }

    try {
        const result = await fetchPrecosCombustivel(
            ambitoBusca,
            nomeLocalBusca,
            dataInicioBusca,
            dataFimBusca
        );

        setFormLPC(prev => ({
            ...prev,
            ambito: ambitoBusca,
            nome_local: nomeLocalBusca,
            data_inicio_consulta: dataInicioBusca,
            data_fim_consulta: dataFimBusca,
            preco_diesel: result.preco_diesel,
            preco_gasolina: result.preco_gasolina,
        }));
        setApiSource(result.fonte);
        toast.success(`Preços atualizados via API: Diesel ${formatCurrency(result.preco_diesel)}, Gasolina ${formatCurrency(result.preco_gasolina)}.`);
    } catch (error) {
        console.error("Erro ao buscar preços via API:", error);
        toast.error(error.message || "Erro ao buscar preços via API. Verifique os dados de consulta.");
    } finally {
        setApiLoading(false);
    }
  };

// ... (restante do componente)