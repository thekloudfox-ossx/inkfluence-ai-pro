import { exportOptsOf, type Book, type ExportOpts, type Page } from "./books";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Minimal, predictable markup: paragraphs, ## sub-heads, > quotes, - lists. */
export function renderBody(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("## ")) return `<h3>${inline(b.slice(3))}</h3>`;
      if (b.startsWith("> ")) return `<blockquote>${inline(b.slice(2))}</blockquote>`;
      if (/^[-*] /m.test(b)) {
        const items = b
          .split("\n")
          .filter((l) => /^[-*] /.test(l.trim()))
          .map((l) => `<li>${inline(l.trim().slice(2))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${inline(b).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, "$1<em>$2</em>");
}

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function roman(n: number) {
  let out = "";
  let left = n;
  for (const [v, s] of ROMAN) {
    while (left >= v) {
      out += s;
      left -= v;
    }
  }
  return out;
}

function chapterLabel(index: number, style: ExportOpts["chapterNumbers"]) {
  if (style === "none") return "";
  return `<span class="chapter-num">Chapter ${style === "roman" ? roman(index) : index}</span>`;
}

function subheads(text: string) {
  return text
    .split("\n")
    .filter((l) => l.trim().startsWith("## "))
    .map((l) => l.trim().slice(3));
}

function pageHtml(book: Book, page: Page, index: number, opts: ExportOpts, pages: Page[]) {
  if (page.type === "blank") return `<section class="page blank"></section>`;
  if (page.type === "title") {
    return `<section class="page title-page">
      <h1>${esc(book.title)}</h1>
      ${book.subtitle ? `<p class="subtitle">${esc(book.subtitle)}</p>` : ""}
      <p class="byline">${esc(book.author)}</p>
    </section>`;
  }
  if (page.type === "copyright") {
    return `<section class="page small">
      <p>Copyright &copy; ${new Date().getFullYear()} ${esc(book.author)}. All rights reserved.</p>
      ${page.content ? renderBody(page.content) : ""}
    </section>`;
  }
  if (page.type === "toc") {
    const items = pages
      .filter((p) => ["chapter", "part", "introduction", "conclusion"].includes(p.type))
      .map((p) => {
        const kids =
          opts.tocSubheads && subheads(p.content).length
            ? `<ul class="toc-sub">${subheads(p.content)
                .map((s) => `<li>${esc(s)}</li>`)
                .join("")}</ul>`
            : "";
        return `<li>${esc(p.title)}${kids}</li>`;
      })
      .join("");
    return `<section class="page"><h2>Contents</h2><ol class="toc">${items}</ol></section>`;
  }
  if (page.type === "part") {
    return `<section class="page part"><h2>${esc(page.title)}</h2></section>`;
  }
  return `<section class="page">
    <h2>${page.type === "chapter" ? chapterLabel(index, opts.chapterNumbers) : ""}${esc(page.title)}</h2>
    ${renderBody(page.content)}
  </section>`;
}

export function buildHtml(book: Book, override?: Partial<ExportOpts>) {
  const opts = { ...exportOptsOf(book), ...(override ?? {}) };
  const pages = book.pages.filter((p) => {
    if (p.include === false) return false;
    if (p.type === "toc" && !opts.toc) return false;
    if (p.type === "copyright" && !opts.copyright) return false;
    return true;
  });

  let chapterIndex = 0;
  const body = pages
    .map((p) => {
      if (p.type === "chapter") chapterIndex += 1;
      return pageHtml(book, p, chapterIndex, opts, pages);
    })
    .join("\n");

  const cover = book.coverUrl
    ? `<section class="page cover"><img src="${esc(book.coverUrl)}" alt="${esc(book.title)} cover"/></section>`
    : "";

  const [w, h] = book.trim.replace(/"/g, "").split("x").map((s) => s.trim());

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(book.title)}</title>
<style>
  @page { size: ${w}in ${h}in; margin: 0.75in 0.7in; ${
    opts.pageNumbers ? '@bottom-center { content: counter(page); }' : ""
  } }
  body { font-family: Georgia, "Times New Roman", serif; color: #14110d; line-height: 1.65; font-size: 11.5pt; margin: 0; }
  .page { page-break-after: always; }
  .page.blank { min-height: 60vh; }
  .cover { text-align: center; }
  .cover img { max-width: 100%; }
  h1 { font-size: 30pt; margin: 0 0 .3em; }
  h2 { font-size: 18pt; margin: 0 0 1em; }
  h3 { font-size: 13pt; margin: 1.6em 0 .4em; }
  p { margin: 0 0 1em; text-align: justify; }
  ${
    opts.dropCaps
      ? ".page > p:first-of-type::first-letter { float: left; font-size: 42pt; line-height: .8; padding: 4px 6px 0 0; }"
      : ""
  }
  blockquote { margin: 1.4em 1.2em; font-style: italic; border-left: 2px solid #bbb; padding-left: 1em; }
  .title-page { text-align: center; padding-top: 22%; }
  .subtitle { font-style: italic; font-size: 13pt; }
  .byline { margin-top: 3em; letter-spacing: .12em; text-transform: uppercase; font-size: 10pt; }
  .chapter-num { display: block; font-size: 10pt; letter-spacing: .16em; text-transform: uppercase; color: #7a6a52; margin-bottom: .5em; }
  .part { text-align: center; padding-top: 35%; }
  .small { font-size: 9.5pt; color: #4a443c; }
  .toc { padding-left: 1.2em; }
  .toc li { margin-bottom: .4em; }
  .toc-sub { list-style: none; padding-left: 0; margin: .3em 0 .6em; font-size: 10pt; color: #5c554b; }
</style></head>
<body>${cover}${body}</body></html>`;
}


export function buildMarkdown(book: Book) {
  const parts = [`# ${book.title}`, book.subtitle, `_by ${book.author}_`, ""];
  for (const page of book.pages) {
    if (page.type === "title" || page.type === "blank") continue;
    parts.push(`\n## ${page.title}\n`, page.content);
  }
  return parts.filter(Boolean).join("\n");
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function printBook(book: Book) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildHtml(book));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "manuscript";
