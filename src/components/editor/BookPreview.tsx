import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { wordCount, type Book } from "@/lib/books";
import { buildHtml } from "@/lib/export-book";

type Props = {
  book: Book;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditCover: () => void;
  onExport: () => void;
};

/** Flip through the book exactly as it will be typeset, cover included. */
export function BookPreview({ book, open, onOpenChange, onEditCover, onExport }: Props) {
  const [index, setIndex] = useState(0);

  const sheets = useMemo(() => {
    const html = buildHtml(book);
    const body = html.split("<body>")[1]?.replace("</body></html>", "") ?? "";
    const matches = body.match(/<section class="page[\s\S]*?<\/section>/g) ?? [];
    return matches;
  }, [book]);

  const words = book.pages
    .filter((p) => p.include !== false)
    .reduce((s, p) => s + wordCount(p.content), 0);
  const current = Math.min(index, Math.max(0, sheets.length - 1));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="font-display text-lg">Preview</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {words.toLocaleString()} words · {sheets.length} typeset pages ·{" "}
            {book.pages.filter((p) => p.type === "chapter" && p.include !== false).length} chapters
          </p>
        </DialogHeader>

        <div className="max-h-[62vh] overflow-y-auto bg-secondary px-6 py-6">
          <div
            className="preview-sheet mx-auto max-w-[46em] rounded-sm bg-paper p-10 shadow-lift"
            dangerouslySetInnerHTML={{ __html: sheets[current] ?? "<p>Nothing to preview yet.</p>" }}
          />
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-border py-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            disabled={current === 0}
            onClick={() => setIndex(current - 1)}
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {sheets.length ? current + 1 : 0} / {sheets.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={current >= sheets.length - 1}
            onClick={() => setIndex(current + 1)}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex gap-3 border-t border-border px-5 py-3">
          <Button variant="outline" className="flex-1" onClick={onEditCover}>
            Edit cover
          </Button>
          <Button className="flex-1" onClick={onExport}>
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
