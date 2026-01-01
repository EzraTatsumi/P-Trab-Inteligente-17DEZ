// ... (imports)
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
// ... (restante do código)

// ... (funções auxiliares)

const ClasseIIIForm = () => {
// ... (estados)

// ... (funções de carregamento e manipulação)

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    setLoading(true);
    try {
      // Usar TablesUpdate para tipagem correta
      const updatePayload: TablesUpdate<'classe_iii_registros'> = {
          detalhamento_customizado: memoriaEdit.trim() || null,
          // O updated_at é atualizado por um trigger no DB, mas podemos forçar aqui também
          updated_at: new Date().toISOString(), 
      };
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update(updatePayload) // Usando o payload tipado
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      
      // Limpar estados de edição
      setEditingMemoriaId(null);
      setMemoriaEdit("");
      
      // Recarregar registros para refletir a mudança na UI
      await fetchRegistros(); 
      
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error("Erro ao salvar memória de cálculo");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
          updated_at: new Date().toISOString(),
        } as TablesUpdate<'classe_iii_registros'>) // Usando TablesUpdate
        .eq("id", registroId);
      if (error) throw error;
      toast.success("Memória de cálculo restaurada!");
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

// ... (restante do código)