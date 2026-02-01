export interface DiretrizConcessionariaForm {
  id?: string;
  categoria: 'AGUA_ESGOTO' | 'ENERGIA_ELETRICA';
  nome_concessionaria: string;
  consumo_pessoa_dia: number; // Usar number no frontend
  fonte_consumo: string;
  custo_unitario: number; // Usar number no frontend
  fonte_custo: string;
  unidade_custo: 'm3' | 'kWh';
}