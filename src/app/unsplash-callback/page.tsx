"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { foyerKey } from "@/lib/storage";
import "@/styles/css/auth.css";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"exchanging" | "saving" | "done" | "error">("exchanging");
  const [message, setMessage] = useState("Connecting to Unsplash...");
  const [senderUsername, setSenderUsername] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      setMessage(`Unsplash denied access: ${error}`);
      setTimeout(() => router.replace("/"), 3500);
      return;
    }

    if (!code) {
      setStatus("error");
      setMessage("No authorization code received.");
      setTimeout(() => router.replace("/"), 3500);
      return;
    }

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setStatus("error");
        setMessage("You must be signed in to connect Unsplash.");
        setTimeout(() => router.replace("/login"), 2000);
        return;
      }

      try {
        setMessage("Exchanging code for token...");
        const resp = await fetch(`/api/unsplash-exchange?code=${encodeURIComponent(code)}`);
        const data = await resp.json();

        if (!resp.ok) {
          setStatus("error");
          setMessage(data.error || "Failed to connect Unsplash.");
          setTimeout(() => router.replace("/"), 3500);
          return;
        }

        setStatus("saving");
        setMessage("Saving to your account...");

        localStorage.setItem(foyerKey("unsplash_connection", user.uid), JSON.stringify({
          accessToken: data.accessToken,
          username: data.username,
          foyerCollectionId: data.foyerCollectionId,
        }));

        setStatus("done");
        setSenderUsername(data.username);
        setMessage(`Connected as @${data.username}`);
        setTimeout(() => router.replace("/"), 2200);
      } catch (err) {
        setStatus("error");
        setMessage("An error occurred. Please try again.");
        console.error(err);
        setTimeout(() => router.replace("/"), 3500);
      }
    });

    return () => unsub();
  }, [searchParams, router]);

  return (
    <>
      <div className="auth-bg">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>
      <div className="auth-container">
        <div className="auth-card callback-card">
          <span className="cb-icon">
            {status === "error" ? "✗" : status === "done" ? "✓" : "🔗"}
          </span>
          <div className="cb-title">
            {status === "error" ? "Connection Failed" : status === "done" ? `Connected as @${senderUsername}` : "Connecting Unsplash..."}
          </div>
          <div className="cb-msg">{message}</div>
          {(status === "exchanging" || status === "saving") && <div className="spinner"></div>}
        </div>
      </div>
    </>
  );
}

export default function UnsplashCallbackPage() {
  return (
    <Suspense fallback={
      <div className="auth-bg">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  );
}
