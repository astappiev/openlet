import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { createSet } from "../../src/lib/actions/sets";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { PageHeader } from "../components/page-header";
import { cn } from "../lib/cn";

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
  component: AIGeneratePage,
});

function AIGeneratePage() {
  const navigate = Route.useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    { term: string; definition: string }[] | null
  >(null);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");

  async function generate() {
    if (!notes.trim()) {
      setError("Paste your notes first");
      return;
    }
    if (!apiKey.trim()) {
      setError("API key required - calls go from your browser to the provider");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    const systemPrompt = `You are a flashcard generator. Convert notes into term/definition pairs.
Return ONLY a JSON array of objects with "term" and "definition" fields.
One concept per card. Precise and concise.`;

    try {
      let cards: { term: string; definition: string }[] = [];

      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: notes },
            ],
            temperature: 0.3,
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error?.message || "OpenAI request failed");
        const text = data.choices?.[0]?.message?.content || "";
        cards = JSON.parse(
          text
            .replace(/```json\s*/gi, "")
            .replace(/```\s*$/gm, "")
            .trim(),
        );
      } else {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-3-haiku-20240307",
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: notes }],
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error?.message || "Anthropic request failed");
        const text = data.content?.[0]?.text || "";
        cards = JSON.parse(
          text
            .replace(/```json\s*/gi, "")
            .replace(/```\s*$/gm, "")
            .trim(),
        );
      }

      if (!Array.isArray(cards) || cards.length === 0)
        throw new Error("No cards generated");
      setResult(cards);
      if (!title) setTitle("Generated set");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Generation failed. Check your API key.",
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
        description="Your key, your notes. Cards stay in Openlet."
      />

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Provider
          </span>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {(["openai", "anthropic"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  provider === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">
            API key
          </label>
          <Input
            type="password"
            placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1.5 font-mono text-sm"
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sent only to the provider from your browser. Not stored on Openlet
            servers.
          </p>
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-muted-foreground">
            Notes
          </label>
          <Textarea
            placeholder="Paste lecture notes, textbook excerpts, or outlines…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className="mt-1.5"
          />
        </div>

        <Button
          className="mt-4 w-full"
          onClick={generate}
          disabled={loading || !notes.trim()}
        >
          {loading ? "Generating…" : "Generate cards"}
        </Button>
      </div>

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
