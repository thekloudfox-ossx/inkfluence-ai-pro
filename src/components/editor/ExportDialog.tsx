import { useState } from "react";
import { FileDown, FileText, Printer, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_EXPORT,
  PAGE_SIZES,
  exportOptsOf,
  wordCount,
  type Book,
  type ExportOpts,
} from "@/lib/books";
import { buildHtml, buildMarkdown, download, printBook, slug } from "@/lib/export-book";

type Props = {
  book: Book;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPatch: (patch: Partial<Book>) => void;
  onEditCover: () => void;
};

const FORMATS = [
  { id: "pdf", label: "PDF / Print", icon: Printer },
  { id: "html", label: "Typeset HTML", icon: FileText },
  { id: "md", label: "Markdown", icon: FileDown },
  { id: "bundle", label: "Manuscript bundle", icon: Package },
] as const;

export function ExportDialog({ book, open, onOpenChange, onPatch, onEditCover }: Props) {
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("pdf");
  const opts = exportOptsOf(book);
  const included = book.pages.filter((p) => p.include !== false);
  const words = included.reduce((s, p) => s + wordCount(p.content), 0);

  function setOpt<K extends keyof ExportOpts>(key: K, value: ExportOpts[K]) {
    onPatch({ exportOpts: { ...DEFAULT_EXPORT, ...opts, [key]: value } });
  }

  function run() {
    if (format === "pdf") return printBook(book);
    if (format === "html")
      return download(`${slug(book.title)}.html`, buildHtml(book), "text/html");
    if (format === "md")
      return download(`${slug(book.title)}.md`, buildMarkdown(book), "text/markdown");
    download(`${slug(book.title)}-bundle.html`, buildHtml(book), "text/html");
    download(`${slug(book.title)}.md`, buildMarkdown(book), "text/markdown");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Export “{book.title}”</DialogTitle>
          <DialogDescription>
            Everything is decided here, then one button finishes the job.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="space-y-3">
            <div className="surface flex aspect-[2/3] items-center justify-center overflow-hidden rounded-md">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={`${book.title} cover`}
                  className="size-full object-cover"
                />
              ) : (
                <span className="px-4 text-center text-xs text-muted-foreground">
                  No cover yet
                </span>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {included.filter((p) => p.type === "chapter").length} chapters ·{" "}
              {words.toLocaleString()} words · ~{Math.max(1, Math.round(words / 250))} pages
            </p>
            <Button variant="outline" className="w-full" onClick={onEditCover}>
              Edit cover
            </Button>
          </div>

          <div className="space-y-6">
            <section>
              <SectionTitle>Export format</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Chip key={f.id} active={format === f.id} onClick={() => setFormat(f.id)}>
                    <f.icon className="size-3.5" /> {f.label}
                  </Chip>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Page size</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {PAGE_SIZES.map((s) => (
                  <Chip
                    key={s.value}
                    active={book.trim === s.value}
                    onClick={() => onPatch({ trim: s.value })}
                  >
                    {s.label}
                    {s.tag ? (
                      <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                        {s.tag}
                      </span>
                    ) : null}
                  </Chip>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>Content</SectionTitle>
              <Toggle
                label="Table of contents"
                checked={opts.toc}
                onChange={(v) => setOpt("toc", v)}
              />
              <Toggle
                label="Include sub-headings in contents"
                indent
                checked={opts.tocSubheads}
                onChange={(v) => setOpt("tocSubheads", v)}
              />
              <Toggle
                label="Copyright page"
                checked={opts.copyright}
                onChange={(v) => setOpt("copyright", v)}
              />
              <Toggle
                label="Drop caps at chapter openings"
                checked={opts.dropCaps}
                onChange={(v) => setOpt("dropCaps", v)}
              />
              <Toggle
                label="Page numbers"
                checked={opts.pageNumbers}
                onChange={(v) => setOpt("pageNumbers", v)}
              />
              <div className="flex items-center justify-between gap-4 pt-1">
                <Label className="text-sm font-normal">Chapter numbers</Label>
                <div className="flex gap-1.5">
                  {(["arabic", "roman", "none"] as const).map((s) => (
                    <Chip
                      key={s}
                      active={opts.chapterNumbers === s}
                      onClick={() => setOpt("chapterNumbers", s)}
                    >
                      {s === "arabic" ? "1, 2, 3" : s === "roman" ? "I, II, III" : "None"}
                    </Chip>
                  ))}
                </div>
              </div>
            </section>

            <Button size="lg" className="w-full" onClick={run}>
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  indent,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${indent ? "pl-4" : ""}`}>
      <Label className={`text-sm font-normal ${indent ? "text-muted-foreground" : ""}`}>
        {label}
      </Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
