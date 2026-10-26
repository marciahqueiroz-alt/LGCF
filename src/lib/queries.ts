import { supabase } from "@/integrations/supabase/client";
import type { RequestRow } from "@/components/RequestTable";
import type { RequestStatus } from "./workflow";

export async function fetchRequests(opts: { mine?: string; statuses?: RequestStatus[] } = {}): Promise<RequestRow[]> {
  let q = supabase.from("requests").select("*").order("updated_at", { ascending: false });
  if (opts.mine) q = q.eq("user_id", opts.mine);
  if (opts.statuses) q = q.in("status", opts.statuses);
  const { data, error } = await q;
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((r) => r.user_id))];
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as { id: string; full_name: string; email: string }[] };
  const names = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.email]));
  return (data ?? []).map((r) => ({
    ...r,
    advance_amount: Number(r.advance_amount),
    spent_amount: Number(r.spent_amount),
    settlement_amount: Number(r.settlement_amount),
    owner: names.get(r.user_id) ?? "—",
  }));
}

export async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** SHA-256 of the original file, used to detect the same receipt being sent twice. */
export async function fileHash(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Downscale photos so uploads and AI reading stay fast. */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
