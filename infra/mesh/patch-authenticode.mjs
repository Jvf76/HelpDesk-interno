// Preserve UTF-16LE bytes before swapping to the BMPString's big-endian order.
// Default Buffer.toString() decodes UTF-8, replacing non-ASCII bytes and corrupting DER.
import fs from 'node:fs';
const file = new URL('./node_modules/meshcentral/authenticode.js', import.meta.url);
let source = fs.readFileSync(file, 'utf8');
const before = "Buffer.from(args.desc, 'ucs2').toString()";
const after = "Buffer.from(args.desc, 'ucs2').toString('binary')";
if (source.split(before).length === 3) {
  source = source.replaceAll(before, after);
  fs.writeFileSync(file, source);
} else if (source.split(after).length !== 3) {
  throw Error('Unexpected Authenticode UTF-16 anchors; review upstream before signing.');
}
console.log('Uai: Authenticode description preserves UTF-16 bytes; ASN.1/timestamp checks unchanged.');
