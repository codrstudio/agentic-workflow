import { Link } from "@tanstack/react-router";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RatingItem } from "@/api/ratings";

const CATEGORY_LABELS: Record<string, string> = {
  wrong_info: "Info incorreta",
  off_topic: "Fora do topico",
  too_long: "Muito longa",
  rude: "Tom inadequado",
  other: "Outro",
};

interface RatingsTableProps {
  items: RatingItem[];
}

export function RatingsTable({ items }: RatingsTableProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma avaliacao encontrada para os filtros selecionados.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Avaliacao</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Conversa</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(item.rated_at).toLocaleDateString("pt-BR")}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {item.channel_type}
              </Badge>
            </TableCell>
            <TableCell>
              {item.rating === "up" ? (
                <span className="flex items-center gap-1 text-green-600 text-sm">
                  <ThumbsUp className="size-3.5 fill-current" />
                  Positivo
                </span>
              ) : (
                <span className="flex items-center gap-1 text-destructive text-sm">
                  <ThumbsDown className="size-3.5 fill-current" />
                  Negativo
                </span>
              )}
            </TableCell>
            <TableCell className="text-xs">
              {item.reason_cat ? (CATEGORY_LABELS[item.reason_cat] ?? item.reason_cat) : "—"}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
              {item.reason ?? "—"}
            </TableCell>
            <TableCell>
              <Link
                to="/conversations/$id"
                params={{ id: item.session_id }}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Ver
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
