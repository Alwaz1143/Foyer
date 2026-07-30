import { db } from "@/lib/firebase";
import {
  collection, addDoc, deleteDoc, doc, updateDoc,
  query, where, orderBy, onSnapshot, Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import type { PendingBookmark } from "@/lib/types";
import { normalizeUrl } from "@/lib/normalizeUrl";
import type { ClassificationResult } from "@/lib/classifySite";

function pendingCol(uid: string) {
  return collection(db, "users", uid, "pendingBookmarks");
}

function pendingDoc(uid: string, id: string) {
  return doc(db, "users", uid, "pendingBookmarks", id);
}

export async function addPendingBookmark(
  uid: string,
  title: string,
  url: string,
  classification: ClassificationResult,
  source: "extension" | "import",
  folder?: string,
  icon?: string,
): Promise<string> {
  const ref = await addDoc(pendingCol(uid), {
    title,
    url,
    normalizedUrl: normalizeUrl(url),
    folder: folder || null,
    icon: icon || null,
    suggestedCategoryName: classification.suggestedCategoryName || null,
    confidence: classification.confidence,
    matchedBy: classification.matchedBy,
    source,
    timestamp: Timestamp.now().toMillis(),
    status: "pending",
  });
  return ref.id;
}

export async function confirmPendingBookmark(uid: string, id: string): Promise<void> {
  await updateDoc(pendingDoc(uid, id), { status: "confirmed" });
}

export async function skipPendingBookmark(uid: string, id: string): Promise<void> {
  await updateDoc(pendingDoc(uid, id), { status: "skipped" });
}

export async function removePendingBookmark(uid: string, id: string): Promise<void> {
  await deleteDoc(pendingDoc(uid, id));
}

export function subscribePendingBookmarks(
  uid: string,
  callback: (items: PendingBookmark[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    pendingCol(uid),
    where("status", "==", "pending"),
    orderBy("timestamp", "desc"),
  );
  return onSnapshot(q,
    (snapshot) => {
      const items: PendingBookmark[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PendingBookmark, "id">),
      }));
      callback(items);
    },
    (error) => {
      console.error("Foyer: pending bookmarks snapshot error:", error);
      onError?.(error);
    },
  );
}
