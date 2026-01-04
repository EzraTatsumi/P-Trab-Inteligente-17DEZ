// Lista de Capitais e Cidades Especiais para fins de diária (Decreto/Portaria de referência)

export const CAPITAIS_ESPECIAIS = [
    "Brasília/DF",
    "Manaus/AM",
    "Rio de Janeiro/RJ",
    "São Paulo/SP",
];

export const TODAS_CAPITAIS = [
    "Aracaju/SE",
    "Belém/PA",
    "Belo Horizonte/MG",
    "Boa Vista/RR",
    "Campo Grande/MS",
    "Cuiabá/MT",
    "Curitiba/PR",
    "Florianópolis/SC",
    "Fortaleza/CE",
    "Goiânia/GO",
    "João Pessoa/PB",
    "Macapá/AP",
    "Maceió/AL",
    "Natal/RN",
    "Palmas/TO",
    "Porto Alegre/RS",
    "Porto Velho/RO",
    "Recife/PE",
    "Rio Branco/AC",
    "Salvador/BA",
    "São Luís/MA",
    "Teresina/PI",
    "Vitória/ES",
];

// As demais capitais são todas as capitais menos as especiais
export const DEMAIS_CAPITAIS = TODAS_CAPITAIS.filter(capital => !CAPITAIS_ESPECIAIS.includes(capital));

// Lista de cidades para Demais Deslocamentos (DSLc) - Permitindo entrada livre, mas com sugestões
export const DEMAIS_DSLC_SUGGESTIONS = [
    "Outras Cidades/Municípios",
];

export const DESTINO_OPTIONS = [
    { value: 'bsb_capitais_especiais', label: 'BSB/MAO/RJ/SP', cities: CAPITAIS_ESPECIAIS },
    { value: 'demais_capitais', label: 'Demais Capitais', cities: DEMAIS_CAPITAIS },
    { value: 'demais_dslc', label: 'Demais Dslc', cities: DEMAIS_DSLC_SUGGESTIONS },
];