using System.Text.Json;
namespace UaiSuporte.App;
static class UiData {
 public static readonly string Root=Locate();
 static string Locate(){
  string state=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"UaiTelecom","UaiSuporte","install-state.json");
  using var doc=JsonDocument.Parse(File.ReadAllText(state));string id=doc.RootElement.GetProperty("Id").GetString()??"";
  if(!Guid.TryParseExact(id,"N",out _))throw new InvalidDataException("Registro da instalação inválido.");
  return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"UaiTelecom","UaiSuporte","Ui",id);
 }
}
