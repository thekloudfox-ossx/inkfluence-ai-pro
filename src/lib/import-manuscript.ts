import { newPage, type Page } from "./books";

/** Lines that read like a heading in a pasted manuscript. */
const HEADING_PATTERNS: RegExp[] = [
  /^#{1,3}\s+(.{2,120})$/, // markdown
  /^(chapter\s+[0-9ivxlc]+\b.*)$/i,
  /^(part\s+[0-9ivxlc]+\b.*)$/i,
  /^(prologue|epilogue|introduction|foreword|preface|conclusion|afterword|acknowledgements|acknowledgments|about the author|dedication)\b.*$/i,
  /^([0-9]{1,2}\.\s+.{2,120})$/, // "3. Pricing that sticks"
];

function headingOf(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return null;
  for (const re of HEADING_PATTERNS) {
    const m = trimmed.match(re);
    if (m) return (m[1] ?? trimmed).replace(/^#+\s*/, "").trim();
  }
  // ALL CAPS short line, no trailing period
  if (
    trimmed.length <= 70 &&
    /^[A-Z0-9][A-Z0-9 ,'’&:\-]+$/.test(trimmed) &&
    !/[.!?]$/.test(trimmed)
  ) {
    return trimmed
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

function typeFor(title: string): Page["type"] {
  const t = title.toLowerCase();
  if (/^part\b/.test(t)) return "part";
  if (/foreword|preface/.test(t)) return "foreword";
  if (/introduction|prologue/.test(t)) return "introduction";
  if (/conclusion|epilogue|afterword/.test(t)) return "conclusion";
  if (/acknowledge/.test(t)) return "acknowledgements";
  if (/about the author/.test(t)) return "about";
  if (/dedication/.test(t)) return "dedication";
  return "chapter";
}

export type ImportResult = {
  pages: Page[];
  detected: number;
};

/**
 * Split a pasted manuscript into typed pages. Everything before the first
 * heading becomes an opening page so nothing the author wrote is dropped.
 */
export function splitManuscript(raw: string): ImportResult {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return { pages: [], detected: 0 };

  const lines = text.split("\n");
  const sections: { title: string | null; body: string[] }[] = [{ title: null, body: [] }];

  for (const line of lines) {
    const heading = headingOf(line);
    const prev = sections[sections.length - 1];
    // A heading only counts if it starts a block (previous line blank or start).
    const lastLine = prev.body[prev.body.length - 1];
    const startsBlock = prev.body.length === 0 || (lastLine ?? "").trim() === "";
    if (heading && startsBlock) {
      sections.push({ title: heading, body: [] });
    } else {
      prev.body.push(line);
    }
  }

  const pages: Page[] = [];
  for (const section of sections) {
    const body = section.body.join("\n").trim();
    if (!section.title && !body) continue;
    if (!section.title) {
      const page = newPage("introduction", "Opening");
      page.content = body;
      pages.push(page);
      continue;
    }
    const type = typeFor(section.title);
    const page = newPage(type, section.title);
    page.content = body;
    pages.push(page);
  }

  return { pages, detected: pages.filter((p) => p.type === "chapter").length };
}

/** Rough estimate so the import dialog can show what will happen. */
export function previewSplit(raw: string) {
  const { pages, detected } = splitManuscript(raw);
  return {
    chapters: detected,
    pages: pages.length,
    titles: pages.map((p) => p.title),
  };
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsText(file);
  });
}

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}
