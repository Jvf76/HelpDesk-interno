#!/usr/bin/env python3
"""Renew only the LAB code-signing CRL; never install or sign an executable."""
from pathlib import Path
import os
import subprocess
import tempfile


def main():
    os.umask(0o077)
    root = Path(__file__).resolve().parents[1] / '.tools/lab'
    config = root / 'secrets/codesign-lab/openssl.cnf'
    if not config.is_file():
        raise SystemExit('Emissor LAB não configurado; nenhuma CA será criada.')
    public = root / 'www/pki/uai-lab-codesign.crl'
    if not public.is_file():
        raise SystemExit('CRL pública existente não encontrada; confira o laboratório.')
    with tempfile.TemporaryDirectory(dir=root / 'tls') as tmp:
        pem, der = Path(tmp) / 'crl.pem', Path(tmp) / 'crl.der'
        subprocess.run(['openssl', 'ca', '-gencrl', '-config', str(config), '-out', str(pem)], check=True)
        subprocess.run(['openssl', 'crl', '-in', str(pem), '-verify', '-CAfile', str(root / 'tls/lab-ca.crt'), '-noout'], check=True)
        subprocess.run(['openssl', 'crl', '-in', str(pem), '-outform', 'DER', '-out', str(der)], check=True)
        # Temp directory is on the same filesystem. Readers see the complete old or new CRL.
        der.chmod(0o644)
        os.replace(der, public)
        os.replace(pem, root / 'tls/codesign-lab.crl.pem')
    print('CRL LAB renovada. Confira o acesso HTTPS e a data nextUpdate.')


if __name__ == '__main__':
    main()
