import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { request } from "@/lib/api";

interface SecurityRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecurityRuleDialog({ open, onOpenChange }: SecurityRuleDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState<"keyword" | "regex">("keyword");
  const [pattern, setPattern] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [action, setAction] = useState("flagged");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim() || !pattern.trim()) {
      setError("Nome e padrao sao obrigatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // pattern for keyword is JSON array of strings
      let patternValue = pattern;
      if (ruleType === "keyword") {
        // parse as comma-separated and store as JSON array
        const keywords = pattern
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        patternValue = JSON.stringify(keywords);
      }
      await request("/security/rules", {
        method: "POST",
        body: JSON.stringify({ name, description, rule_type: ruleType, pattern: patternValue, severity, action }),
      });
      await queryClient.invalidateQueries({ queryKey: ["security", "rules"] });
      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar regra.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
    setRuleType("keyword");
    setPattern("");
    setSeverity("medium");
    setAction("flagged");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Regra de Seguranca</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Nome</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: prompt_injection_custom"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-description">Descricao</Label>
            <Input
              id="rule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descricao opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={ruleType} onValueChange={(v) => setRuleType(v as "keyword" | "regex")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Keyword</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Severidade</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v ?? "medium")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Critica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-pattern">
              {ruleType === "keyword" ? "Palavras-chave (separadas por virgula)" : "Padrao Regex"}
            </Label>
            <Textarea
              id="rule-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={
                ruleType === "keyword"
                  ? "palavra1, palavra2, frase de exemplo"
                  : "^ignore.*instructions"
              }
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Acao</Label>
            <Select value={action} onValueChange={(v) => setAction(v ?? "flagged")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flagged">Sinalizar (flagged)</SelectItem>
                <SelectItem value="blocked">Bloquear (blocked)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
