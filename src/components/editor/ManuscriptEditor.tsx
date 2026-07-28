import { useRef } from "react";
import { Bold, Heading2, Italic, List, Quote, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { wordCount } from "@/lib/books";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function ManuscriptEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || "text";
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function prefixLine(prefix: string) {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  }

  function stripDashes() {
    onChange(value.replace(/\s*[—–]\s*/g, ", ").replace(/, ,/g, ","));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolButton label="Bold" onClick={() => wrap("**")}>
          <Bold className="size-4" />
        </ToolButton>
        <ToolButton label="Italic" onClick={() => wrap("*")}>
          <Italic className="size-4" />
        </ToolButton>
        <ToolButton label="Sub-heading" onClick={() => prefixLine("## ")}>
          <Heading2 className="size-4" />
        </ToolButton>
        <ToolButton label="Quote" onClick={() => prefixLine("> ")}>
          <Quote className="size-4" />
        </ToolButton>
        <ToolButton label="List item" onClick={() => prefixLine("- ")}>
          <List className="size-4" />
        </ToolButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="sm" onClick={stripDashes} className="h-8 text-xs">
          <Redo2 className="size-3.5" /> Strip em dashes
        </Button>
        <span className="ml-auto pr-1 text-xs text-muted-foreground">
          {wordCount(value).toLocaleString()} words
        </span>
      </div>

      <Textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="manuscript min-h-0 flex-1 resize-none rounded-none border-0 bg-paper px-8 py-6 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant="ghost" size="sm" className="size-8 p-0" title={label} onClick={onClick}>
      {children}
    </Button>
  );
}
