import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  FileDown,
  Image as ImageIcon,
  Loader2,
  Plus,
  Printer,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ManuscriptEditor } from "@/components/editor/ManuscriptEditor";
import { AuditPanel } from "@/components/editor/AuditPanel";
import { CoverStudio } from "@/components/editor/CoverStudio";
import { PAGE_TYPES, newPage, useBook, wordCount, type PageType } from "@/lib/books";
import { writePage } from "@/lib/book-ai.functions";
import { buildHtml, buildMarkdown, download, printBook, slug } from "@/lib/export-book";

export const Route = createFileRoute("/book/$bookId")({
  head: () => ({
    meta: [
      { title: "Manuscript editor — booksbyvikram" },
      { name: "description", content: "Draft, restructure, humanise and export the manuscript." },
      { property: "og:title", content: "Manuscript editor — booksbyvikram" },
      {
        property: "og:description",
        content: "Draft, restructure, humanise and export the manuscript.",
      },
    ],
  }),
  component: Editor,
});

function Editor() {
  const { bookId } = Route.useParams();
  const { book, ready, update } = useBook(bookId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<string | null>(null);
  const write = useServerFn(writePage);

  const activePage = useMemo(
    () => book?.pages.find((p) => p.id === activeId) ?? book?.pages[0] ?? null,
    [book, activeId],
  );

  if (!ready) return <Centered>Loading…</Centered>;
  if (!book)
    return (
      <Centered>
        <p className="font-display text-lg">That manuscript is gone.</p>
        <Button asChild className="mt-4">
          <Link to="/">Back to the shelf</Link>
        </Button>
      </Centered>
    );

  const totalWords = book.pages.reduce((s, p) => s + wordCount(p.content), 0);

  function patchPage(id: string, patch: Partial<{ title: string; brief: string; content: string }>) {
    update((draft) => ({
      ...draft,
      pages: draft.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function insertPage(type: PageType, index: number) {
    const page = newPage(type);
    update((draft) => {
      const pages = [...draft.pages];
      pages.splice(index, 0, page);
      return { ...draft, pages };
    });
    setActiveId(page.id);
  }

  function movePage(index: number, delta: number) {
    update((draft) => {
      const pages = [...draft.pages];
      const target = index + delta;
      if (target < 0 || target >= pages.length) return draft;
      [pages[index], pages[target]] = [pages[target], pages[index]];
      return { ...draft, pages };
    });
  }

  function deletePage(id: string) {
    update((draft) => ({ ...draft, pages: draft.pages.filter((p) => p.id !== id) }));
  }

  async function draftPage(pageId: string, instruction = "") {
    const page = book!.pages.find((p) => p.id === pageId);
    if (!page) return;
    setBusy(true);
    try {
      const text = await write({
        data: {
          meta: {
            title: book!.title,
            subtitle: book!.subtitle,
            author: book!.author,
            topic: book!.topic,
            audience: book!.audience,
            tone: book!.tone,
          },
          pageType: page.type,
          pageTitle: page.title,
          brief: page.brief,
          outline: book!.pages.filter((p) => p.type === "chapter").map((p) => p.title),
          words: page.type === "chapter" ? 1400 : 600,
          existing: instruction ? page.content : "",
          instruction,
        },
      });
      patchPage(pageId, { content: text });
      toast.success(`“${page.title}” drafted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drafting failed.");
    } finally {
      setBusy(false);
    }
  }

  async function draftAll() {
    const targets = book!.pages.filter(
      (p) => PAGE_TYPES.find((t) => t.type === p.type)?.generative && !p.content.trim(),
    );
    if (targets.length === 0) return toast.info("Every writable page already has a draft.");
    for (let i = 0; i < targets.length; i += 1) {
      setBulk(`Writing ${i + 1} of ${targets.length}: ${targets[i].title}`);
      await draftPage(targets[i].id);
    }
    setBulk(null);
    toast.success("Full draft complete.");
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-paper px-4 py-2.5">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <input
            value={book.title}
            onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
            className="w-full truncate bg-transparent font-display text-lg outline-none"
          />
          <p className="text-xs text-muted-foreground">
            {book.pages.length} pages · {totalWords.toLocaleString()} words
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setCoverOpen(true)}>
          <ImageIcon className="size-4" /> Cover
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" /> Setup
        </Button>
        <Button size="sm" disabled={busy} onClick={draftAll}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Draft whole book
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Trim size and author details live in Setup
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => printBook(book)}>
              <Printer className="size-4" /> Print / save as PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                download(`${slug(book.title)}.html`, buildHtml(book), "text/html")
              }
            >
              <FileDown className="size-4" /> Typeset HTML
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                download(`${slug(book.title)}.md`, buildMarkdown(book), "text/markdown")
              }
            >
              <FileDown className="size-4" /> Markdown manuscript
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {bulk && (
        <div className="shrink-0 border-b border-border bg-accent px-4 py-1.5 text-xs text-accent-foreground">
          {bulk}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Compact page rail */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pages
            </span>
            <AddPageMenu onPick={(t) => insertPage(t, book.pages.length)} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {book.pages.map((page, index) => {
              const active = activePage?.id === page.id;
              return (
                <div key={page.id} className="group/page">
                  <button
                    onClick={() => setActiveId(page.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <span className="w-4 shrink-0 text-[10px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{page.title}</span>
                    {page.content.trim() ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-brass" />
                    ) : null}
                  </button>
                  <div className="hidden items-center gap-0.5 px-6 pb-1 group-hover/page:flex">
                    <IconMini onClick={() => movePage(index, -1)} title="Move up">
                      <ChevronUp className="size-3" />
                    </IconMini>
                    <IconMini onClick={() => movePage(index, 1)} title="Move down">
                      <ChevronDown className="size-3" />
                    </IconMini>
                    <AddPageMenu compact onPick={(t) => insertPage(t, index + 1)} />
                    <IconMini onClick={() => deletePage(page.id)} title="Delete">
                      <Trash2 className="size-3" />
                    </IconMini>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Page */}
        <main className="flex min-w-0 flex-1 flex-col bg-paper">
          {activePage ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
                <Badge variant="outline" className="capitalize">
                  {PAGE_TYPES.find((t) => t.type === activePage.type)?.label}
                </Badge>
                <input
                  value={activePage.title}
                  onChange={(e) => patchPage(activePage.id, { title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => draftPage(activePage.id)}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {activePage.content.trim() ? "Rewrite" : "Write this page"}
                </Button>
              </div>
              <input
                value={activePage.brief}
                onChange={(e) => patchPage(activePage.id, { brief: e.target.value })}
                placeholder="Brief: what this page must cover…"
                className="border-b border-border bg-transparent px-6 py-2 text-sm text-muted-foreground outline-none"
              />
              <ManuscriptEditor
                value={activePage.content}
                onChange={(v) => patchPage(activePage.id, { content: v })}
                placeholder="Write here, or let the studio draft it."
              />
            </>
          ) : (
            <Centered>Add a page to begin.</Centered>
          )}
        </main>

        {/* Right rail */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-sidebar lg:flex">
          <Tabs defaultValue="voice" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="m-2">
              <TabsTrigger value="voice">Voice check</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="voice" className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              {activePage && (
                <AuditPanel
                  text={activePage.content}
                  onReplace={(next) => patchPage(activePage.id, { content: next })}
                />
              )}
            </TabsContent>
            <TabsContent value="preview" className="min-h-0 flex-1 overflow-y-auto p-4">
              <div
                className="surface manuscript rounded-sm p-5 [&_h3]:font-display [&_h3]:text-base [&_p]:mb-3"
                dangerouslySetInnerHTML={{
                  __html: activePage
                    ? `<h3>${activePage.title}</h3>` +
                      buildHtml({ ...book, pages: [activePage] })
                        .split("<body>")[1]
                        .replace("</body></html>", "")
                    : "",
                }}
              />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Cover studio</DialogTitle>
            <DialogDescription>
              Search styles by name or mood, or have the studio art-direct six options for this
              book.
            </DialogDescription>
          </DialogHeader>
          <CoverStudio
            book={book}
            onApply={(url) => {
              update((d) => ({ ...d, coverUrl: url }));
              setCoverOpen(false);
              toast.success("Cover applied.");
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Book setup</DialogTitle>
            <DialogDescription>
              Decided once here so exporting stays a single click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Subtitle">
              <Input
                value={book.subtitle}
                onChange={(e) => update((d) => ({ ...d, subtitle: e.target.value }))}
              />
            </Field>
            <Field label="Author">
              <Input
                value={book.author}
                onChange={(e) => update((d) => ({ ...d, author: e.target.value }))}
              />
            </Field>
            <Field label="Topic">
              <Textarea
                rows={2}
                value={book.topic}
                onChange={(e) => update((d) => ({ ...d, topic: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reader">
                <Input
                  value={book.audience}
                  onChange={(e) => update((d) => ({ ...d, audience: e.target.value }))}
                />
              </Field>
              <Field label="Trim size">
                <Select
                  value={book.trim}
                  onValueChange={(v) => update((d) => ({ ...d, trim: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['5" x 8"', '5.5" x 8.5"', '6" x 9"', '7" x 10"', '8.5" x 11"'].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Voice">
              <Input
                value={book.tone}
                onChange={(e) => update((d) => ({ ...d, tone: e.target.value }))}
              />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function IconMini({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {children}
    </button>
  );
}

function AddPageMenu({
  onPick,
  compact,
}: {
  onPick: (type: PageType) => void;
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Insert page"
          className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Plus className={compact ? "size-3" : "size-4"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Insert any page, anywhere
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PAGE_TYPES.map((t) => (
          <DropdownMenuItem key={t.type} onClick={() => onPick(t.type)}>
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
      <div>{children}</div>
    </div>
  );
}
