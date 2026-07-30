import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileUp, ImagePlus, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, emptyBook, newPage, wordCount, type Book } from "@/lib/books";
import { previewSplit, readImageFile, readTextFile, splitManuscript } from "@/lib/import-manuscript";

export function ImportDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (book: Book) => Book;
}) {
  const navigate = useNavigate();
  const textRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("Vikram");
  const [trim, setTrim] = useState('6" x 9"');
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => previewSplit(text), [text]);
  const words = wordCount(text);

  async function pickText(file: File) {
    try {
      const content = await readTextFile(file);
      setText(content);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(`Loaded ${file.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  async function pickCover(file: File) {
    try {
      setCover(await readImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that image.");
    }
  }

  function build() {
    if (!text.trim()) {
      toast.error("Paste your manuscript first, or load a .txt / .md file.");
      return;
    }
    setBusy(true);
    try {
      const { pages } = splitManuscript(text);
      const book = emptyBook({
        title: title.trim() || "Untitled manuscript",
        subtitle: subtitle.trim(),
        author: author.trim() || "Anonymous",
        trim,
        coverUrl: cover,
      });
      book.pages = [newPage("title"), newPage("copyright"), newPage("toc"), ...pages];
      onCreate(book);
      onOpenChange(false);
      navigate({ to: "/book/$bookId", params: { bookId: book.id }, search: {} });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Turn your writing into a book</DialogTitle>
          <DialogDescription>
            Paste the whole manuscript. Headings, "Chapter 4", numbered titles and ALL-CAPS lines
            become separate pages, then you get a typeset, exportable book.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="manuscript">Your manuscript</Label>
              <Button variant="outline" size="sm" onClick={() => textRef.current?.click()}>
                <FileUp className="size-4" /> Load .txt / .md
              </Button>
              <input
                ref={textRef}
                type="file"
                accept=".txt,.md,.markdown,.text,text/plain,text/markdown"
                hidden
                onChange={(e) => e.target.files?.[0] && pickText(e.target.files[0])}
              />
            </div>
            <Textarea
              id="manuscript"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Chapter 1\nThe first thing nobody tells you…\n\nChapter 2\n…"}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {words.toLocaleString()} words · {preview.pages} page
              {preview.pages === 1 ? "" : "s"} detected · {preview.chapters} chapter
              {preview.chapters === 1 ? "" : "s"}
            </p>
            {preview.titles.length > 0 && (
              <div className="surface max-h-28 overflow-y-auto rounded-md p-3 text-xs">
                <ol className="space-y-1">
                  {preview.titles.map((t, i) => (
                    <li key={`${t}-${i}`} className="truncate text-muted-foreground">
                      {i + 1}. {t}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="imp-title">Title</Label>
              <Input id="imp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-sub">Subtitle</Label>
              <Input id="imp-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-author">Author</Label>
              <Input id="imp-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Page size</Label>
              <Select value={trim} onValueChange={setTrim}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Cover</Label>
              <div className="surface relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-md">
                {cover ? (
                  <>
                    <img src={cover} alt="Uploaded cover" className="size-full object-cover" />
                    <button
                      onClick={() => setCover("")}
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1"
                      title="Remove cover"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="px-4 text-center text-xs text-muted-foreground">
                    <ImagePlus className="mx-auto mb-2 size-5" />
                    Upload your own cover
                  </div>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => coverRef.current?.click()}>
                <Upload className="size-4" /> {cover ? "Replace cover" : "Upload cover"}
              </Button>
              <input
                ref={coverRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && pickCover(e.target.files[0])}
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={build}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Make the book
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
