import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Save, Trash2 } from "lucide-react";
import type { Channel } from "@/api/channels";
import { updateChannel, deleteChannel } from "@/api/channels";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ChannelConfigTabProps {
  channel: Channel;
}

export function ChannelConfigTab({ channel }: ChannelConfigTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(channel.description ?? "");
  const [owner, setOwner] = useState(channel.owner);
  const [error, setError] = useState("");

  const updateMutation = useMutation({
    mutationFn: () => updateChannel(channel.slug, { description, owner }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["channels", channel.slug] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChannel(channel.slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      navigate({ to: "/channels" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuracao do Canal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-slug">Slug</Label>
            <Input id="channel-slug" value={channel.slug} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-type">Tipo</Label>
            <Input id="channel-type" value={channel.type} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-owner">Owner</Label>
            <Input
              id="channel-owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-description">Descricao</Label>
            <Textarea
              id="channel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Save className="mr-1 size-4" />
            {updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Zona Perigosa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Ao excluir o canal, todas as configuracoes serao perdidas. Esta acao
            nao pode ser desfeita.
          </p>
          <ConfirmDialog
            title="Excluir Canal"
            description={`Tem certeza que deseja excluir o canal "${channel.slug}"? Esta acao nao pode ser desfeita.`}
            onConfirm={() => deleteMutation.mutate()}
            destructive
          >
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="mr-1 size-4" />
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Canal"}
            </Button>
          </ConfirmDialog>
        </CardContent>
      </Card>
    </div>
  );
}
