import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { scanReceipt } from "@/lib/requests.functions";
import { compressImage, fileHash, fileToDataUrl } from "@/lib/queries";
import { EXPENSE_CATEGORIES } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExpenseForm({ requestId, userId, onSaved }: { requestId: string; userId: string; onSaved: () => void }) {
  const scan = useServerFn(scanReceipt);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const empty = { expense_date: "", category: "outros", vendor: "", description: "", amount: "" };
  const [f, setF] = useState(empty);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    // Check the original file before compressing or spending an AI reading on it.
    const digest = await fileHash(raw);
    const { data: inUse } = await supabase.rpc("receipt_hash_in_use", { _hash: digest });
    if (inUse) {
      toast.error("Este recibo já foi lançado em outra despesa.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const blob = await compressImage(raw);
    setFile(blob);
    setHash(digest);
    const dataUrl = await fileToDataUrl(blob);
    setPreview(blob.type.startsWith("image/") ? dataUrl : null);
    setReading(true);
    try {
      const r = await scan({ data: { dataUrl } });
      setF({
        expense_date: r.date ?? "",
        category: r.category || "outros",
        vendor: r.vendor ?? "",
        description: r.description ?? "",
        amount: r.amount != null ? String(r.amount) : "",
      });
      toast.success("Recibo lido! Confira os dados.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let receipt_path: string | null = null;
      if (file) {
        const ext = file.type === "application/pdf" ? "pdf" : "jpg";
        receipt_path = `${userId}/${requestId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("receipts").upload(receipt_path, file, { contentType: file.type });
        if (error) throw error;
      }
      const { error } = await supabase.from("expenses").insert({
        request_id: requestId,
        expense_date: f.expense_date || null,
        category: f.category,
        vendor: f.vendor,
        description: f.description,
        amount: Number(f.amount.replace(",", ".")) || 0,
        receipt_path,
        receipt_hash: receipt_path ? hash : null,
      });
      if (error) {
        // Don't leave an orphan file in storage when the expense itself was refused.
        if (receipt_path) await supabase.storage.from("receipts").remove([receipt_path]);
        throw error;
      }
      setF(empty); setFile(null); setHash(null); setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={onFile} />
        <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={reading}>
          {reading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {reading ? "Lendo recibo..." : "Fotografar recibo"}
        </Button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="size-3" /> Os campos são preenchidos automaticamente</span>
        {preview && <img src={preview} alt="Recibo" className="ml-auto h-16 rounded-md border object-cover" />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Estabelecimento</Label><Input value={f.vendor} onChange={set("vendor")} /></div>
        <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={f.expense_date} onChange={set("expense_date")} /></div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <select value={f.category} onChange={set("category")} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
            {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label>Valor (R$)</Label><Input required inputMode="decimal" value={f.amount} onChange={set("amount")} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Input value={f.description} onChange={set("description")} /></div>
      </div>
      <Button type="submit" disabled={saving || reading}>Adicionar despesa</Button>
    </form>
  );
}
