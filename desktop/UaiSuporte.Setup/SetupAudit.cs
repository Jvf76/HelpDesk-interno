namespace UaiSuporte.Setup;

internal static class SetupAudit
{
    // Outside the transaction directory: diagnostics survive preflight failures and rollback.
    internal static string Path => System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "UaiTelecom", "SetupLogs", "setup-wizard.log");
    static readonly object Gate = new();
    internal static void Write(string code, Exception? error = null)
    {
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Path)!);
                if (File.Exists(Path) && new FileInfo(Path).Length > 1024 * 1024) File.Move(Path, Path + ".1", true);
                // Call sites pass constants only. Never serialize messages, requests, bodies or credentials.
                var detail = ErrorCodes(error);
                File.AppendAllText(Path, $"{DateTimeOffset.UtcNow:O} {code}{detail}\r\n");
            }
        }
        catch { /* A diagnostics failure must not prevent rollback. */ }
    }
    internal static string ErrorCodes(Exception? error)
    {
        var detail = "";
        for (var e = error; e != null; e = e.InnerException)
            detail += $" {e.GetType().Name}:0x{e.HResult:X8}" + (e is System.ComponentModel.Win32Exception w ? $":WIN32={w.NativeErrorCode}" : e is HttpRequestException h ? $":HTTP={(int?)h.StatusCode}:NETWORK={h.HttpRequestError}" : "");
        return detail;
    }
    internal static string Explain(Exception error)
    {
        var root = error.GetBaseException();
        if (root is HttpRequestException h) return h.HttpRequestError == HttpRequestError.SecureConnectionError
            ? "O certificado foi recusado. A TI deve verificar confiança, nomes e relógio; nenhuma validação foi desativada."
            : $"Falha de comunicação com o servidor (HTTP {(int?)h.StatusCode}). A TI deve verificar conexão e autorização de cadastro.";
        if (root is UnauthorizedAccessException) return "Verifique as permissões e se a elevação usou a mesma conta Windows.";
        if (root is InvalidDataException) return "Uma verificação de integridade, assinatura, configuração ou identidade foi recusada. Solicite revisão do pacote pela TI.";
        return "Consulte as etapas nos logs. Feche o aplicativo antes de instalar/remover. Se houver instalação anterior ou limpeza pendente, use seu desinstalador e reinicie antes de tentar novamente. Solicite recuperação à TI caso o código já tenha sido consumido.";
    }
}
