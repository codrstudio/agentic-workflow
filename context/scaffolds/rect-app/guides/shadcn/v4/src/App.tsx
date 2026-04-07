import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { AlertCircle, AlertTriangle, CheckCircle, Info, ChevronDown, Sun, Moon } from "lucide-react"
import { useState } from "react"
import { useTheme } from "@/components/theme-provider"

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
      <Separator />
    </section>
  )
}

export function App() {
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium">shadcn/ui v4 — Referencia ai-chat</h1>
          <p className="text-sm text-muted-foreground">
            Componentes usados no pacote @agentic-backbone/ai-chat, renderizados com shadcn padrao.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Alternar tema"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      <Separator />

      {/* ── Alert ── */}
      <Section title="Alert" description="Callouts para chamar atencao do usuario. Variantes: default e destructive.">
        <div className="space-y-3">
          <Alert>
            <Info />
            <AlertTitle>Informacao</AlertTitle>
            <AlertDescription>
              Manutencao programada para domingo, 02h as 04h.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Falha critica</AlertTitle>
            <AlertDescription>
              Conexao com o cluster primario perdida as 14:32. Failover automatico ativado.
            </AlertDescription>
          </Alert>

          <Alert>
            <CheckCircle />
            <AlertTitle>Deploy concluido</AlertTitle>
            <AlertDescription>
              Versao 2.4.1 publicada com sucesso em producao. Todas as 47 instancias atualizadas.
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertTriangle />
            <AlertTitle>Uso de recursos elevado</AlertTitle>
            <AlertDescription>
              Memoria acima de 85% nos workers 3, 7 e 12.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      {/* ── Badge ── */}
      <Section title="Badge" description="Labels de status, tags e contadores.">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      {/* ── Button ── */}
      <Section title="Button" description="Acoes clicaveis. Variantes e tamanhos.">
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">XS</Button>
          <Button size="sm">SM</Button>
          <Button size="default">Default</Button>
          <Button size="lg">LG</Button>
        </div>
      </Section>

      {/* ── Card ── */}
      <Section title="Card" description="Container de conteudo com header, content e footer.">
        <Card>
          <CardHeader>
            <CardTitle>Titulo do card</CardTitle>
            <CardDescription>Descricao breve do conteudo.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Conteudo principal do card. Pode conter qualquer elemento.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">Cancelar</Button>
            <Button size="sm" className="ml-auto">Salvar</Button>
          </CardFooter>
        </Card>
      </Section>

      {/* ── Collapsible ── */}
      <Section title="Collapsible" description="Painel expansivel/colapsavel.">
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              3 itens ocultos
              <ChevronDown className={`transition-transform ${collapsibleOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <div className="rounded-md border px-3 py-2 text-sm">Item 1</div>
            <div className="rounded-md border px-3 py-2 text-sm">Item 2</div>
            <div className="rounded-md border px-3 py-2 text-sm">Item 3</div>
          </CollapsibleContent>
        </Collapsible>
      </Section>

      {/* ── Dialog ── */}
      <Section title="Dialog" description="Modal overlay para confirmacoes e formularios.">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Abrir dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar acao</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja continuar? Esta acao nao pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancelar</Button>
              <Button>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* ── Progress ── */}
      <Section title="Progress" description="Barra de progresso.">
        <div className="space-y-3">
          <Progress value={25} />
          <Progress value={60} />
          <Progress value={100} />
        </div>
      </Section>

      {/* ── ScrollArea ── */}
      <Section title="ScrollArea" description="Container com scroll customizado.">
        <ScrollArea className="h-40 rounded-md border p-3">
          <div className="space-y-2 text-sm">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i}>Item {i + 1} — conteudo de exemplo para scroll</div>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* ── Separator ── */}
      <Section title="Separator" description="Divisor visual entre secoes.">
        <div className="space-y-2 text-sm">
          <p>Conteudo acima</p>
          <Separator />
          <p>Conteudo abaixo</p>
        </div>
      </Section>

      {/* ── Table ── */}
      <Section title="Table" description="Exibicao de dados tabulares.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Servico A</TableCell>
              <TableCell><Badge variant="secondary">Ativo</Badge></TableCell>
              <TableCell className="text-right">R$ 250,00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Servico B</TableCell>
              <TableCell><Badge variant="destructive">Erro</Badge></TableCell>
              <TableCell className="text-right">R$ 1.200,00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Servico C</TableCell>
              <TableCell><Badge variant="outline">Pendente</Badge></TableCell>
              <TableCell className="text-right">R$ 89,90</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Section>
    </div>
  )
}

export default App
