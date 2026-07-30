interface ToastMessage {
  message: string;
  type: "success" | "error";
}

let queue: ToastMessage[] = [];
let showing = false;
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function showNext() {
  if (showing || queue.length === 0) return;
  showing = true;
  const item = queue.shift()!;
  const toast = document.getElementById("foyerToast");
  if (!toast) { showing = false; showNext(); return; }
  toast.textContent = item.message;
  toast.className = `foyer-toast foyer-toast--${item.type} show`;
  timeoutId = setTimeout(() => {
    toast.classList.remove("show");
    showing = false;
    timeoutId = null;
    showNext();
  }, 3000);
}

export function showToast(message: string, type: "success" | "error" = "success") {
  queue.push({ message, type });
  if (!showing) showNext();
}

export function clearToastQueue() {
  queue = [];
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
  showing = false;
  const toast = document.getElementById("foyerToast");
  if (toast) toast.classList.remove("show");
}
