"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    // Ensure user doc exists (mirrors the original login behavior)
    const ensureUserDoc = async () => {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          {
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
            lastLogin: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Could not write user doc:", e);
      }
    };
    ensureUserDoc();

    // Populate avatar UI
    setupUserAvatar(user);
  }, [user, loading, router]);

  return (
    <>
      {loading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "linear-gradient(135deg, #0f0c29, #302b63, #1a1040)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
          fontFamily: "Inter, sans-serif", fontSize: 16,
        }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 28, marginRight: 12 }}></i>
          Loading Foyer...
        </div>
      )}
      <div style={{ display: loading ? "none" : undefined }}>
        {children}
      </div>
    </>
  );
}

function setupUserAvatar(user: import("firebase/auth").User) {
  const avatarImg = document.getElementById("userAvatarImg") as HTMLImageElement | null;
  const avatarInitials = document.getElementById("userAvatarInitials");
  const menuName = document.getElementById("userMenuName");
  const menuEmail = document.getElementById("userMenuEmail");

  const fallbackToInitials = () => {
    if (avatarInitials) {
      (avatarInitials as HTMLElement).style.display = "flex";
      const seed = user.displayName || user.email || "U";
      avatarInitials.textContent = seed.charAt(0).toUpperCase();
    }
    if (avatarImg) avatarImg.style.display = "none";
  };

  if (user.photoURL && avatarImg) {
    avatarImg.onerror = fallbackToInitials;
    avatarImg.src = user.photoURL;
    avatarImg.style.display = "block";
    if (avatarInitials) (avatarInitials as HTMLElement).style.display = "none";
  } else {
    fallbackToInitials();
  }

  if (menuName) menuName.textContent = user.displayName || user.email || "User";
  if (menuEmail) menuEmail.textContent = user.email || "";
}
