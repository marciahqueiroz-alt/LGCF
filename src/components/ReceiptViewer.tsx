import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ReceiptViewer({ path, onClose, title = "Recibo da despesa" }: { path: string | null; onClose: () => void; title?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [file, setFile] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const isPdf = file?.blob.type === "application/pdf" || path?.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!path) return;
    let active = true;
    let objectUrl: string | undefined;
    setFile(null); setError(""); setBusy(true); setPage(1); setPages(1);
    void supabase.storage.from("receipts").download(path).then(({ data, error: downloadError }) => {
      if (!active) return;
      if (downloadError || !data) { setError("Não foi possível carregar o recibo. Tente novamente."); setBusy(false); return; }
      objectUrl = URL.createObjectURL(data);
      setFile({ blob: data, url: objectUrl });
      setBusy(false);
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);

  useEffect(() => {
    if (!file || !isPdf) return;
    let active = true;
    let cancel: (() => void) | undefined;
    setBusy(true);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const loading = pdfjs.getDocument({ data: new Uint8Array(await file.blob.arrayBuffer()) });
        cancel = () => { void loading.destroy(); };
        const document = await loading.promise;
        if (!active) { await loading.destroy(); return; }
        setPages(document.numPages);
        const pdfPage = await document.getPage(page);
        if (!active || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: 1.5 });
        const element = canvas.current;
        element.width = viewport.width; element.height = viewport.height;
        const canvasContext = element.getContext("2d");
        if (!canvasContext) throw new Error("Canvas indisponível");
        await pdfPage.render({ canvasContext, viewport }).promise;
      } catch (error) {
        console.error("Receipt PDF rendering failed", error);
        if (active) setError("Não foi possível exibir o PDF. Você ainda pode baixá-lo.");
      } finally { if (active) setBusy(false); }
    })();
    return () => { active = false; cancel?.(); };
  }, [file, isPdf, page]);

  return <Dialog open={!!path} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy && <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando recibo...</div>}
      {file && (isPdf ? <canvas ref={canvas} aria-label={`Página ${page} do recibo`} className="h-auto w-full" /> : <img src={file.url} alt={title} className="max-h-[65dvh] w-full object-contain" />)}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {file && <Button asChild variant="outline" size="sm"><a href={file.url} download={path?.split("/").pop() ?? "recibo"}><Download className="size-4" /> Baixar recibo</a></Button>}
        {isPdf && pages > 1 && <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" title="Página anterior" disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
          <span className="text-sm">{page} / {pages}</span>
          <Button size="icon" variant="outline" title="Próxima página" disabled={page >= pages || busy} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
        </div>}
      </div>
    </DialogContent>
  </Dialog>;
}