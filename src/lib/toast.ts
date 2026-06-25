export function showToast(message: string, type: "success" | "error" = "success") {
  const toast = document.getElementById("foyerToast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `foyer-toast foyer-toast--${type} show`;
  setTimeout(() => toast.classList.remove("show"), 3000);
}
