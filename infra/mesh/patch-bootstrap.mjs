// Uai Telecom modification: keep MeshCentral 1.3.1's runtime installer aligned
// with the audited dependency overrides. No changes to cryptography or protocol.
import fs from 'node:fs';
const packagePath=new URL('./node_modules/meshcentral/package.json',import.meta.url);
if(JSON.parse(fs.readFileSync(packagePath)).version!=='1.3.1')throw new Error('Revisar patch ao mudar versão MeshCentral.');
const path=new URL('./node_modules/meshcentral/meshcentral.js',import.meta.url);
let source=fs.readFileSync(path,'utf8');
const marker='// Modified by Uai Telecom: bootstrap dependency versions aligned with package-lock (2026-10-26).\n';
if(!source.startsWith(marker)){
 for(const [oldVersion,newVersion] of [['compression@1.8.1','compression@1.8.2'],['express@4.22.2','express@4.22.3'],['node-forge@1.4.0','node-forge@1.4.1']]){
  if(source.split(oldVersion).length!==2)throw new Error('Formato inesperado do bootstrap; revisão manual obrigatória.');
  source=source.replace(oldVersion,newVersion);
 }
 fs.writeFileSync(path,marker+source);
}
console.log('MeshCentral 1.3.1: versões do bootstrap alinhadas. node-forge 1.4.1.');
