using System.Net.Http.Json;
using UaiSuporte.Printers;

namespace UaiSuporte.Service;

static class PrinterQueue {
    sealed record Job(Guid Id,string Serial);
    internal static async Task Poll(HttpClient http,CancellationToken ct) {
        try {
            var jobs=await http.GetFromJsonAsync<Job[]>("api/desktop/printer-jobs",ct);
            if(jobs is not {Length:>0}) return;
            var job=jobs[0];
            byte[] pdf=[];
            var directory=Path.Combine(UaiSuporte.Agent.DeviceStore.Root,"printer-work",job.Id.ToString("N"));
            try {
                if(job.Serial==LexmarkReport.Serial)
                    pdf=LexmarkReport.Pdf(await LexmarkReport.Collect(directory,ct));
            } catch(Exception) when(!ct.IsCancellationRequested) {
                // Empty result marks this collection as failed.
            } finally {
                if(Directory.Exists(directory)) Directory.Delete(directory,true);
            }
            using var body=new ByteArrayContent(pdf);
            using var result=await http.PostAsync($"api/desktop/printer-jobs/{job.Id}",body,ct);
            result.EnsureSuccessStatusCode();
        } catch(Exception) when(!ct.IsCancellationRequested) {
            // Printer polling is independent of the remote support lifecycle.
        }
    }
}
