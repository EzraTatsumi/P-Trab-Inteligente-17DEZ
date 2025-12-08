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
    { item: "Ração para Equino (Dia)", valor_unitario: 25.00 },
    { item: "Material Veterinário Básico (Dia/Animal)", valor_unitario: 10.00 },
    { item: "Ferraduras (Unidade)", valor_unitario: 80.00 },
    // Adicione mais itens de remonta conforme necessário
];