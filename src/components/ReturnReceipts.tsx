import { useRef, useState } from "react";
import { FileImage, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/queries";
import { validateReturnReceipt } from "@/lib/return-receipts";
import { Button } from "@/components/ui/button";

type Proof = { id: string; receipt_path: string; file_name: string; created_at: string };

export function ReturnReceipts({ requestId, userId, editable, receipts, onSaved, onView }: {
  requestId: string; userId: string; editable: boolean; receipts: Proof[]; onSaved: () => void; onView: (path: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(raw: File) {
    setBusy(true);
    let path: string | null = null;
    try {
      validateReturnReceipt(raw);
      const file = await compressImage(raw);
      path = `${userId}/${requestId}/returns/${crypto.randomUUID()}.${file.type === "application/pdf" ? "pdf" : "jpg"}`;
      const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("return_receipts").insert({ request_id: requestId, user_id: userId, receipt_path: path, file_name: raw.name });
      if (error) {
        await supabase.storage.from("receipts").remove([path]);
        throw error;
      }
      toast.success("Comprovante de devolução enviado.");
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Comprovantes de devolução à empresa</h2>
      {editable && <>
        <input ref={input} type="file" accept="image/*,application/pdf" aria-label="Comprovante de devolução" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }} />
        <Button disabled={busy} variant="secondary" onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Enviando comprovante..." : "Enviar comprovante de devolução"}
        </Button>
      </>}
      {!receipts.length && <p className="text-sm text-muted-foreground">Nenhum comprovante enviado.</p>}
      <ul className="divide-y">
        {receipts.map((proof) => <li key={proof.id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold">{proof.file_name}</p>
            <p className="text-xs text-muted-foreground">Enviado em {new Date(proof.created_at).toLocaleString("pt-BR")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onView(proof.receipt_path)}><FileImage className="size-4" /> Ver comprovante</Button>
        </li>)}
      </ul>
    </section>
  );
}