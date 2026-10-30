namespace UaiSuporte.Setup;
internal static class InnoRequest
{
 internal static bool Validate(string[] lines) {
  if(lines.Length!=3||lines[0]!="CA_ACCEPTED"||lines[1]!="TERMS_ACCEPTED"||(lines[2]!="HOSTS_YES"&&lines[2]!="HOSTS_NO"))throw new InvalidDataException("Configuração de instalação inválida.");
  return lines[2]=="HOSTS_YES";
 }
}
