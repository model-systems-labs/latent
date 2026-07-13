/**
 * Starts a learner-authored download without revoking the object URL before
 * slower browsers have consumed the click. Keeping this boundary shared also
 * makes portfolio, backup, analytics, and artifact exports behave identically.
 */
export function downloadBrowserBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
