export function highlightUpload() {
  const el = document.getElementById("upload");
  if (!el) return;
  el.classList.remove("upload-highlight");
  // Force a reflow so the animation restarts if the CTA is clicked again.
  void el.offsetWidth;
  el.classList.add("upload-highlight");
}
