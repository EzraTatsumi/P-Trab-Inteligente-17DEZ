import { ItemSaude } from "./classeVIIIData"; // Assuming this import exists if the file was previously written

export interface ItemSaude {
    item: string;
    valor_unitario: number;
}

export interface ItemRemonta {
    item: string;
    valor_unitario: number;
}

export const defaultClasseVIIISaudeConfig: ItemSaude[] = [
    { item: "KPSI (Kit de Primeiros Socorros Individual)", valor_unitario: 150.00 },
    { item: "KPT (Kit de Primeiros Socorros de Tropa)", valor_unitario: 450.00 },
    // Adicione mais itens de saúde conforme necessário
];

export const defaultClasseVIIIRemontaConfig: ItemRemonta[] = [
    // Item B (Manutenção Anual / 365 dias)
    { item: "B - Equinos Encilhagem e Proteção (Mnt/Dia)", valor_unitario: 4.11 }, // 1500 / 365
    { item: "B - Equinos Selas (Mnt/Dia)", valor_unitario: 5.48 }, // 2000 / 365
    { item: "B - Caninos Material de Condução (Mnt/Dia)", valor_unitario: 1.37 }, // 2500 / 5 cães / 365

    // Item C (Material Mensal / 30 dias)
    { item: "C - Medicamentos e Ferrageamento (Equino/Dia)", valor_unitario: 3.00 }, // 90 / 30
    { item: "C - Medicamentos (Canino/Dia)", valor_unitario: 2.00 }, // 60 / 30
    { item: "C - Alimentação Equinos (Volumoso/Dia)", valor_unitario: 26.50 }, // 795 / 30
    { item: "C - Alimentação Caninos (Reforço/Dia)", valor_unitario: 3.30 }, // 99 / 30

    // Item D (Aquisição/Reposição - 20% do valor de mercado / 365 dias)
    { item: "D - Equino Reposição (Amortizado/Dia)", valor_unitario: 19.73 }, // 36000 * 0.20 / 365
    { item: "D - Canino Reposição (Amortizado/Dia)", valor_unitario: 21.92 }, // 40000 * 0.20 / 365

    // Item E (Assistência - 20% do valor / 365 dias)
    { item: "E - Equino Assistência (Amortizado/Dia)", valor_unitario: 10.96 }, // 20000 * 0.20 / 365
    { item: "E - Canino Assistência (Amortizado/Dia)", valor_unitario: 5.48 }, // 10000 * 0.20 / 365

    // Item G (Manutenção Consolidada / Dia Op)
    { item: "G - Cavalo (Mnt/Dia Op)", valor_unitario: 29.50 },
    { item: "G - Cão (Mnt/Dia Op)", valor_unitario: 5.30 },
];