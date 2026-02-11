import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2, Settings2, Briefcase, UserCog } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useServicosTerceirosDiretrizes } from "@/hooks/useServicosTerceirosDiretrizes";
import { ServicosTerceirosDiretrizRow } from "@/components/ServicosTerceirosDiretrizRow";
import { ServicosTerceirosDiretrizFormDialog } from "@/components/ServicosTerceirosDiretrizFormDialog";
import { DiretrizServicoTerceiro } from "@/types/diretrizesServicosTerceiros";
import PageMetadata from "@/components/PageMetadata";

const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeTab, setActiveTab] = useState("servicos");
  
  // Hook para Serviços de Terceiros
  const { 
    diretrizes, 
    isLoading, 
    saveDiretriz, 
    isSaving, 
    deleteDiretriz, 
    toggleAtivo 
  } = useServicosTerceirosDiretrizes(selectedYear);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDiretriz, setEditingDiretriz] = useState<DiretrizServicoTerceiro | null>(null);

  const handleEdit = (diretriz: DiretrizServicoTerceiro) => {
    setEditingDiretriz(diretriz);
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingDiretriz(null);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <PageMetadata 
        title="Configurações de Custos Operacionais" 
        description="Gerencie as diretrizes de custos operacionais, diárias e serviços de terceiros."
      />
      
      <div className="container max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/ptrab")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings2 className="h-8 w-8 text-primary" />
              Custos Operacionais
            </h1>
          </div>

          <div className="flex items-center gap-2 bg-muted p-1 rounded-md border">
            <span className="text-xs font-medium px-2 text-muted-foreground uppercase">Ano de Referência:</span>
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(v) => setSelectedYear(parseInt(v))}
            >
              <SelectTrigger className="w-[100px] h-8 border-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="servicos" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Serviços de Terceiros (33.90.39)
            </TabsTrigger>
            <TabsTrigger value="outros" disabled className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Outras Diretrizes (Em breve)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="servicos" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Diretrizes de Serviços de Terceiros - {selectedYear}</CardTitle>
                  <CardDescription>
                    Cadastre os subitens da Natureza de Despesa 33.90.39 e seus respectivos itens de serviço.
                  </CardDescription>
                </div>
                <Button onClick={handleAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Diretriz
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-muted-foreground">Carregando diretrizes...</p>
                  </div>
                ) : diretrizes.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-lg font-medium">Nenhuma diretriz para {selectedYear}</h3>
                    <p className="text-muted-foreground mb-4">Comece cadastrando um subitem e seus itens de serviço.</p>
                    <Button variant="outline" onClick={handleAdd}>
                      <Plus className="mr-2 h-4 w-4" /> Criar Primeira Diretriz
                    </Button>
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead className="w-[100px]">Subitem</TableHead>
                          <TableHead>Nome do Subitem</TableHead>
                          <TableHead className="w-[120px]">Qtd. Itens</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="text-right w-[150px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diretrizes.map((diretriz) => (
                          <ServicosTerceirosDiretrizRow 
                            key={diretriz.id}
                            diretriz={diretriz}
                            onEdit={handleEdit}
                            onDelete={deleteDiretriz}
                            onToggleAtivo={(id, status) => toggleAtivo({ id, ativo: !status })}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ServicosTerceirosDiretrizFormDialog 
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={editingDiretriz}
        onSubmit={saveDiretriz}
        isSaving={isSaving}
      />
    </div>
  );
};

export default CustosOperacionaisPage;