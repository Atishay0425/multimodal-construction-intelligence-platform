import { useCallback, useState } from "react";

function errorText(body, status) {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`).join("; ");
  return `Request failed (${status})`;
}

export async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error("Cannot reach the backend. Is it running on port 8000?");
  }
  const body = await res.json().catch(() => null);
  if (res.status === 401 && path !== "/api/auth") window.dispatchEvent(new Event("auth-required"));
  if (!res.ok) throw new Error(errorText(body, res.status));
  return body;
}

export function postForm(path, values, files = []) {
  const fd = new FormData();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, v);
  });
  files.forEach((f) => fd.append("images", f));
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
