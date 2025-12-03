import React from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { PTrab } from "@/hooks/usePTrabManager";

interface PTrabFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
  editingId: string | null;
  originalPTrabIdToClone: string | null;
  selectedOmId: string | undefined;
  setSelectedOmId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const PTrabFormDialog: React.FC<PTrabFormDialogProps> = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  handleSubmit,
  loading,
  editingId,
  originalPTrabIdToClone,
  selectedOmId,
  setSelectedOmId,
}) => {
  const { handleEnterToNextField } = useFormNavigation();

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmId(omData.id);
      setFormData({
        ...formData,
        nome_om: omData.nome_om,
        codug_om: omData.codug_om,
        rm_vinculacao: omData.rm_vinculacao,
        codug_rm_vinculacao: omData.codug_rm_vinculacao,
      });
    } else {
      setSelectedOmId(undefined);
      setFormData({
        ...formData,
        nome_om: "",
        codug_om: "",
        rm_vinculacao: "",
        codug_rm_vinculacao: "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar P Trab" : "Novo P Trab"}</DialogTitle>
          {originalPTrabIdToClone && (
            <DialogDescription className="text-green-600 font-medium">
              Clonando dados de classes do P Trab original. Edite o cabeçalho e clique em Criar.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* L1L: Número do P Trab (Minuta/Obrigatório) */}
            <div className="space-y-2">
              <Label htmlFor="numero_ptrab">Número do P Trab *</Label>
              <Input
                id="numero_ptrab"
                value={formData.numero_ptrab}
                onChange={(e) => setFormData({ ...formData, numero_ptrab: e.target.value })}
                placeholder="Minuta"
                maxLength={50}
                required
                onKeyDown={handleEnterToNextField}
                disabled={formData.numero_ptrab.startsWith("Minuta") && !editingId}
                className={formData.numero_ptrab.startsWith("Minuta") && !editingId ? "bg-muted/50 cursor-not-allowed" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {formData.numero_ptrab.startsWith("Minuta") 
                  ? "A numeração oficial (padrão: número/ano/OM) será atribuída após a aprovação."
                  : "O número oficial já foi atribuído."
                }
              </p>
            </div>
            {/* L1R: Nome da Operação */}
            <div className="space-y-2">
              <Label htmlFor="nome_operacao">Nome da Operação *</Label>
              <Input
                id="nome_operacao"
                value={formData.nome_operacao}
                onChange={(e) => setFormData({ ...formData, nome_operacao: e.target.value })}
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            
            {/* L2L: Comando Militar de Área */}
            <div className="space-y-2">
              <Label htmlFor="comando_militar_area">Comando Militar de Área *</Label>
              <Input
                id="comando_militar_area"
                value={formData.comando_militar_area}
                onChange={(e) => setFormData({ ...formData, comando_militar_area: e.target.value })}
                placeholder="Ex: Comando Militar da Amazônia"
                maxLength={100}
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            {/* L2R: Nome da OM (por extenso) */}
            <div className="space-y-2">
              <Label htmlFor="nome_om_extenso">Nome da OM (por extenso) *</Label>
              <Input
                id="nome_om_extenso"
                value={formData.nome_om_extenso}
                onChange={(e) => setFormData({ ...formData, nome_om_extenso: e.target.value })}
                placeholder="Ex: Comando da 23ª Brigada de Infantaria de Selva"
                maxLength={300}
                required
                onKeyDown={handleEnterToNextField}
              />
              <p className="text-xs text-muted-foreground">
                Este nome será usado no cabeçalho do P Trab impresso
              </p>
            </div>

            {/* L3L: Nome da OM (sigla) */}
            <div className="space-y-2">
              <Label htmlFor="nome_om">Nome da OM (sigla) *</Label>
              <OmSelector
                selectedOmId={selectedOmId}
                onChange={handleOMChange}
                placeholder="Selecione uma OM..."
                disabled={loading}
              />
              {formData.codug_om && (
                <p className="text-xs text-muted-foreground">
                  CODUG: {formData.codug_om} | RM: {formData.rm_vinculacao}
                </p>
              )}
            </div>
            {/* L3R: Efetivo Empregado */}
            <div className="space-y-2">
              <Label htmlFor="efetivo_empregado">Efetivo Empregado *</Label>
              <Input
                id="efetivo_empregado"
                value={formData.efetivo_empregado}
                onChange={(e) => setFormData({ ...formData, efetivo_empregado: e.target.value })}
                placeholder="Ex: 110 militares e 250 OSP"
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>

            {/* L4L: Período Início */}
            <div className="space-y-2">
              <Label htmlFor="periodo_inicio">Período Início *</Label>
              <Input
                id="periodo_inicio"
                type="date"
                value={formData.periodo_inicio}
                onChange={(e) => setFormData({ ...formData, periodo_inicio: e.target.value })}
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            {/* L4R: Período Fim */}
            <div className="space-y-2">
              <Label htmlFor="periodo_fim">Período Fim *</Label>
              <Input
                id="periodo_fim"
                type="date"
                value={formData.periodo_fim}
                onChange={(e) => setFormData({ ...formData, periodo_fim: e.target.value })}
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            
            {/* L5L: Local da OM */}
            <div className="space-y-2">
              <Label htmlFor="local_om">Local da OM *</Label>
              <Input
                id="local_om"
                value={formData.local_om}
                onChange={(e) => setFormData({ ...formData, local_om: e.target.value })}
                placeholder="Ex: Marabá/PA"
                maxLength={200}
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
            {/* L5R: Nome do Comandante da OM */}
            <div className="space-y-2">
              <Label htmlFor="nome_cmt_om">Nome do Comandante da OM *</Label>
              <Input
                id="nome_cmt_om"
                value={formData.nome_cmt_om}
                onChange={(e) => setFormData({ ...formData, nome_cmt_om: e.target.value })}
                maxLength={200}
                required
                onKeyDown={handleEnterToNextField}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acoes">Ações realizadas ou a serem realizadas *</Label>
            <Textarea
              id="acoes"
              value={formData.acoes}
              onChange={(e) => setFormData({ ...formData, acoes: e.target.value })}
              rows={4}
              maxLength={2000}
              required
              onKeyDown={handleEnterToNextField}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Aguarde..." : (editingId ? "Atualizar" : "Criar")}
            </Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};