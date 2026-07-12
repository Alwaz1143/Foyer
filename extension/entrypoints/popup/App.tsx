import React, { useState, useEffect, useRef } from "react";
import { signInWithEmail, signUp } from "../../lib/auth";
import type { ClassificationResult } from "../../shared/classifySite";
import "./styles.css";

type PageState = "loading" | "signin" | "ready" | "pending" | "confirming" | "adding" | "added" | "error" | "syncing" | "synced";

interface PendingBookmark {
  title: string;
  url: string;
  folderHint?: string;
  classification: ClassificationResult;
  timestamp: number;
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "#4caf50",
  medium: "#ff9800",
  low: "#f44336",
  none: "#888",
};

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

  const [pendingBookmarks, setPendingBookmarks] = useState<PendingBookmark[]>([]);
  const [pendingIndex, setPendingIndex] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATUS" });
      if (res.signedIn) {
        const catRes = await chrome.runtime.sendMessage({ type: "GET_CATEGORIES" });
        if (catRes.categories) {
          setCategories(catRes.categories.map((c: any) => ({ id: c.id, name: c.name })));
        }

        const pendingRes = await chrome.runtime.sendMessage({ type: "GET_PENDING_BOOKMARKS" });
        if (pendingRes.pendingBookmarks && pendingRes.pendingBookmarks.length > 0) {
          setPendingBookmarks(pendingRes.pendingBookmarks);
          setPendingIndex(0);
          const first = pendingRes.pendingBookmarks[0];
          setSelectedCategoryId(first.classification?.suggestedCategoryName
            ? findCategoryIdByName(catRes.categories, first.classification.suggestedCategoryName)
            : "");
          setState("pending");
        } else {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const tab = tabs[0];
          if (tab?.url && tab?.title) {
            setTabInfo({ title: tab.title, url: tab.url });
          }
          setState("ready");
        }
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
      const catRes = await chrome.runtime.sendMessage({ type: "GET_CATEGORIES" });
      if (catRes.categories) {
        setCategories(catRes.categories.map((c: any) => ({ id: c.id, name: c.name })));
      }
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

  // ── Pending bookmark confirmation ──────────────────────────────────────

  const currentPending = pendingBookmarks[pendingIndex];

  const getConfidenceColor = (confidence: string) => CONFIDENCE_COLORS[confidence] || "#888";
  const getConfidenceLabel = (confidence: string) => CONFIDENCE_LABELS[confidence] || "Unknown";

  const handleConfirm = async () => {
    const item = pendingBookmarks[pendingIndex];
    if (!item || confirmLoading) return;
    setConfirmLoading(true);
    setState("confirming");

    const res = await chrome.runtime.sendMessage({
      type: "CONFIRM_BOOKMARK",
      index: pendingIndex,
      title: item.title,
      url: item.url,
      folderHint: item.folderHint,
      categoryId: selectedCategoryId || undefined,
    });

    if (res.success) {
      setMessage(res.categoryName ? `Added to ${res.categoryName}` : "Added!");
    } else {
      setMessage(
        res.error === "already_exists" ? "Already in your dashboard" :
        res.error === "no_category" ? "Could not classify — pick a category" :
        "Failed to add"
      );
    }
    setConfirmLoading(false);
    await advanceToNext();
  };

  const handleSkip = async () => {
    const item = pendingBookmarks[pendingIndex];
    if (!item || confirmLoading) return;
    setConfirmLoading(true);
    await chrome.runtime.sendMessage({
      type: "SKIP_PENDING_BOOKMARK",
      index: pendingIndex,
    });
    setConfirmLoading(false);
    setMessage("Skipped");
    await advanceToNext();
  };

  const handleDismissAll = async () => {
    setConfirmLoading(true);
    await chrome.runtime.sendMessage({ type: "CLEAR_PENDING_BOOKMARKS" });
    setConfirmLoading(false);
    setPendingBookmarks([]);
    setState("ready");
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab?.url && tab?.title) {
      setTabInfo({ title: tab.title, url: tab.url });
    }
  };

  async function advanceToNext() {
    const refresh = await chrome.runtime.sendMessage({ type: "GET_PENDING_BOOKMARKS" });
    const updated: PendingBookmark[] = refresh.pendingBookmarks || [];
    if (updated.length === 0) {
      setPendingBookmarks([]);
      setState("ready");
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab?.url && tab?.title) {
        setTabInfo({ title: tab.title, url: tab.url });
      }
    } else {
      const nextIdx = pendingIndex < updated.length ? pendingIndex : 0;
      setPendingBookmarks(updated);
      setPendingIndex(nextIdx);
      setSelectedCategoryId(
        updated[nextIdx]?.classification?.suggestedCategoryName
          ? findCategoryIdByName(categories, updated[nextIdx].classification.suggestedCategoryName)
          : ""
      );
      setState("pending");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

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

  // ── Pending bookmarks confirmation UI ──────────────────────────────────

  if (state === "pending" || state === "confirming") {
    const pendingItem = pendingBookmarks[pendingIndex];
    const total = pendingBookmarks.length;
    const current = pendingIndex + 1;
    const cls = pendingItem?.classification;

    const canProceed = !!selectedCategoryId || !!cls?.categoryId;

    return (
      <div className="popup-container">
        <div className="popup-header">
          <span className="popup-logo">Foyer</span>
          <button className="btn btn-icon" onClick={handleDismissAll} disabled={confirmLoading} title="Dismiss all">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="pending-counter">{current} of {total} pending</div>

        {pendingItem && (
          <div className="pending-card">
            <div className="pending-card-title" title={pendingItem.title}>{pendingItem.title}</div>
            <div className="pending-card-url" title={pendingItem.url}>{pendingItem.url}</div>
          </div>
        )}

        {cls && cls.confidence !== "none" && (
          <div className="confidence-badge" style={{ borderLeftColor: getConfidenceColor(cls.confidence) }}>
            <span className="confidence-dot" style={{ background: getConfidenceColor(cls.confidence) }}></span>
            Detected: <strong>{cls.suggestedCategoryName || "Uncategorized"}</strong>
            <span className="confidence-label" style={{ color: getConfidenceColor(cls.confidence) }}>
              ({getConfidenceLabel(cls.confidence)})
            </span>
          </div>
        )}

        {cls && cls.confidence === "none" && (
          <div className="confidence-badge" style={{ borderLeftColor: "#888" }}>
            <span className="confidence-dot" style={{ background: "#888" }}></span>
            Could not auto-detect category
          </div>
        )}

        <div className="pending-select-group">
          <label className="pending-select-label">Category:</label>
          <select
            className="pending-select"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            disabled={confirmLoading}
          >
            <option value="">{cls?.categoryId ? "Use detected category" : "Select a category..."}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="pending-actions">
          <button
            className="btn btn-secondary btn-block"
            onClick={handleSkip}
            disabled={confirmLoading}
          >
            {confirmLoading ? <i className="fas fa-spinner fa-spin"></i> : "Skip"}
          </button>
          <button
            className="btn btn-primary btn-block"
            onClick={handleConfirm}
            disabled={!canProceed || confirmLoading}
          >
            {confirmLoading ? (
              <><i className="fas fa-spinner fa-spin"></i> Adding...</>
            ) : (
              <><i className="fas fa-check"></i> Add to {selectedCategoryId
                ? categories.find(c => c.id === selectedCategoryId)?.name || "Foyer"
                : cls?.suggestedCategoryName || "Foyer"}</>
            )}
          </button>
        </div>

        {(state === "confirming" || message) && (
          <div className={`status-bar ${message.includes("Added") ? "status-success" : message.includes("Failed") ? "status-error" : ""}`}>
            <i className="fas fa-info-circle"></i> {message || "Processing..."}
          </div>
        )}
      </div>
    );
  }

  // ── Ready / main UI ────────────────────────────────────────────────────

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

function findCategoryIdByName(cats: any[] | undefined, name: string): string {
  if (!cats || !name) return "";
  const lower = name.toLowerCase().trim();
  for (const c of cats) {
    const catName = c.name.toLowerCase().trim();
    if (catName.includes(lower) || lower.includes(catName)) return c.id;
    const noIcon = catName.replace(/[^\w\s-]/g, "").trim();
    if (noIcon.includes(lower) || lower.includes(noIcon)) return c.id;
  }
  return "";
}
