import { useState, useMemo, useCallback } from "react";
import { numberToRawDigits } from "@/lib/formatUtils";

interface NDAllocationState {
  totalSolicitado: number;
  nd30Manual: number;
  nd39Manual: number;
}

interface NDAllocationResult {
  // Valores numéricos
  totalSolicitado: number;
  valorND30: number;
  valorND39: number;
  totalAlocado: number;
  isAllocationCorrect: boolean;
  
  // Estados brutos para inputs monetários
  rawTotalInput: string;
  rawND30Input: string;
  rawND39Input: string;

  // Handlers
  handleTotalChange: (numericValue: number, rawDigits: string) => void;
  handleND30Change: (numericValue: number, rawDigits: string) => void;
  handleND39Change: (numericValue: number, rawDigits: string) => void;
  
  // Reset
  resetAllocation: () => void;
}

/**
 * Hook para gerenciar a alocação de valores entre ND 30 e ND 39,
 * onde um dos campos é manual e o outro é calculado por diferença.
 * 
 * @param initialTotal O valor total solicitado inicial.
 * @param initialND30 O valor inicial alocado para ND 30.
 * @param initialND39 O valor inicial alocado para ND 39.
 * @returns NDAllocationResult
 */
export const useNDAllocation = (
  initialTotal: number = 0,
  initialND30: number = 0,
  initialND39: number = 0,
): NDAllocationResult => {
  
  const [state, setState] = useState<NDAllocationState>({
    totalSolicitado: initialTotal,
    nd30Manual: initialND30,
    nd39Manual: initialND39,
  });
  
  // Estados brutos para inputs controlados
  const [rawTotalInput, setRawTotalInput] = useState(numberToRawDigits(initialTotal));
  const [rawND30Input, setRawND30Input] = useState(numberToRawDigits(initialND30));
  const [rawND39Input, setRawND39Input] = useState(numberToRawDigits(initialND39));

  // Lógica de Cálculo Centralizada
  const { valorND30, valorND39, totalAlocado, isAllocationCorrect } = useMemo(() => {
    const total = state.totalSolicitado;
    const nd30 = state.nd30Manual;
    const nd39 = state.nd39Manual;
    
    // Se o total for 0, as NDs devem ser 0
    if (total === 0) {
        return {
            valorND30: 0,
            valorND39: 0,
            totalAlocado: 0,
            isAllocationCorrect: true,
        };
    }

    // 1. Calcular ND 39 (dependente) com base em ND 30
    const calculatedND39 = Math.max(0, total - nd30);
    
    // 2. Calcular ND 30 (dependente) com base em ND 39
    const calculatedND30 = Math.max(0, total - nd39);
    
    // 3. Determinar qual ND é a dependente (a que foi alterada por último)
    // Para Verba Operacional (ND 30 manual, ND 39 calculada)
    const finalND30_VO = nd30;
    const finalND39_VO = calculatedND39;
    const totalAlocado_VO = finalND30_VO + finalND39_VO;
    
    // Para Suprimento de Fundos (ND 39 manual, ND 30 calculada)
    const finalND39_SF = nd39;
    const finalND30_SF = calculatedND30;
    const totalAlocado_SF = finalND30_SF + finalND39_SF;
    
    // O hook precisa ser flexível. Vamos retornar ambos os pares de cálculo
    // e deixar o componente de formulário escolher qual usar (VO ou SF).
    // No entanto, para simplificar o retorno do hook, vamos assumir que
    // o componente de formulário que usa este hook define qual ND é manual.
    
    // Como o hook é usado em Verba Operacional (ND 30 manual) e Suprimento de Fundos (ND 39 manual),
    // vamos retornar os valores baseados no estado atual.
    
    // Se ND30 foi alterada por último (ou é o modo padrão VO)
    const isND30Manual = rawND30Input !== numberToRawDigits(calculatedND30);
    
    let finalND30 = isND30Manual ? nd30 : calculatedND30;
    let finalND39 = isND30Manual ? calculatedND39 : nd39;
    
    // Se o total for alterado, ambos são recalculados proporcionalmente, mas aqui
    // estamos focando na diferença.
    
    // Para simplificar, vamos forçar o cálculo baseado em ND30 (Verba Operacional)
    // e ND39 (Suprimento de Fundos) e deixar o componente escolher qual par usar.
    
    // Retornamos o par que foi alterado por último (ou o par que está sendo usado no formulário)
    // Para evitar complexidade de rastreamento de "última alteração", vamos retornar
    // os valores brutos do estado e deixar o componente fazer a lógica de diferença.
    
    // CORREÇÃO: O hook deve ser usado para gerenciar o estado de 3 inputs (Total, ND30, ND39)
    // e garantir que a soma de ND30 e ND39 seja igual ao Total.
    
    // Vamos retornar os valores do estado e a correção de alocação.
    
    const total = state.totalSolicitado;
    const nd30 = state.nd30Manual;
    const nd39 = state.nd39Manual;
    
    const totalAlocadoFinal = nd30 + nd39;
    const allocationCorrect = Math.abs(totalAlocadoFinal - total) < 0.01;

    return {
        valorND30: nd30,
        valorND39: nd39,
        totalAlocado: totalAlocadoFinal,
        isAllocationCorrect: allocationCorrect,
    };
  }, [state.totalSolicitado, state.nd30Manual, state.nd39Manual]);
  
  // Handlers de Input
  
  const handleTotalChange = useCallback((numericValue: number, rawDigits: string) => {
    setRawTotalInput(rawDigits);
    setState(prev => {
        const total = numericValue;
        const nd30 = prev.nd30Manual;
        const nd39 = prev.nd39Manual;
        
        // Se o total for alterado, a alocação deve ser mantida proporcionalmente
        // ou, se for 0, resetar as NDs.
        if (total === 0) {
            setRawND30Input(numberToRawDigits(0));
            setRawND39Input(numberToRawDigits(0));
            return { totalSolicitado: 0, nd30Manual: 0, nd39Manual: 0 };
        }
        
        // Se o total anterior era 0, aloca tudo para ND30 (padrão)
        if (prev.totalSolicitado === 0) {
            setRawND30Input(numberToRawDigits(total));
            setRawND39Input(numberToRawDigits(0));
            return { totalSolicitado: total, nd30Manual: total, nd39Manual: 0 };
        }
        
        // Se o total mudou, mas a alocação anterior estava correta,
        // mantemos a proporção.
        const totalAlocadoAnterior = nd30 + nd39;
        if (Math.abs(totalAlocadoAnterior - prev.totalSolicitado) < 0.01) {
            const ratio30 = nd30 / prev.totalSolicitado;
            const ratio39 = nd39 / prev.totalSolicitado;
            
            const newND30 = Math.round(total * ratio30 * 100) / 100;
            const newND39 = Math.round(total * ratio39 * 100) / 100;
            
            setRawND30Input(numberToRawDigits(newND30));
            setRawND39Input(numberToRawDigits(newND39));
            
            return { totalSolicitado: total, nd30Manual: newND30, nd39Manual: newND39 };
        }
        
        // Se a alocação anterior estava incorreta, mantemos as NDs como estão
        // e apenas atualizamos o total solicitado.
        return { ...prev, totalSolicitado: total };
    });
  }, []);

  const handleND30Change = useCallback((numericValue: number, rawDigits: string) => {
    setRawND30Input(rawDigits);
    setState(prev => {
        const nd30 = numericValue;
        const total = prev.totalSolicitado;
        
        // ND 30 não pode ser maior que o total
        const cappedND30 = Math.min(total, nd30);
        
        // ND 39 é a diferença
        const newND39 = Math.max(0, total - cappedND30);
        
        setRawND39Input(numberToRawDigits(newND39));
        
        return { ...prev, nd30Manual: cappedND30, nd39Manual: newND39 };
    });
  }, []);

  const handleND39Change = useCallback((numericValue: number, rawDigits: string) => {
    setRawND39Input(rawDigits);
    setState(prev => {
        const nd39 = numericValue;
        const total = prev.totalSolicitado;
        
        // ND 39 não pode ser maior que o total
        const cappedND39 = Math.min(total, nd39);
        
        // ND 30 é a diferença
        const newND30 = Math.max(0, total - cappedND39);
        
        setRawND30Input(numberToRawDigits(newND30));
        
        return { ...prev, nd30Manual: newND30, nd39Manual: cappedND39 };
    });
  }, []);
  
  const resetAllocation = useCallback(() => {
    setState({ totalSolicitado: 0, nd30Manual: 0, nd39Manual: 0 });
    setRawTotalInput(numberToRawDigits(0));
    setRawND30Input(numberToRawDigits(0));
    setRawND39Input(numberToRawDigits(0));
  }, []);

  return {
    totalSolicitado: state.totalSolicitado,
    valorND30: valorND30,
    valorND39: valorND39,
    totalAlocado: totalAlocado,
    isAllocationCorrect: isAllocationCorrect,
    
    rawTotalInput,
    rawND30Input,
    rawND39Input,

    handleTotalChange,
    handleND30Change,
    handleND39Change,
    
    resetAllocation,
  };
};