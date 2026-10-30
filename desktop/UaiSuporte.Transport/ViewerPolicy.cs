namespace UaiSuporte.Transport;
public static class ViewerPolicy {
 public const string Page="https://mesh.internal/uai-viewer/index.html";
 public static bool Navigation(string value)=>value==Page;
 public static bool Relay(string value)=>Uri.TryCreate(value,UriKind.Absolute,out var u)&&u.Scheme=="wss"&&u.Host=="mesh.internal"&&u.Port==443&&u.UserInfo.Length==0&&u.AbsolutePath=="/meshrelay.ashx";
 public static bool Asset(string value)=>Uri.TryCreate(value,UriKind.Absolute,out var u)&&u.Scheme=="https"&&u.Host=="mesh.internal"&&u.Port==443&&u.UserInfo.Length==0&&u.Query.Length==0&&u.AbsolutePath.StartsWith("/uai-viewer/")&&!Uri.UnescapeDataString(u.AbsolutePath).Contains("..")&&!u.AbsolutePath.Contains('%');
}
