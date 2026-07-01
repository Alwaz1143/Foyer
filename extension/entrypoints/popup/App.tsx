import React, { useState, useEffect, useRef } from "react";
import { signInWithEmail, signUp } from "../../lib/auth";
import "./styles.css";

type PageState = "loading" | "signin" | "ready" | "adding" | "added" | "error" | "syncing" | "synced";

export default function App() {
  const [state, setState] = useState<PageState>("loading");
  const [tabInfo, setTabInfo] = useState<{ title: string; url: string } | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const res = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" });
      if (res.signedIn) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.url && tab?.title) {
          setTabInfo({ title: tab.title, url: tab.url });
        }
        setState("ready");
      } else {
        setState("signin");
        setTimeout(() => emailRef.current?.focus(), 100);
      }
    })();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setAuthError("Enter your email"); return; }
    if (!password) { setAuthError("Enter your password"); return; }
    if (password.length < 6) { setAuthError("Password must be at least 6 characters"); return; }

    setSubmitting(true);
    try {
      const user = isSignUp
        ? await signUp(trimmedEmail, password)
        : await signInWithEmail(trimmedEmail, password);
      await chrome.runtime.sendMessage({ type: "USER_SIGNED_IN", uid: user.uid });
      setState("ready");
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab?.url && tab?.title) {
        setTabInfo({ title: tab.title, url: tab.url });
      }
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential") {
        setAuthError("No account found with this email");
      } else if (code === "auth/wrong-password") {
        setAuthError("Incorrect password");
      } else if (code === "auth/email-already-in-use") {
        setAuthError("An account already exists with this email");
      } else if (code === "auth/too-many-requests") {
        setAuthError("Too many attempts. Try again later.");
      } else if (code === "auth/invalid-email") {
        setAuthError("Invalid email address");
      } else {
        setAuthError(err?.message || "Authentication failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setAuthError("");
    setEmail("");
    setPassword("");
  };

  const handleAddPage = async () => {
    setState("adding");
    const res = await chrome.runtime.sendMessage({ type: "ADD_CURRENT_PAGE" });
    if (res.success) {
      if (res.added) {
        setState("added");
        setMessage(res.categoryName ? `Added to ${res.categoryName}` : "Added to dashboard!");
      } else {
        setState("error");
        setMessage("Already in your dashboard");
      }
    } else {
      setState("error");
      setMessage(res.error === "not_signed_in" ? "Please sign in first" : "Failed to add page");
    }
  };

  const handleSyncAll = async () => {
    setState("syncing");
    const res = await chrome.runtime.sendMessage({ type: "SYNC_ALL_BOOKMARKS" });
    if (res.success) {
      setState("synced");
      setMessage("Bookmarks synced!");
    } else {
      setState("error");
      setMessage("Sync failed. Try again.");
    }
  };

  if (state === "loading") {
    return (
      <div className="popup-container">
        <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i></div>
      </div>
    );
  }

  if (state === "signin") {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <span className="popup-logo">Foyer</span>
        </div>
        <p className="popup-subtitle">
          {isSignUp ? "Create your account" : "Sign in to save and sync your sites"}
        </p>

        <form className="auth-form" onSubmit={handleAuth}>
          <input
            ref={emailRef}
            className="auth-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />

          {authError && <div className="auth-error">{authError}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? (
              <><i className="fas fa-spinner fa-spin"></i> Please wait...</>
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <button className="auth-toggle" onClick={toggleMode}>
          {isSignUp
            ? "Already have an account? Sign in"
            : "Don't have an account? Create one"}
        </button>

        <div className="auth-info">
          <i className="fas fa-info-circle"></i>
          <span>
            Used Google login? Open the Foyer dashboard → your profile → <strong>Reset password</strong>,
            then sign in here with the same email.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <span className="popup-logo">Foyer</span>
        <button className="btn btn-icon" onClick={handleSyncAll} title="Sync all bookmarks">
          <i className="fas fa-sync"></i>
        </button>
      </div>

      {tabInfo && (
        <div className="tab-preview">
          <div className="tab-icon"><i className="fas fa-globe"></i></div>
          <div className="tab-details">
            <div className="tab-title">{tabInfo.title}</div>
            <div className="tab-url">{tabInfo.url}</div>
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-block" onClick={handleAddPage} disabled={state === "adding"}>
        {state === "adding" ? (
          <><i className="fas fa-spinner fa-spin"></i> Adding...</>
        ) : (
          <><i className="fas fa-plus"></i> Add to Foyer</>
        )}
      </button>

      {state === "syncing" && (
        <div className="status-bar"><i className="fas fa-sync fa-spin"></i> Syncing bookmarks...</div>
      )}

      {state === "synced" && (
        <div className="status-bar status-success"><i className="fas fa-check"></i> {message}</div>
      )}

      {state === "added" && (
        <div className="status-bar status-success"><i className="fas fa-check"></i> {message}</div>
      )}

      {state === "error" && (
        <div className="status-bar status-error"><i className="fas fa-exclamation-circle"></i> {message}</div>
      )}
    </div>
  );
}
