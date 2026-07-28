import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ScanSearch, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { auditText, humanizeText } from "@/lib/book-ai.functions";
import { scanTells } from "@/lib/books";

type Audit = {
  aiLikelihood: number;
  verdict: string;
  tells: { quote: string; why: string }[];
  derivative: { quote: string; why: string }[];
  fixes: string[];
};

export function AuditPanel({
  text,
  onReplace,
}: {
  text: string;
  onReplace: (next: string) => void;
}) {
  const runAudit = useServerFn(auditText);
  const runHumanize = useServerFn(humanizeText);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [busy, setBusy] = useState<"audit" | "humanize" | null>(null);
  const local = scanTells(text);

  async function doAudit() {
    if (text.trim().length < 40) return toast.error("Write something first.");
    setBusy("audit");
    try {
      setAudit((await runAudit({ data: { text } })) as Audit);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audit failed.");
    } finally {
      setBusy(null);
    }
  }

  async function doHumanize(intensity: "light" | "medium" | "heavy") {
    if (text.trim().length < 40) return toast.error("Write something first.");
    setBusy("humanize");
    try {
      const next = await runHumanize({ data: { text, intensity } });
      onReplace(next);
      setAudit(null);
      toast.success("Rewritten in a human register.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Humanising failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Live tell scan
          </span>
          <span className="font-display text-lg">{local.score}%</span>
        </div>
        <Progress value={local.score} className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          Sentence-length variance {local.burstiness} · {local.emDashes} em dashes ·{" "}
          {local.phrases.length} flagged phrases
        </p>
        {local.phrases.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {local.phrases.map((p) => (
              <Badge key={p} variant="secondary" className="font-normal">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Humanise this page
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {(["light", "medium", "heavy"] as const).map((level) => (
            <Button
              key={level}
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => doHumanize(level)}
              className="capitalize"
            >
              {busy === "humanize" ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {level}
            </Button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={busy !== null}
          onClick={doAudit}
        >
          {busy === "audit" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanSearch className="size-4" />
          )}
          Deep audit for AI &amp; borrowed phrasing
        </Button>
      </div>

      {audit && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Editor verdict
              </span>
              <span className="font-display text-lg">{audit.aiLikelihood}%</span>
            </div>
            <p className="mt-1 text-sm">{audit.verdict}</p>
          </div>

          {audit.tells?.length > 0 && (
            <Section title="Machine-written tells" items={audit.tells} />
          )}
          {audit.derivative?.length > 0 && (
            <Section title="Reads borrowed / generic" items={audit.derivative} />
          )}
          {audit.fixes?.length > 0 && (
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fixes
              </span>
              <ul className="mt-1 space-y-1">
                {audit.fixes.map((f) => (
                  <li key={f} className="flex gap-2 text-xs text-muted-foreground">
                    <Wand2 className="mt-0.5 size-3 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: { quote: string; why: string }[] }) {
  return (
    <div>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <ul className="mt-1 space-y-2">
        {items.map((item) => (
          <li key={item.quote} className="rounded-md bg-secondary/70 p-2">
            <p className="font-display text-xs italic">“{item.quote}”</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.why}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
