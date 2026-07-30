import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  Image as ImageIcon,
  List,
  Loader2,
  Palette,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import { BookPreview } from "@/components/editor/BookPreview";
import { ExportDialog } from "@/components/editor/ExportDialog";
import {
  PAGE_SIZES,
  PAGE_TYPES,
  newPage,
  useBook,
  wordCount,
  type Book,
  type PageType,
} from "@/lib/books";
import { writePage } from "@/lib/book-ai.functions";
import { readImageFile } from "@/lib/import-manuscript";


export const Route = createFileRoute("/book/$bookId")({
  head: () => ({
    meta: [
      { title: "Manuscript studio — booksbyvikram" },
      { name: "description", content: "Draft, restructure, humanise and export the manuscript." },
      { property: "og:title", content: "Manuscript studio — booksbyvikram" },
      {
        property: "og:description",
        content: "Draft, restructure, humanise and export the manuscript.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    autodraft: search.autodraft === true || search.autodraft === "1" ? true : undefined,
  }),
  component: Editor,
});

type Tool = "chapters" | "ai" | "voice" | "cover";

const RAIL: { id: Tool; label: string; icon: typeof List }[] = [
  { id: "chapters", label: "Pages", icon: List },
  { id: "ai", label: "AI", icon: Wand2 },
  { id: "voice", label: "Tools", icon: Wrench },
  { id: "cover", label: "Cover", icon: Palette },
];

function Editor() {
  const { bookId } = Route.useParams();
  const { autodraft } = Route.useSearch();
  const { book, ready, update } = useBook(bookId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("chapters");
  const [coverOpen, setCoverOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [bulk, setBulk] = useState<{ done: number; total: number; label: string } | null>(null);
  const [autoStarted, setAutoStarted] = useState(false);
  const write = useServerFn(writePage);

  const pageIndex = useMemo(() => {
    if (!book) return 0;
    const i = book.pages.findIndex((p) => p.id === activeId);
    return i >= 0 ? i : 0;
  }, [book, activeId]);
  const activePage = book?.pages[pageIndex] ?? null;

  async function draftPage(pageId: string, extra = "") {
    const source = book;
    if (!source) return;
    const page = source.pages.find((p) => p.id === pageId);
    if (!page) return;
    setBusy(true);
    try {
      const text = await write({
        data: {
          meta: {
            title: source.title,
            subtitle: source.subtitle,
            author: source.author,
            topic: source.topic,
            audience: source.audience,
            tone: source.tone,
          },
          pageType: page.type,
          pageTitle: page.title,
          brief: page.brief,
          outline: source.pages.filter((p) => p.type === "chapter").map((p) => p.title),
          words: page.type === "chapter" ? 1400 : 600,
          existing: extra ? page.content : "",
          instruction: extra,
        },
      });
      update((draft) => ({
        ...draft,
        pages: draft.pages.map((p) => (p.id === pageId ? { ...p, content: text } : p)),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Drafting failed.");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function draftAll() {
    const source = book;
    if (!source) return;
    const targets = source.pages.filter(
      (p) => PAGE_TYPES.find((t) => t.type === p.type)?.generative && !p.content.trim(),
    );
    if (targets.length === 0) {
      toast.info("Every writable page already has a draft.");
      return;
    }
    try {
      for (let i = 0; i < targets.length; i += 1) {
        setBulk({ done: i, total: targets.length, label: targets[i].title });
        await draftPage(targets[i].id);
      }
      toast.success("Full draft complete.");
    } catch {
      /* error already surfaced */
    } finally {
      setBulk(null);
    }
  }

  // One-prompt books: the library hands the studio a fresh outline and it writes itself.
  useEffect(() => {
    if (!ready || !book || !autodraft || autoStarted) return;
    setAutoStarted(true);
    void draftAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, book, autodraft, autoStarted]);

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

  const included = book.pages.filter((p) => p.include !== false);
  const totalWords = included.reduce((s, p) => s + wordCount(p.content), 0);
  const chapterCount = included.filter((p) => p.type === "chapter").length;

  function patchBook(patch: Partial<Book>) {
    update((d) => ({ ...d, ...patch }));
  }

  function patchPage(
    id: string,
    patch: Partial<{ title: string; brief: string; content: string; include: boolean }>,
  ) {
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
    setTool("chapters");
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

  const chars = activePage?.content.length ?? 0;
  const pageWords = wordCount(activePage?.content ?? "");

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
            onChange={(e) => patchBook({ title: e.target.value })}
            className="w-full truncate bg-transparent font-display text-lg outline-none"
          />
          <p className="text-xs text-muted-foreground">
            by {book.author || "unknown"} · {chapterCount} chapters ·{" "}
            {totalWords.toLocaleString()} words · ~{Math.max(1, Math.round(totalWords / 250))} pages
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="size-4" /> Setup
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="size-4" /> Preview
        </Button>
        <Button size="sm" onClick={() => setExportOpen(true)}>
          <Download className="size-4" /> Export
        </Button>
      </header>

      {bulk && (
        <div className="shrink-0 border-b border-border bg-accent px-4 py-2 text-xs text-accent-foreground">
          <div className="flex items-center justify-between">
            <span>
              Writing {bulk.done + 1} of {bulk.total}: {bulk.label}
            </span>
            <span>{Math.round((bulk.done / bulk.total) * 100)}%</span>
          </div>
          <Progress value={(bulk.done / bulk.total) * 100} className="mt-1.5 h-1" />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Icon rail */}
        <nav className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
          {RAIL.map((item) => (
            <button
              key={item.id}
              onClick={() => (item.id === "cover" ? setCoverOpen(true) : setTool(item.id))}
              className={`flex w-14 flex-col items-center gap-1 rounded-md py-2 text-[10px] ${
                tool === item.id && item.id !== "cover"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
          <div className="my-1 h-px w-8 bg-border" />
          <button
            onClick={() => setExportOpen(true)}
            className="flex w-14 flex-col items-center gap-1 rounded-md py-2 text-[10px] text-muted-foreground hover:bg-sidebar-accent/60"
          >
            <Download className="size-4" />
            Export
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-14 flex-col items-center gap-1 rounded-md py-2 text-[10px] text-muted-foreground hover:bg-sidebar-accent/60"
          >
            <Settings2 className="size-4" />
            Settings
          </button>
        </nav>

        {/* Tool panel */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
          {tool === "chapters" && (
            <>
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
                        } ${page.include === false ? "opacity-50" : ""}`}
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
            </>
          )}

          {tool === "ai" && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <p className="text-xs text-muted-foreground">
                The studio writes from the brief on each page, under house rules that ban em dashes
                and stock phrasing.
              </p>
              <Button className="w-full" disabled={busy || !!bulk} onClick={draftAll}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Write the whole book
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy || !activePage}
                onClick={() => activePage && draftPage(activePage.id)}
              >
                {activePage?.content.trim() ? "Rewrite this page" : "Write this page"}
              </Button>
              <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-xs">Tell it exactly what to change</Label>
                <Textarea
                  rows={4}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Cut the hedging, open with the 2019 pricing mistake, keep it under 1,200 words."
                />
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={busy || !activePage || !instruction.trim()}
                  onClick={() => activePage && draftPage(activePage.id, instruction)}
                >
                  Apply to this page
                </Button>
              </div>
            </div>
          )}

          {tool === "voice" && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {activePage ? (
                <AuditPanel
                  text={activePage.content}
                  onReplace={(next) => patchPage(activePage.id, { content: next })}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Select a page first.</p>
              )}
            </div>
          )}
        </aside>

        {/* Cover column */}
        <aside className="hidden w-[230px] shrink-0 flex-col gap-3 border-r border-border bg-background p-4 xl:flex">
          <div className="surface flex aspect-[2/3] items-center justify-center overflow-hidden rounded-md">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`${book.title} cover`}
                className="size-full object-cover"
              />
            ) : (
              <div className="px-4 text-center text-xs text-muted-foreground">
                <ImageIcon className="mx-auto mb-2 size-5" />
                No cover yet
              </div>
            )}
          </div>
          <Button variant="outline" onClick={() => setCoverOpen(true)}>
            Edit cover
          </Button>
          <Button variant="ghost" size="sm" onClick={() => coverFileRef.current?.click()}>
            <ImageIcon className="size-4" /> Upload my cover
          </Button>
          <input
            ref={coverFileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              readImageFile(file)
                .then((url) => {
                  patchBook({ coverUrl: url });
                  toast.success("Cover uploaded.");
                })
                .catch((error: unknown) =>
                  toast.error(error instanceof Error ? error.message : "Upload failed."),
                );
              e.target.value = "";
            }}
          />
        </aside>


        {/* Page editor */}
        <main className="flex min-w-0 flex-1 flex-col bg-paper">
          {activePage ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
                <Badge variant="outline">
                  {PAGE_TYPES.find((t) => t.type === activePage.type)?.label}
                </Badge>
                <input
                  value={activePage.title}
                  onChange={(e) => patchPage(activePage.id, { title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent font-display text-xl outline-none"
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={activePage.include !== false}
                    onCheckedChange={(v) => patchPage(activePage.id, { include: v === true })}
                  />
                  Include in exported book
                </label>
              </div>

              <div className="flex items-center justify-between border-b border-border px-6 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pageIndex === 0}
                  onClick={() => setActiveId(book.pages[pageIndex - 1].id)}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <input
                  value={activePage.brief}
                  onChange={(e) => patchPage(activePage.id, { brief: e.target.value })}
                  placeholder="Brief: what this page must cover…"
                  className="mx-4 min-w-0 flex-1 bg-transparent text-center text-xs text-muted-foreground outline-none"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pageIndex >= book.pages.length - 1}
                  onClick={() => setActiveId(book.pages[pageIndex + 1].id)}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </div>

              <ManuscriptEditor
                value={activePage.content}
                onChange={(v) => patchPage(activePage.id, { content: v })}
                placeholder="Write here, or let the studio draft it."
              />

              <div className="flex shrink-0 items-center gap-4 border-t border-border px-6 py-2 text-xs text-muted-foreground">
                <span>{pageWords.toLocaleString()} words</span>
                <span>{chars.toLocaleString()} characters</span>
                <span>~{Math.max(1, Math.round(pageWords / 220))} min read</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
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
            </>
          ) : (
            <Centered>Add a page to begin.</Centered>
          )}
        </main>
      </div>

      <BookPreview
        book={book}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onEditCover={() => {
          setPreviewOpen(false);
          setCoverOpen(true);
        }}
        onExport={() => {
          setPreviewOpen(false);
          setExportOpen(true);
        }}
      />

      <ExportDialog
        book={book}
        open={exportOpen}
        onOpenChange={setExportOpen}
        onPatch={patchBook}
        onEditCover={() => {
          setExportOpen(false);
          setCoverOpen(true);
        }}
      />

      <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Cover designer</DialogTitle>
            <DialogDescription>
              Search styles by name or mood, or have the studio art-direct six options for this
              book.
            </DialogDescription>
          </DialogHeader>
          <CoverStudio
            book={book}
            onApply={(url) => {
              patchBook({ coverUrl: url });
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
                onChange={(e) => patchBook({ subtitle: e.target.value })}
              />
            </Field>
            <Field label="Author">
              <Input value={book.author} onChange={(e) => patchBook({ author: e.target.value })} />
            </Field>
            <Field label="Topic">
              <Textarea
                rows={2}
                value={book.topic}
                onChange={(e) => patchBook({ topic: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Reader">
                <Input
                  value={book.audience}
                  onChange={(e) => patchBook({ audience: e.target.value })}
                />
              </Field>
              <Field label="Page size">
                <Select value={book.trim} onValueChange={(v) => patchBook({ trim: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Voice">
              <Input value={book.tone} onChange={(e) => patchBook({ tone: e.target.value })} />
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
