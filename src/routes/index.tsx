import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { emptyBook, newPage, useLibrary, wordCount, type Book } from "@/lib/books";
import { generateOutline } from "@/lib/book-ai.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "booksbyvikram — manuscript studio" },
      {
        name: "description",
        content: "Private studio for outlining, drafting, humanising and exporting books.",
      },
      { property: "og:title", content: "booksbyvikram — manuscript studio" },
      {
        property: "og:description",
        content: "Private studio for outlining, drafting, humanising and exporting books.",
      },
    ],
  }),
  component: Library,
});

function Library() {
  const { books, ready, create, remove } = useLibrary();
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="size-4" />
            </span>
            <div>
              <h1 className="font-display text-xl leading-none">booksbyvikram</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Private manuscript studio. Nothing here is public.
              </p>
            </div>
          </div>
          <NewBookDialog open={open} setOpen={setOpen} onCreate={create} />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="font-display text-2xl">Shelf</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready ? `${books.length} manuscript${books.length === 1 ? "" : "s"}` : "Loading…"}
        </p>

        {ready && books.length === 0 && (
          <div className="mt-8 surface rounded-lg p-10 text-center">
            <p className="font-display text-lg">No manuscripts yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Start one and the studio drafts an outline, writes each page in your voice, then
              audits the result for machine-written tells before you export.
            </p>
            <Button className="mt-6" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Start a manuscript
            </Button>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onDelete={() => remove(book.id)} />
          ))}
        </div>
      </section>
    </main>
  );
}

function BookCard({ book, onDelete }: { book: Book; onDelete: () => void }) {
  const navigate = useNavigate();
  const words = book.pages.reduce((sum, p) => sum + wordCount(p.content), 0);

  return (
    <article className="group surface flex flex-col overflow-hidden rounded-lg transition-shadow hover:shadow-lift">
      <button
        className="flex flex-1 flex-col items-start gap-3 p-5 text-left"
        onClick={() => navigate({ to: "/book/$bookId", params: { bookId: book.id } })}
      >
        <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-secondary">
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={`${book.title} cover`} className="size-full object-cover" />
          ) : (
            <BookOpen className="size-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <h3 className="font-display text-lg leading-tight">{book.title}</h3>
          {book.subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{book.subtitle}</p>
          )}
        </div>
        <p className="mt-auto text-xs text-muted-foreground">
          {book.pages.length} pages · {words.toLocaleString()} words
        </p>
      </button>
      <div className="flex justify-end border-t border-border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
    </article>
  );
}

function NewBookDialog({
  open,
  setOpen,
  onCreate,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreate: (b: Book) => Book;
}) {
  const navigate = useNavigate();
  const outline = useServerFn(generateOutline);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Direct, opinionated, warm. First person.");
  const [author, setAuthor] = useState("Vikram");
  const [chapters, setChapters] = useState(8);
  const [busy, setBusy] = useState(false);

  async function build(withOutline: boolean) {
    if (!topic.trim()) {
      toast.error("Describe the book first.");
      return;
    }
    setBusy(true);
    try {
      const book = emptyBook({ topic, audience, tone, author, title: topic.slice(0, 60) });
      book.pages = [newPage("title"), newPage("copyright"), newPage("toc")];

      if (withOutline) {
        const result = await outline({
          data: { topic, audience, tone, chapterCount: chapters },
        });
        book.title = result.title || book.title;
        book.subtitle = result.subtitle ?? "";
        book.pages.push(newPage("introduction", "Introduction"));
        for (const chapter of result.chapters ?? []) {
          const page = newPage("chapter", chapter.title);
          page.brief = chapter.summary;
          book.pages.push(page);
        }
        book.pages.push(newPage("conclusion", "Conclusion"));
      }

      onCreate(book);
      setOpen(false);
      navigate({ to: "/book/$bookId", params: { bookId: book.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the outline.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New manuscript
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start a manuscript</DialogTitle>
          <DialogDescription>
            Everything here is editable later. Nothing is locked in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic">What is the book about?</Label>
            <Textarea
              id="topic"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="A field guide to pricing software for solo founders, built on real deal data."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="audience">Reader</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Bootstrapped founders"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="author">Author name</Label>
              <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tone">Voice</Label>
            <Input id="tone" value={tone} onChange={(e) => setTone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Chapters: {chapters}</Label>
            <Slider
              value={[chapters]}
              min={3}
              max={24}
              step={1}
              onValueChange={([v]) => setChapters(v)}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => build(false)}>
            Blank manuscript
          </Button>
          <Button disabled={busy} onClick={() => build(true)}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Draft the outline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
