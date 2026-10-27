type Reply = { id: string; status: number; body: string };
type WebViewBridge = {
  postMessage: (message: unknown) => void;
  addEventListener: (name: "message", handler: (event: MessageEvent<Reply>) => void) => void;
};
declare global { interface Window { chrome?: { webview?: WebViewBridge } } }
export const isDesktop = window.location.origin === "https://uai-technician.invalid" && !!window.chrome?.webview;
const pending = new Map<string, { resolve: (response: Response) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
if (isDesktop) window.chrome!.webview!.addEventListener("message", ({data}) => {
  const entry = pending.get(data.id);
  if (!entry) return;
  clearTimeout(entry.timer); pending.delete(data.id);
  entry.resolve(new Response(data.body || null, {status:data.status,headers:{"Content-Type":"application/json"}}));
});
export function desktopRequest(path: string, method: string, body: unknown, csrf: string): Promise<Response> {
  return new Promise((resolve,reject) => {
    if (pending.size >= 16) { reject(new Error("Muitas requisições em andamento. Aguarde.")); return; }
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {pending.delete(id);reject(new Error("Servidor indisponível ou sem resposta. Confira a conexão e tente novamente."));},20000);
    pending.set(id,{resolve,reject,timer});
    window.chrome!.webview!.postMessage({id,path,method,body:body??null,csrf});
  });
}
