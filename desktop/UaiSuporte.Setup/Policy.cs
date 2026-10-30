using System.IO.Compression;
using System.Text.RegularExpressions;
namespace UaiSuporte.Setup;

internal static class Policy
{
    public static void RequireCommitted(string json) {
        try {
            using var doc=System.Text.Json.JsonDocument.Parse(json);var root=doc.RootElement;
            bool committed=root.GetProperty("Complete").GetBoolean();
            bool removed=root.TryGetProperty("Removed",out var r)&&r.GetBoolean();
            bool pending=root.TryGetProperty("RollbackPending",out var p)&&p.GetBoolean();
            if(!committed||removed||pending)throw new InvalidDataException("Instalação incompleta ou em reversão.");
        } catch(Exception e) when(e is System.Text.Json.JsonException or InvalidOperationException or KeyNotFoundException) {
            throw new InvalidDataException("Registro de instalação inválido.",e);
        }
    }

    public static void CheckMeshSettings(string text)
    {
        if (text.Length > 65536) throw new InvalidDataException("Configuração Mesh muito grande.");
        var entries = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in text.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0 || trimmed.StartsWith('#') || trimmed.StartsWith(';')) continue;
            var split = trimmed.IndexOf('=');
            if (split <= 0 || !entries.TryAdd(trimmed[..split].Trim(), trimmed[(split + 1)..].Trim()))
                throw new InvalidDataException("Configuração Mesh inválida ou com chaves duplicadas.");
        }
        if (!entries.TryGetValue("MeshServer", out var server) ||
            (server != "wss://mesh.internal/agent.ashx" && server != "wss://mesh.internal:443/agent.ashx") ||
            !entries.TryGetValue("ServerID", out var id) || !Regex.IsMatch(id, "\\A[0-9a-fA-F]{96}\\z"))
            throw new InvalidDataException("O MSH não corresponde ao servidor TLS do laboratório. Peça à TI o arquivo correto.");
        // Only settings emitted for a dedicated desktop agent; no alternate server/proxy or command hooks.
        string[] allowed = ["MeshServer", "ServerID", "MeshID", "MeshName", "MeshType"];
        if (entries.Keys.Any(k => !allowed.Contains(k, StringComparer.OrdinalIgnoreCase)))
            throw new InvalidDataException("O MSH contém opções adicionais. A TI deve revisar antes de instalar.");
        if (!entries.TryGetValue("MeshID", out var meshId) || string.IsNullOrWhiteSpace(meshId))
            throw new InvalidDataException("MSH sem identificação do grupo Mesh. Solicite o arquivo à TI.");
    }

    public static void Extract(Stream stream, string target)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        var root = Path.GetFullPath(target) + Path.DirectorySeparatorChar;
        foreach (var entry in archive.Entries)
        {
            var name = entry.FullName.Replace('\\', '/');
            if (name.StartsWith('/') || name.Contains(':') || name.Split('/').Any(x => x == ".." || x.EndsWith('.') || x.EndsWith(' ')))
                throw new InvalidDataException("Caminho inválido no pacote.");
            var output = Path.GetFullPath(Path.Combine(root, name));
            if (!output.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Arquivo fora do pacote.");
            if (name.EndsWith('/')) { Directory.CreateDirectory(output); continue; }
            Directory.CreateDirectory(Path.GetDirectoryName(output)!);
            using var source = entry.Open();
            using var file = new FileStream(output, FileMode.CreateNew, FileAccess.Write);
            source.CopyTo(file);
        }
    }
}
