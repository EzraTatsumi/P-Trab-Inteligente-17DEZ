// ... (código anterior)
export interface TrechoSelection {
    origem: string;
    destino: string;
    tipo_transporte: string;
    is_ida_volta: boolean;
    valor: number; // Valor unitário do trecho (da diretriz)
    valor_unitario: number; // NOVO: Adicionado para compatibilidade com o objeto de inserção
}

// ... (código anterior)
                        quantidade_passagens: 1, // Assumimos 1 passagem ao selecionar
                        valor_unitario: trecho.valor, // Usar 'valor' do TrechoPassagem como 'valor_unitario'
                    };
// ... (código restante)