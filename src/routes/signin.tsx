import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Field } from "../components/ui/field";
import { LogoMark } from "../components/logo";
import { toUserMessage } from "../lib/errors";
import { z } from "zod";
import { createClient } from "../lib/supabase/client";
import { getAvailableProviders, signInWithProvider } from "../lib/auth/actions";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/signin")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in | Openlet" },
      {
        name: "description",
        content:
          "Sign in or sign up to Openlet. Free flashcards, practice tests, and spaced repetition.",
      },
      { property: "og:title", content: "Sign in | Openlet" },
      {
        property: "og:description",
        content: "Sign in or sign up to Openlet. Free study tools, no paywall.",
      },
      { name: "twitter:title", content: "Sign in | Openlet" },
      {
        name: "twitter:description",
        content: "Sign in or sign up to Openlet. Free study tools, no paywall.",
      },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(search.mode === "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    setIsSignUp(search.mode === "signup");
    setError("");
    setSuccessMessage("");
  }, [search.mode]);

  useEffect(() => {
    let cancelled = false;
    getAvailableProviders().then((result) => {
      if (!cancelled) {
        setGoogleEnabled(result.google ?? false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleMode() {
    const nextMode = isSignUp ? "signin" : "signup";
    navigate({ search: { mode: nextMode } });
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const { url } = await signInWithProvider({
        data: { provider: "google" },
      });
      window.location.href = url;
    } catch (err) {
      setError(toUserMessage(err, "Google sign-in failed. Please try again."));
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      if (isSignUp) {
        if (!name.trim()) {
          throw new Error("Name is required");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          await router.invalidate();
          navigate({ to: "/dashboard" });
        } else {
          setSuccessMessage(
            "Account created! Please check your email to confirm your account.",
          );
          setName("");
          setEmail("");
          setPassword("");
        }
      } else {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) throw signInError;

        await router.invalidate();
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(
        toUserMessage(err, isSignUp ? "Sign up failed." : "Sign in failed."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#f6f7fb] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-[#e8eaf0] bg-white px-8 py-10 shadow-sm text-center">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[15px] font-bold text-[#1a1d26] no-underline"
          >
            <LogoMark size={32} />
            Openlet
          </a>
          <h1 className="mt-6 text-xl font-extrabold tracking-tight text-[#1a1d26]">
            {isSignUp ? "Create your account" : "Sign in to study"}
          </h1>
          <p className="mt-2 text-sm text-[#4a5065]">
            Free forever &middot; No ads &middot; FSRS spaced repetition
          </p>

          {error && (
            <p className="mt-5 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5 text-sm font-medium text-[#e11d48] text-left">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="mt-5 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2.5 text-sm font-medium text-[#16a34a] text-left">
              {successMessage}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
            {isSignUp && (
              <Field id="name" label="Full Name">
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </Field>
            )}

            <Field id="email" label="Email Address">
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </Field>

            <Field id="password" label="Password">
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </Field>

            <Button
              type="submit"
              className="h-12 w-full mt-2 bg-[#4255ff] text-white hover:bg-[#3b4ce0] transition-colors font-semibold shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-flex items-center gap-3">
                  <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  {isSignUp ? "Creating account…" : "Signing in…"}
                </span>
              ) : (
                <span>
                  {isSignUp ? "Sign up with email" : "Sign in with email"}
                </span>
              )}
            </Button>
          </form>

          {googleEnabled && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e8eaf0]"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-[#9aa0b4]">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="h-12 w-full gap-3 border-[#d5d9e4] text-[15px] font-semibold text-[#1a1d26] shadow-sm hover:bg-[#f6f7fb]"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <span className="inline-flex items-center gap-3">
                  <svg
                    className="size-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </span>
              </Button>
            </>
          )}

          <p className="mt-6 text-sm text-[#4a5065]">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={toggleMode}
              className="font-bold text-[#4255ff] hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>

          <p className="mt-6 text-xs text-[#9aa0b4]">
            By signing in, you agree to our{" "}
            <a
              href="/legal/terms"
              target="_blank"
              className="font-semibold text-[#4255ff] hover:underline"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="/legal/privacy"
              target="_blank"
              className="font-semibold text-[#4255ff] hover:underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
