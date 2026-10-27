using System.Net;
using System.Security.Authentication;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
namespace UaiSuporte.Transport;

public record ApiReply(int Status, string Body);
public sealed class ApiSession : IDisposable
{
    public const string LocalOrigin = "https://uai-technician.invalid";
    public const string ServerOrigin = "https://suporte.internal";
    readonly HttpClient http;
    readonly SemaphoreSlim gate = new(1);
    public ApiSession(HttpMessageHandler? testHandler = null)
    {
        http = new HttpClient(testHandler ?? new HttpClientHandler {
            AllowAutoRedirect = false, UseCookies = true, CookieContainer = new CookieContainer()
        }) { BaseAddress = new Uri(ServerOrigin), Timeout = TimeSpan.FromSeconds(12) };
    }
    public static bool TrustedSource(string source) => Uri.TryCreate(source, UriKind.Absolute, out var uri)
        && uri.GetLeftPart(UriPartial.Authority) == LocalOrigin && uri.AbsolutePath == "/index.html"
        && uri.Query.Length == 0 && uri.UserInfo.Length == 0;
    public static bool Allowed(string method, string path)
    {
        // No arbitrary URL, headers, redirects, agents or remote launch in this proof.
        if (!Regex.IsMatch(path, @"^/[a-zA-Z0-9/-]+$")) return false;
        var id = @"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
        return method switch {
            "GET" => Regex.IsMatch(path, $@"^/(auth/me|users|devices|tickets|(?:devices|tickets|sessions)/{id}|devices/{id}/(?:history|permissions))$"),
            "POST" => Regex.IsMatch(path, $@"^/(auth/(?:login|logout)|users|devices|tickets|devices/{id}/(?:enrollment|revoke)|tickets/{id}/comments|sessions/{id}/stop)$"),
            "PUT" => Regex.IsMatch(path, $@"^/((?:users|devices|tickets)/{id}|devices/{id}/permissions)$"),
            "DELETE" => Regex.IsMatch(path, $@"^/devices/{id}/permissions/{id}$"),
            _ => false
        };
    }
    public async Task<ApiReply> Send(string source, string path, string method, string? body, string? csrf)
    {
        if (!TrustedSource(source) || !Allowed(method,path) || (body?.Length ?? 0)>131072)
            return Error(403,"Operação não autorizada neste aplicativo.");
        if (method != "GET" && path != "/auth/login" && string.IsNullOrWhiteSpace(csrf))
            return Error(403,"Proteção CSRF: sessão inválida. Entre novamente.");
        await gate.WaitAsync();
        try {
            using var request = new HttpRequestMessage(new HttpMethod(method), "/api"+path);
            if (body != null) {
                using var parsed = JsonDocument.Parse(body);
                request.Content = new StringContent(body,Encoding.UTF8,"application/json");
            }
            if (csrf != null) request.Headers.Add("X-CSRF-Token",csrf);
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if ((int)response.StatusCode is >=300 and <400) return Error(502,"Redirecionamento da API bloqueado.");
            if (response.Content.Headers.ContentLength > 4*1024*1024) return Error(502,"Resposta excede o limite do aplicativo.");
            await response.Content.LoadIntoBufferAsync(4*1024*1024);
            string content = await response.Content.ReadAsStringAsync();
            if (content.Length>0) {
                // Remote HTML/code is never passed to the renderer.
                if (response.Content.Headers.ContentType?.MediaType != "application/json")
                    return Error((int)response.StatusCode == 403 ? 403 : 502,"A API recusou a requisição ou retornou formato inesperado. Confira a origem autorizada.");
                using var parsed = JsonDocument.Parse(content);
            }
            return new((int)response.StatusCode,content);
        }
        catch (HttpRequestException e) when (e.HttpRequestError == HttpRequestError.SecureConnectionError || e.InnerException is AuthenticationException) {
            return Error(495,"Certificado TLS não confiável, vencido ou incompatível com o servidor. Confira a CA do laboratório, o nome e a data do Windows. A conexão foi bloqueada.");
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or IOException) {
            return Error(503,"Servidor indisponível. Confira a rede, VPN e acesso a suporte.internal:443. A interface local continua disponível.");
        }
        catch (Exception e) when (e is JsonException or FormatException) { return Error(502,"Resposta ou requisição inválida."); }
        finally { gate.Release(); }
    }
    public static ApiReply Error(int status,string message) => new(status,JsonSerializer.Serialize(new {message}));
    public void Dispose() => http.Dispose();
}
