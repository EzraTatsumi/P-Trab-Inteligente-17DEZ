import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Search } from "lucide-react";
import { ItemServico, DiretrizServicoTerceiro } from "@/types/diretrizesServicosTerceiros";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ServicosTerceirosDiretrizFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: DiretrizServicoTerceiro | null;
  isSaving?: boolean;
}

export function ServicosTerceirosDiretrizFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSaving
}: ServicosTerceirosDiretrizFormDialogProps) {
  const [nrSubitem, setNrSubitem] = useState("");
  const [nomeSubitem, setNomeSubitem] = useState("");
  const [descricaoSubitem, setDescricaoSubitem] = useState("");
  const [itens, setItens] = useState<ItemServico[]>([]);

  useEffect(() => {
    if (initialData) {
      setNrSubitem(initialData.nr_subitem);
      setNomeSubitem(initialData.nome_subitem);
      setDescricaoSubitem(initialData.descricao_subitem || "");
      setItens(initialData.itens_aquisicao || []);
    } else {
      setNrSubitem("");
      setNomeSubitem("");
      setDescricaoSubitem("");
      setItens([]);
    }
  }, [initialData, open]);

  const handleAddItem = () => {
    const newItem: ItemServico = {
      id: crypto.randomUUID(),
      codigo_catser: "",
      descricao_item: "",
      nome_reduzido: "",
      unidade_medida: "",
      valor_unitario: 0,
      numero_pregao: "",
      uasg: ""
    };
    setItens([...itens, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItens(itens.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof ItemServico, value: any) => {
    setItens(itens.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nrSubitem || !nomeSubitem) {
      toast.error("Preencha o número e o nome do subitem.");
      return;
    }

    if (itens.length === 0) {
      toast.error("Adicione pelo menos um item de serviço.");
      return;
    }

    // Validação básica dos itens
    const invalidItem = itens.find(i => !i.descricao_item || !i.nome_reduzido || !i.unidade_medida);
    if (invalidItem) {
      toast.error("Todos os itens devem ter descrição, nome reduzido e unidade de medida.");
      return;
    }

    try {
      await onSubmit({
        id: initialData?.id,
        nr_subitem: nrSubitem,
        nome_subitem: nomeSubitem,
        descricao_subitem: descricaoSubitem,
        itens_aquisicao: itens,
        ativo: initialData ? initialData.ativo : true
      });
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Diretriz de Serviço" : "Nova Diretriz de Serviço"}</DialogTitle>
          <DialogDescription>
            Configure o subitem da ND 33.90.39 e seus respectivos itens de serviço.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nr_subitem">Nr. Subitem (Ex: 01)</Label>
              <Input 
                id="nr_subitem" 
                value={nrSubitem} 
                onChange={e => setNrSubitem(e.target.value)} 
                placeholder="01"
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="nome_subitem">Nome do Subitem</Label>
              <Input 
                id="nome_subitem" 
                value={nomeSubitem} 
                onChange={e => setNomeSubitem(e.target.value)} 
                placeholder="Ex: Manutenção de Viaturas"
                required
              />
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label htmlFor="descricao_subitem">Descrição/Observações</Label>
              <Textarea 
                id="descricao_subitem" 
                value={descricaoSubitem} 
                onChange={e => setDescricaoSubitem(e.target.value)} 
                placeholder="Detalhes adicionais sobre este subitem..."
                rows={2}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden border rounded-md">
            <div className="bg-muted p-2 flex justify-between items-center border-b">
              <h3 className="font-semibold text-sm">Itens de Serviço Vinculados</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Item
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Cód. CATSER</TableHead>
                    <TableHead>Descrição Completa</TableHead>
                    <TableHead className="w-[150px]">Nome Reduzido</TableHead>
                    <TableHead className="w-[100px]">Unidade</TableHead>
                    <TableHead className="w-[120px]">Vlr. Unitário</TableHead>
                    <TableHead className="w-[120px]">Pregão/ARP</TableHead>
                    <TableHead className="w-[80px]">UASG</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum item adicionado. Clique em "Adicionar Item".
                      </TableCell>
                    </TableRow>
                  ) : (
                    itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Input 
                            value={item.codigo_catser} 
                            onChange={e => handleUpdateItem(item.id, 'codigo_catser', e.target.value)}
                            placeholder="Cód."
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.descricao_item} 
                            onChange={e => handleUpdateItem(item.id, 'descricao_item', e.target.value)}
                            placeholder="Descrição do serviço..."
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.nome_reduzido} 
                            onChange={e => handleUpdateItem(item.id, 'nome_reduzido', e.target.value)}
                            placeholder="Nome curto"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.unidade_medida} 
                            onChange={e => handleUpdateItem(item.id, 'unidade_medida', e.target.value)}
                            placeholder="Ex: Mês"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            type="number"
                            step="0.01"
                            value={item.valor_unitario} 
                            onChange={e => handleUpdateItem(item.id, 'valor_unitario', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.numero_pregao} 
                            onChange={e => handleUpdateItem(item.id, 'numero_pregao', e.target.value)}
                            placeholder="00/00"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Input 
                            value={item.uasg} 
                            onChange={e => handleUpdateItem(item.id, 'uasg', e.target.value)}
                            placeholder="UASG"
                            className="h-8 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? "Atualizar Diretriz" : "Salvar Diretriz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}