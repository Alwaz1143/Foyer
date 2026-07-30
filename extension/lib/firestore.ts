import {
  doc, collection as fsCollection, getDocs, setDoc, deleteDoc, writeBatch,
  addDoc, query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Category, Website, PendingBookmark } from "../shared/types";

export async function getCategories(uid: string): Promise<Category[]> {
  const catsSnap = await getDocs(fsCollection(db, "users", uid, "categories"));
  if (catsSnap.empty) return [];

  const sortedCats = catsSnap.docs
    .sort((a, b) => (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999))
    .map((d) => ({ id: d.id, name: d.data().name, icon: d.data().icon }));

  const loaded: Category[] = [];
  for (const cat of sortedCats) {
    const sitesSnap = await getDocs(fsCollection(db, "users", uid, "categories", cat.id, "websites"));
    const sortedSites = sitesSnap.docs
      .sort((a, b) => (a.data().orderIndex ?? 999) - (b.data().orderIndex ?? 999))
      .map((s) => ({
        id: s.id,
        name: s.data().name,
        url: s.data().url,
        domain: s.data().domain,
        customIcon: s.data().customIcon,
      } as Website));
    loaded.push({ id: cat.id, name: cat.name, icon: cat.icon || "", websites: sortedSites });
  }

  return loaded;
}

export async function addSiteToCategory(
  uid: string,
  categoryId: string,
  site: Website
): Promise<void> {
  const siteRef = doc(fsCollection(db, "users", uid, "categories", categoryId, "websites"));
  await setDoc(siteRef, {
    ...site,
    orderIndex: Date.now(),
  });
}

export async function replaceCategories(uid: string, categories: Category[]): Promise<void> {
  const batch = writeBatch(db);

  for (const cat of categories) {
    const catRef = doc(fsCollection(db, "users", uid, "categories"), cat.id);
    batch.set(catRef, { name: cat.name, icon: cat.icon, orderIndex: cat.orderIndex ?? 0 });

    for (const site of cat.websites) {
      const siteRef = doc(fsCollection(db, "users", uid, "categories", cat.id, "websites"), site.id);
      batch.set(siteRef, {
        name: site.name,
        url: site.url,
        domain: site.domain,
        customIcon: site.customIcon || "",
        orderIndex: site.orderIndex ?? Date.now(),
      });
    }
  }

  await batch.commit();
}

export async function clearCategories(uid: string): Promise<void> {
  const cats = await getCategories(uid);
  const batch = writeBatch(db);
  for (const cat of cats) {
    for (const site of cat.websites) {
      const siteRef = doc(fsCollection(db, "users", uid, "categories", cat.id, "websites"), site.id);
      batch.delete(siteRef);
    }
    const catRef = doc(fsCollection(db, "users", uid, "categories"), cat.id);
    batch.delete(catRef);
  }
  await batch.commit();
}

export async function addPendingBookmark(
  uid: string,
  title: string,
  url: string,
  normalizedUrl: string,
  folder: string | undefined,
  classification: { confidence: string; matchedBy: string; suggestedCategoryName?: string | null },
): Promise<string> {
  const ref = await addDoc(fsCollection(db, "users", uid, "pendingBookmarks"), {
    title,
    url,
    normalizedUrl,
    folder: folder || null,
    suggestedCategoryName: classification.suggestedCategoryName || null,
    confidence: classification.confidence,
    matchedBy: classification.matchedBy,
    source: "extension",
    timestamp: Timestamp.now().toMillis(),
    status: "pending",
  });
  return ref.id;
}

export async function getPendingBookmarks(uid: string): Promise<PendingBookmark[]> {
  const q = query(
    fsCollection(db, "users", uid, "pendingBookmarks"),
    where("status", "==", "pending"),
    orderBy("timestamp", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      url: data.url,
      normalizedUrl: data.normalizedUrl,
      folder: data.folder || undefined,
      suggestedCategoryName: data.suggestedCategoryName || undefined,
      confidence: data.confidence,
      matchedBy: data.matchedBy,
      source: data.source,
      timestamp: data.timestamp,
      status: data.status,
    } as PendingBookmark;
  });
}

export async function removePendingBookmark(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "pendingBookmarks", id));
}

export async function clearAllPending(uid: string): Promise<void> {
  const items = await getPendingBookmarks(uid);
  const batch = writeBatch(db);
  for (const item of items) {
    batch.delete(doc(db, "users", uid, "pendingBookmarks", item.id));
  }
  await batch.commit();
}
