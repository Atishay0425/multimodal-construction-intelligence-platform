import { useCallback, useState } from "react";

function errorText(body, status) {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (status === 413) return "The photos are too large to upload together. Try fewer or smaller photos.";
  if (Array.isArray(d)) return d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
  return `Request failed (${status})`;
}

export async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("Cannot reach the server. Check your connection, or that the backend is running.");
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 && path !== "/api/auth") window.dispatchEvent(new Event("auth-required"));
  if (!res.ok) throw new Error(errorText(body, res.status));
  return body;
}

// Hosts like Vercel cap request bodies at 4.5 MB, so large photos are resized in the browser
// (the backend downsizes to 1568px anyway). Anything the browser can't decode is sent as-is
// so the backend can report what's wrong with it.
const MAX_SIDE = 1568;
const SHRINK_OVER_BYTES = 1_500_000;

async function shrinkImage(file) {
  if (file.size <= SHRINK_OVER_BYTES) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement("canvas"), {
      width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale),
    });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export async function postForm(path, values, files = []) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, v);
  });
  for (const f of await Promise.all(files.map(shrinkImage))) fd.append("images", f);
  return request(path, { method: "POST", body: fd });
}

export const postJson = (path, data) =>
  request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const getHistory = (kind) => request(`/api/history${kind ? `?kind=${kind}` : ""}`);
export const deleteHistory = (id) => request(`/api/history/${id}`, { method: "DELETE" });
export const getHealth = () => request("/api/health");
export const login = (password) => postJson("/api/auth", { password });

export function downloadJson(envelope) {
  const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob), download: `${envelope.kind}-${envelope.id.slice(0, 8)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Wraps an async call with loading / error / data state. */
export function useAnalysis(fn) {
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const run = useCallback(
    async (...args) => {
      setState({ loading: true, error: "", data: null });
      try {
        setState({ loading: false, error: "", data: await fn(...args) });
      } catch (e) {
        setState({ loading: false, error: e.message, data: null });
      }
    },
    [fn]
  );
  return { ...state, run };
}

export const money = (n, currency = "INR") => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
};
