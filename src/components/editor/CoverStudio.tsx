import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Search, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { suggestCoverPrompts } from "@/lib/book-ai.functions";
import { streamImage } from "@/lib/stream-image";
import type { Book } from "@/lib/books";

type Preset = { label: string; category: string; prompt: string; tags: string };

const CATEGORIES = [
  "Minimal",
  "Illustrated",
  "Photographic",
  "Abstract",
  "Vintage",
  "Bold type",
  "Dark",
  "Nature",
];

const PRESETS: Preset[] = [
  ["Swiss grid", "Minimal", "austere Swiss grid cover, single geometric shape, flat cream and ink palette, generous negative space, print-ready", "clean simple geometric business"],
  ["Single object", "Minimal", "one symbolic object photographed flat on paper texture, soft daylight, muted palette, lots of empty space", "simple icon calm"],
  ["Ink line art", "Illustrated", "hand drawn ink line illustration, sparse crosshatching, off-white paper, one spot colour", "drawing sketch literary"],
  ["Risograph", "Illustrated", "risograph print look, two overlapping spot inks, visible grain and misregistration, bold simplified shapes", "print retro indie"],
  ["Woodcut", "Illustrated", "black woodcut engraving style illustration, high contrast, textured carve marks, antique feel", "classic folk historical"],
  ["Golden hour", "Photographic", "cinematic golden hour photograph, shallow depth of field, warm haze, editorial composition with space at the top", "warm memoir travel"],
  ["Desk still life", "Photographic", "overhead still life photograph of a work desk, natural light, muted neutral palette, quiet composition", "business craft productivity"],
  ["Portrait shadow", "Photographic", "moody portrait lit by a single hard light, deep shadow, film grain, editorial", "memoir biography"],
  ["Colour field", "Abstract", "large soft colour field gradient painting, subtle canvas texture, two harmonising hues", "calm modern art"],
  ["Paper collage", "Abstract", "torn paper collage, layered matte colours, tactile edges, mid-century composition", "creative essays"],
  ["Fluid ink", "Abstract", "ink dispersing in water, high detail macro, dark background, single vivid colour", "poetry thriller"],
  ["Pulp paperback", "Vintage", "1960s pulp paperback cover painting, saturated flat colours, dramatic figure silhouette, aged paper texture", "retro fiction"],
  ["Penguin classic", "Vintage", "mid-century publisher cover, horizontal colour bands, restrained illustration in the centre panel, aged stock", "classic literary"],
  ["Blueprint", "Vintage", "technical blueprint drawing on deep blue paper, precise white line work, annotations removed", "engineering history"],
  ["Slab poster", "Bold type", "poster-style background for heavy slab type, strong diagonal colour blocks, high contrast, no lettering", "manifesto business"],
  ["Neon grid", "Bold type", "dark background with glowing neon grid receding to a horizon, punchy magenta and cyan, room for a big title", "tech future"],
  ["Midnight ink", "Dark", "near-black background with a single luminous shape, deep indigo, soft glow, minimal", "mystery philosophy"],
  ["Smoke", "Dark", "wisps of pale smoke on charcoal background, high contrast monochrome, cinematic", "thriller horror"],
  ["Starfield", "Dark", "deep space starfield with a faint nebula, dark navy, subtle grain, cinematic", "sci-fi science"],
  ["Botanical", "Nature", "detailed botanical illustration in the style of an antique plate, muted greens on cream", "wellness gardening"],
  ["Coastline", "Nature", "aerial photograph of a coastline, turquoise water meeting pale sand, abstract from above", "travel memoir"],
  ["Mountain fog", "Nature", "layered mountain ridges fading into fog, soft desaturated palette, painterly", "adventure reflection"],
  ["Topographic", "Minimal", "topographic contour lines forming an abstract pattern, two-tone, precise and quiet", "maps strategy"],
  ["Isometric", "Illustrated", "isometric illustration of a small stylised scene, flat colours, soft shadows, clean vector look", "tech product"],
].map(([label, category, prompt, tags]) => ({ label, category, prompt, tags }));

export function CoverStudio({
  book,
  onApply,
}: {
  book: Book;
  onApply: (dataUrl: string) => void;
}) {
  const suggest = useServerFn(suggestCoverPrompts);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState<Preset[]>([]);

  const results = useMemo(() => {
    const all = [...suggested, ...PRESETS];
    const q = query.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q ||
          p.label.toLowerCase().includes(q) ||
          p.tags.toLowerCase().includes(q) ||
          p.prompt.toLowerCase().includes(q)),
    );
  }, [query, category, suggested]);

  async function generate(stylePrompt: string) {
    setBusy(true);
    setPreview(null);
    setIsFinal(false);
    try {
      const prompt = `Front cover artwork for a book titled "${book.title}" about ${
        book.topic || book.title
      }. Style: ${stylePrompt}. Vertical 2:3 book cover composition. Absolutely no text, no letters, no words, no logos in the image.`;
      await streamImage("/api/generate-image", prompt, (dataUrl, final) => {
        setPreview(dataUrl);
        if (final) setIsFinal(true);
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cover generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function askAI() {
    setBusy(true);
    try {
      const { prompts } = await suggest({
        data: { title: book.title, topic: book.topic || book.title },
      });
      setSuggested(
        (prompts ?? []).map((p) => ({
          label: p.label,
          category: "For this book",
          prompt: p.prompt,
          tags: "suggested",
        })),
      );
      setCategory(null);
      toast.success("Six directions art-directed for this book.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not fetch directions.");
    } finally {
      setBusy(false);
    }
  }

  function upload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result));
      setIsFinal(true);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_230px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search styles: woodcut, neon, botanical…"
              className="pl-8"
            />
          </div>
          <Button variant="secondary" onClick={askAI} disabled={busy}>
            <Sparkles className="size-4" /> Art-direct for me
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge
            onClick={() => setCategory(null)}
            variant={category === null ? "default" : "outline"}
            className="cursor-pointer"
          >
            All
          </Badge>
          {(suggested.length ? ["For this book", ...CATEGORIES] : CATEGORIES).map((c) => (
            <Badge
              key={c}
              onClick={() => setCategory(c === category ? null : c)}
              variant={category === c ? "default" : "outline"}
              className="cursor-pointer"
            >
              {c}
            </Badge>
          ))}
        </div>

        <div className="grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {results.map((p) => (
            <button
              key={p.label + p.category}
              disabled={busy}
              onClick={() => generate(p.prompt)}
              className="surface rounded-md p-3 text-left transition-shadow hover:shadow-lift disabled:opacity-50"
            >
              <p className="font-display text-sm leading-tight">{p.label}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {p.category}
              </p>
            </button>
          ))}
          {results.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              No styles match “{query}”. Describe it below instead.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            rows={2}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Or describe the cover yourself…"
          />
          <div className="flex gap-2">
            <Button disabled={busy || !custom.trim()} onClick={() => generate(custom)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Generate
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Upload art
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="surface relative aspect-[2/3] overflow-hidden rounded-sm">
          {preview ? (
            <img
              src={preview}
              alt="Cover preview"
              className={`size-full object-cover transition-[filter] duration-500 ${
                isFinal ? "blur-0" : "blur-xl"
              }`}
            />
          ) : book.coverUrl ? (
            <img src={book.coverUrl} alt="Current cover" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
              Pick a style to preview a cover
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <p className="font-display text-sm on-media">{book.title}</p>
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!preview || !isFinal}
          onClick={() => preview && onApply(preview)}
        >
          Use this cover
        </Button>
      </div>
    </div>
  );
}
