"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { validatePasswordChange, MIN_PASSWORD_LENGTH } from "@/lib/password";

export default function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    const problem = validatePasswordChange(current, next, confirm);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // Re-check the current password first — a session left open on a shared
    // device shouldn't be enough to change it.
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (authError) {
      setError("Your current password is incorrect.");
      setBusy(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h2 className="section-title">Change password</h2>
      <div>
        <label className="mb-1 block text-sm font-medium">Current password</label>
        <input
          type="password"
          className="input w-full"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">New password</label>
        <input
          type="password"
          className="input w-full"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
        <p className="mt-1 text-xs text-gray-400">At least {MIN_PASSWORD_LENGTH} characters. A password manager is your friend here.</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Confirm new password</label>
        <input
          type="password"
          className="input w-full"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {done && <p className="text-sm text-emerald-600">Password updated. Use it next time you sign in.</p>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
