using System.Text;
using System.Security.Cryptography;
namespace UaiSuporte.Setup;

internal static class LabPolicy
{
    public const string CaHash = "A1FFB98EB2364BB6EF0B30F5FD5AE61F1689FFFBA1CA6F1510641EAD624D7138";
    public const string CaName = "Uai Suporte LAB 131.0.112.23 2026-10-27";
    public const string Ip = "131.0.112.23";
    public static void CheckCaBytes(byte[] bytes)
    {
        if (Convert.ToHexString(SHA256.HashData(bytes)) != CaHash) throw new InvalidDataException("A CA incorporada não corresponde ao SHA-256 aprovado. Instalação bloqueada.");
    }
    public static (byte[] Result, string Block) AddHosts(byte[] original, string id)
    {
        // Work byte-for-byte, preserving all unrelated entries and their encoding/newlines.
        if (original.Contains((byte)0)) throw new InvalidDataException("Hosts em codificação inesperada. A TI deve revisar; nada será substituído.");
        var text = Encoding.Latin1.GetString(original);
        string[] targets = ["suporte.internal", "mesh.internal"];
        var missing = new HashSet<string>(targets, StringComparer.OrdinalIgnoreCase);
        foreach (var line in text.Split('\n'))
        {
            var parts = line.Split('#')[0].Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) continue;
            foreach (var host in parts.Skip(1))
                if (targets.Contains(host, StringComparer.OrdinalIgnoreCase))
                {
                    if (parts[0] != Ip) throw new InvalidDataException("Hosts já contém endereço diferente para " + host + ". A TI deve resolver o conflito; entrada existente preservada.");
                    missing.Remove(host);
                }
        }
        if (missing.Count == 0) return (original, "");
        if (!Guid.TryParseExact(id, "N", out _)) throw new InvalidDataException("Identificador de instalação inválido.");
        var block = "\r\n# BEGIN UAI-SUPORTE-LAB " + id + "\r\n" + Ip + " " + string.Join(' ', targets.Where(missing.Contains)) + "\r\n# END UAI-SUPORTE-LAB " + id + "\r\n";
        return (Encoding.Latin1.GetBytes(text + block), block);
    }
    public static byte[] RemoveHosts(byte[] original, string block)
    {
        if (block.Length == 0) return original;
        var text = Encoding.Latin1.GetString(original);
        var first = text.IndexOf(block, StringComparison.Ordinal);
        if (first < 0 || text.IndexOf(block, first + block.Length, StringComparison.Ordinal) >= 0)
            throw new InvalidDataException("O bloco hosts da instalação foi alterado ou removido externamente. Remoção automática suspensa para revisão; outras linhas preservadas.");
        return Encoding.Latin1.GetBytes(text.Remove(first, block.Length));
    }
}
