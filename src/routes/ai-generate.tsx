import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  createSet,
  checkAIGeneratorStatus,
  generateAICards,
} from "../../src/lib/actions/sets";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { PageHeader } from "../components/page-header";

export const Route = createFileRoute("/ai-generate")({
  head: () => ({
    meta: [
      { title: "AI Generate | Openlet" },
      {
        name: "description",
        content:
          "Generate flashcards from your notes using AI. Paste lecture notes or textbook excerpts to create study sets.",
      },
      { property: "og:title", content: "AI Generate | Openlet" },
      {
        property: "og:description",
        content:
          "Generate flashcards from your notes using AI. Paste lecture notes or textbook excerpts to create study sets.",
      },
      { name: "twitter:title", content: "AI Generate | Openlet" },
      {
        name: "twitter:description",
        content:
          "Generate flashcards from your notes using AI. Paste lecture notes or textbook excerpts to create study sets.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { getSession } = await import("../../src/lib/auth/actions");
    const session = await getSession();
    if (!session) throw redirect({ to: "/signin" });
  },
  loader: async () => {
    try {
      return await checkAIGeneratorStatus();
    } catch {
      return { enabled: false };
    }
  },
  component: AIGeneratePage,
});

function AIGeneratePage() {
  const navigate = Route.useNavigate();
  const { enabled } = Route.useLoaderData();
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    { term: string; definition: string }[] | null
  >(null);
  const [error, setError] = useState("");

  async function generate() {
    if (!notes.trim()) {
      setError("Paste your notes first");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const cards = await generateAICards({ data: { notes } });
      setResult(cards);
      if (!title) setTitle("Generated set");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Generation failed. Please try again later.",
      );
    }
    setLoading(false);
  }

  async function createSetFromResult() {
    if (!result || result.length === 0) return;
    try {
      const res = await createSet({
        data: {
          title: title.trim() || "Generated set",
          description: "",
          subject: "",
          cards: result,
        },
      });
      navigate({ to: "/set/$id", params: { id: res.id } });
    } catch {
      setError("Failed to create set");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <PageHeader
        back={
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Library
          </a>
        }
        title="AI generator"
        badge="Beta"
        description="Your notes. Cards stay in Openlet."
      />

      {!enabled ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h3 className="text-lg font-bold text-foreground">
            AI Generation Disabled
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This feature is currently not configured on this server. To enable
            it, please set the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              OPENAI_API_KEY
            </code>{" "}
            environment variable on the backend.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Notes
            </label>
            <Textarea
              placeholder="Paste lecture notes, textbook excerpts, or outlines…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              className="mt-1.5"
            />
          </div>

          <Button
            className="w-full"
            onClick={generate}
            disabled={loading || !notes.trim()}
          >
            {loading ? "Generating…" : "Generate cards"}
          </Button>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Set title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-56"
                placeholder="Generated set"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {result.length} card{result.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {result.map((card, i) => (
              <div key={i} className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                <p className="font-semibold text-foreground">{card.term}</p>
                <p className="mt-0.5 text-muted-foreground">
                  {card.definition}
                </p>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={createSetFromResult}>
            Create set
          </Button>
        </div>
      )}
    </div>
  );
}
