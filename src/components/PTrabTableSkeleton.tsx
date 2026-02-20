import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const PTrabTableSkeleton = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px] text-center">Número</TableHead>
          <TableHead>Operação</TableHead>
          <TableHead className="text-center">Período</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-center">Valor P Trab</TableHead>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRow key={i}>
            <TableCell><div className="flex flex-col items-center gap-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-12" /></div></TableCell>
            <TableCell><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-24" /></div></TableCell>
            <TableCell><div className="flex flex-col items-center gap-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div></TableCell>
            <TableCell><div className="flex flex-col items-center gap-2"><Skeleton className="h-7 w-32 rounded-full" /><Skeleton className="h-3 w-24" /></div></TableCell>
            <TableCell><div className="space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-4 w-full" /></div></TableCell>
            <TableCell><Skeleton className="h-8 w-8 rounded-full mx-auto" /></TableCell>
            <TableCell><div className="flex justify-end gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-8" /></div></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};