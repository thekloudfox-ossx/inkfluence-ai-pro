import { useCallback, useEffect, useState } from "react";

export type PageType =
  | "title"
  | "blank"
  | "copyright"
  | "dedication"
  | "toc"
  | "foreword"
  | "introduction"
  | "chapter"
  | "part"
  | "conclusion"
  | "acknowledgements"
  | "about"
  | "custom";

export const PAGE_TYPES: { type: PageType; label: string; generative: boolean }[] = [
  { type: "title", label: "Title page", generative: false },
  { type: "blank", label: "Blank page", generative: false },
  { type: "copyright", label: "Copyright", generative: false },
  { type: "dedication", label: "Dedication", generative: true },
  { type: "toc", label: "Contents", generative: false },
  { type: "foreword", label: "Foreword", generative: true },
  { type: "introduction", label: "Introduction", generative: true },
  { type: "part", label: "Part divider", generative: false },
  { type: "chapter", label: "Chapter", generative: true },
  { type: "conclusion", label: "Conclusion", generative: true },
  { type: "acknowledgements", label: "Acknowledgements", generative: true },
  { type: "about", label: "About the author", generative: true },
  { type: "custom", label: "Custom page", generative: true },
];

export type Page = {
  id: string;
  type: PageType;
  title: string;
  brief: string;
  content: string;
  /** Undefined counts as included, so older saved books keep working. */
  include?: boolean;
};

export const PAGE_SIZES = [
  { label: 'US Letter (8.5" x 11")', value: '8.5" x 11"' },
  { label: 'Trade (6" x 9")', value: '6" x 9"', tag: "KDP" },
  { label: 'Workbook (7" x 10")', value: '7" x 10"' },
  { label: 'Large (8" x 10")', value: '8" x 10"' },
  { label: 'Digest (5.5" x 8.5")', value: '5.5" x 8.5"' },
  { label: 'Pocket (5" x 8")', value: '5" x 8"' },
  { label: 'A5 (5.83" x 8.27")', value: '5.83" x 8.27"' },
  { label: 'B5 (7.17" x 10.12")', value: '7.17" x 10.12"' },
  { label: 'A4 (8.27" x 11.69")', value: '8.27" x 11.69"' },
];

export type ExportOpts = {
  toc: boolean;
  tocSubheads: boolean;
  copyright: boolean;
  chapterNumbers: "arabic" | "roman" | "none";
  dropCaps: boolean;
  pageNumbers: boolean;
};

export const DEFAULT_EXPORT: ExportOpts = {
  toc: true,
  tocSubheads: false,
  copyright: true,
  chapterNumbers: "arabic",
  dropCaps: false,
  pageNumbers: true,
};

export type Book = {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  topic: string;
  audience: string;
  tone: string;
  coverUrl: string;
  trim: string;
  createdAt: number;
  updatedAt: number;
  pages: Page[];
  exportOpts?: ExportOpts;
};

export const exportOptsOf = (book: Book): ExportOpts => ({
  ...DEFAULT_EXPORT,
  ...(book.exportOpts ?? {}),
});


const KEY = "bbv.books.v1";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyBook(partial: Partial<Book> = {}): Book {
  const now = Date.now();
  return {
    id: uid(),
    title: "Untitled manuscript",
    subtitle: "",
    author: "Vikram",
    topic: "",
    audience: "",
    tone: "",
    coverUrl: "",
    trim: '6" x 9"',
    createdAt: now,
    updatedAt: now,
    pages: [],
    ...partial,
  };
}

export function newPage(type: PageType, title = ""): Page {
  const label = PAGE_TYPES.find((p) => p.type === type)?.label ?? "Page";
  return { id: uid(), type, title: title || label, brief: "", content: "" };
}

function read(): Book[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Book[];
  } catch {
    return [];
  }
}

function write(books: Book[]) {
  window.localStorage.setItem(KEY, JSON.stringify(books));
  window.dispatchEvent(new Event("bbv:books"));
}

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setBooks(read());
    sync();
    setReady(true);
    window.addEventListener("bbv:books", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bbv:books", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const create = useCallback((book: Book) => {
    write([book, ...read()]);
    return book;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((b) => b.id !== id));
  }, []);

  return { books, ready, create, remove };
}

export function useBook(id: string) {
  const [book, setBook] = useState<Book | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBook(read().find((b) => b.id === id) ?? null);
    setReady(true);
  }, [id]);

  const update = useCallback(
    (mutate: (draft: Book) => Book) => {
      setBook((current) => {
        if (!current) return current;
        const next = { ...mutate(current), updatedAt: Date.now() };
        const all = read();
        const index = all.findIndex((b) => b.id === next.id);
        if (index >= 0) all[index] = next;
        else all.unshift(next);
        write(all);
        return next;
      });
    },
    [],
  );

  return { book, ready, update };
}

export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

const TELLS = [
  "delve",
  "tapestry",
  "testament to",
  "in today's fast-paced",
  "it's important to note",
  "moreover",
  "furthermore",
  "in conclusion",
  "game-changer",
  "seamless",
  "robust",
  "elevate",
  "embark",
  "navigate the",
  "unlock the",
  "harness the",
  "realm of",
  "landscape of",
];

/** Instant, offline scan for the tells that make prose read as machine written. */
export function scanTells(text: string) {
  const lower = text.toLowerCase();
  const phrases = TELLS.filter((t) => lower.includes(t));
  const emDashes = (text.match(/[—–]/g) ?? []).length;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const lengths = sentences.map((s) => wordCount(s));
  const mean = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance =
    lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / (lengths.length || 1);
  const burstiness = Math.sqrt(variance);
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        20 + phrases.length * 9 + emDashes * 6 + Math.max(0, 14 - burstiness) * 3.5,
      ),
    ),
  );
  return { phrases, emDashes, burstiness: Math.round(burstiness * 10) / 10, score };
}
