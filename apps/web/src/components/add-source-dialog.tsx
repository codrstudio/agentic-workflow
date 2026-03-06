import { useState, useEffect, useRef, useCallback } from "react";
import { z } from "zod";
import { Upload, Link, PenLine, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateSource,
  useUploadSource,
  type Source,
} from "@/hooks/use-sources";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type TabId = "write" | "upload" | "url";

const TABS: { id: TabId; label: string; icon: typeof PenLine }[] = [
  { id: "write", label: "Escrever", icon: PenLine },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "url", label: "URL", icon: Link },
];

const SOURCE_TYPES: { value: Source["type"]; label: string }[] = [
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Text" },
  { value: "code", label: "Code" },
];

const ACCEPTED_EXTENSIONS = [".pdf", ".md", ".txt"];
const ACCEPTED_MIME =
  "application/pdf,.pdf,text/markdown,.md,text/plain,.txt";

const writeSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(200),
  type: z.enum(["markdown", "text", "code"]),
  content: z.string().min(1, "Conteudo e obrigatorio"),
});

const urlSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(200),
  url: z.string().url("URL invalida"),
});

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
}

export function AddSourceDialog({
  open,
  onOpenChange,
  projectSlug,
}: AddSourceDialogProps) {
  const isMobile = useIsMobile();
  const createMutation = useCreateSource(projectSlug);
  const uploadMutation = useUploadSource(projectSlug);

  const [activeTab, setActiveTab] = useState<TabId>("write");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Write tab state
  const [writeName, setWriteName] = useState("");
  const [writeType, setWriteType] = useState<Source["type"]>("markdown");
  const [writeContent, setWriteContent] = useState("");
  const [writeTags, setWriteTags] = useState<string[]>([]);
  const [writeTagInput, setWriteTagInput] = useState("");

  // Upload tab state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagInput, setUploadTagInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL tab state
  const [urlValue, setUrlValue] = useState("");
  const [urlName, setUrlName] = useState("");
  const [urlTags, setUrlTags] = useState<string[]>([]);
  const [urlTagInput, setUrlTagInput] = useState("");

  const isPending = createMutation.isPending || uploadMutation.isPending;

  useEffect(() => {
    if (open) {
      setActiveTab("write");
      setErrors({});
      setWriteName("");
      setWriteType("markdown");
      setWriteContent("");
      setWriteTags([]);
      setWriteTagInput("");
      setUploadFile(null);
      setUploadName("");
      setUploadTags([]);
      setUploadTagInput("");
      setUrlValue("");
      setUrlName("");
      setUrlTags([]);
      setUrlTagInput("");
      setIsDragging(false);
      createMutation.reset();
      uploadMutation.reset();
    }
  }, [open]);

  function addTag(
    tags: string[],
    setTags: (t: string[]) => void,
    input: string,
    setInput: (s: string) => void,
  ) {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setInput("");
  }

  function removeTag(tags: string[], setTags: (t: string[]) => void, tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(
    e: React.KeyboardEvent,
    tags: string[],
    setTags: (t: string[]) => void,
    input: string,
    setInput: (s: string) => void,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tags, setTags, input, setInput);
    }
  }

  const isValidFile = useCallback((file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setUploadFile(file);
      if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleSubmit() {
    setErrors({});

    if (activeTab === "write") {
      const result = writeSchema.safeParse({
        name: writeName.trim(),
        type: writeType,
        content: writeContent,
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key && typeof key === "string") fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }
      createMutation.mutate(
        {
          name: result.data.name,
          type: result.data.type,
          content: result.data.content,
          tags: writeTags.length > 0 ? writeTags : undefined,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else if (activeTab === "upload") {
      if (!uploadFile) {
        setErrors({ file: "Selecione um arquivo" });
        return;
      }
      const formData = new FormData();
      formData.append("file", uploadFile);
      if (uploadName.trim()) formData.append("name", uploadName.trim());
      if (uploadTags.length > 0) formData.append("tags", JSON.stringify(uploadTags));
      uploadMutation.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      const result = urlSchema.safeParse({
        name: urlName.trim(),
        url: urlValue.trim(),
      });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const key = issue.path[0];
          if (key && typeof key === "string") fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        return;
      }
      createMutation.mutate(
        {
          name: result.data.name,
          type: "url",
          url: result.data.url,
          tags: urlTags.length > 0 ? urlTags : undefined,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  }

  function TagInput({
    tags,
    setTags,
    tagInput,
    setTagInput,
  }: {
    tags: string[];
    setTags: (t: string[]) => void;
    tagInput: string;
    setTagInput: (s: string) => void;
  }) {
    return (
      <div className="flex flex-col gap-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tags, setTags, tag)}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => handleTagKeyDown(e, tags, setTags, tagInput, setTagInput)}
            placeholder="Add tag + Enter"
            className="h-7 w-32 text-xs"
          />
        </div>
      </div>
    );
  }

  const tabBar = (
    <div className="flex border-b">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            setActiveTab(tab.id);
            setErrors({});
          }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );

  const writeTab = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="write-name">Nome *</Label>
        <Input
          id="write-name"
          value={writeName}
          onChange={(e) => setWriteName(e.target.value)}
          placeholder="Nome do source"
          aria-invalid={!!errors["name"]}
        />
        {errors["name"] && (
          <p className="text-sm text-destructive">{errors["name"]}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="write-type">Tipo</Label>
        <select
          id="write-type"
          value={writeType}
          onChange={(e) => setWriteType(e.target.value as Source["type"])}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {SOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="write-content">Conteudo *</Label>
        <Textarea
          id="write-content"
          value={writeContent}
          onChange={(e) => setWriteContent(e.target.value)}
          placeholder="Conteudo do source..."
          rows={8}
          aria-invalid={!!errors["content"]}
        />
        {errors["content"] && (
          <p className="text-sm text-destructive">{errors["content"]}</p>
        )}
      </div>
      <TagInput
        tags={writeTags}
        setTags={setWriteTags}
        tagInput={writeTagInput}
        setTagInput={setWriteTagInput}
      />
    </div>
  );

  const uploadTab = (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        {uploadFile ? (
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-medium">{uploadFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(uploadFile.size / 1024).toFixed(1)} KB
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setUploadFile(null);
              }}
            >
              Remover
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">
              Arraste um arquivo aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, Markdown ou Text (max 10MB)
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {errors["file"] && (
        <p className="text-sm text-destructive">{errors["file"]}</p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="upload-name">Nome</Label>
        <Input
          id="upload-name"
          value={uploadName}
          onChange={(e) => setUploadName(e.target.value)}
          placeholder="Nome do source (auto do arquivo)"
        />
      </div>
      <TagInput
        tags={uploadTags}
        setTags={setUploadTags}
        tagInput={uploadTagInput}
        setTagInput={setUploadTagInput}
      />
    </div>
  );

  const urlTab = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="url-input">URL *</Label>
        <Input
          id="url-input"
          type="url"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          placeholder="https://..."
          aria-invalid={!!errors["url"]}
        />
        {errors["url"] && (
          <p className="text-sm text-destructive">{errors["url"]}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="url-name">Nome *</Label>
        <Input
          id="url-name"
          value={urlName}
          onChange={(e) => setUrlName(e.target.value)}
          placeholder="Nome do source"
          aria-invalid={!!errors["name"]}
        />
        {errors["name"] && (
          <p className="text-sm text-destructive">{errors["name"]}</p>
        )}
      </div>
      <TagInput
        tags={urlTags}
        setTags={setUrlTags}
        tagInput={urlTagInput}
        setTagInput={setUrlTagInput}
      />
    </div>
  );

  const tabContent = (
    <div className="py-4">
      {activeTab === "write" && writeTab}
      {activeTab === "upload" && uploadTab}
      {activeTab === "url" && urlTab}
    </div>
  );

  const mutationError = createMutation.isError || uploadMutation.isError;
  const errorMessage =
    createMutation.error?.message ?? uploadMutation.error?.message;

  const footer = (
    <>
      {mutationError && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={isPending}>
        {isPending ? "Salvando..." : "Adicionar"}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Adicionar Source</SheetTitle>
            <SheetDescription>
              Adicione um novo source ao projeto
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {tabBar}
            {tabContent}
          </div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Source</DialogTitle>
          <DialogDescription>
            Adicione um novo source ao projeto
          </DialogDescription>
        </DialogHeader>
        {tabBar}
        {tabContent}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
