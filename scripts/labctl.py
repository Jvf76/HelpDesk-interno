#!/usr/bin/env python3
"""Manage only the isolated Uai laboratory owned by the current user."""
import argparse, ipaddress, json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
LAB = ROOT / ".tools/lab"
def run(*args):
    subprocess.run(args, check=True)
p = argparse.ArgumentParser()
p.add_argument("action", choices=["start", "stop", "restart", "status", "allow", "block-external"])
p.add_argument("network", nargs="?")
a = p.parse_args()
if not (LAB / "manifest.json").exists():
    sys.exit("Laboratorio ainda nao provisionado.")
m = json.loads((LAB / "manifest.json").read_text())
if a.action in ("start", "stop", "restart"):
    units = ["uai-lab.target", "uai-lab-backend.service", "uai-lab-mesh.service", "uai-lab-web.service", "uai-lab-postgres.service"]
    if a.action in ("stop", "restart"):
        run("systemctl", "--user", "stop", *units)
    if a.action in ("start", "restart"):
        run("systemctl", "--user", "start", *units)
elif a.action == "status":
    run("systemctl", "--user", "--no-pager", "status", "uai-lab.target", "uai-lab-postgres", "uai-lab-backend", "uai-lab-mesh", "uai-lab-web")
else:
    if m.get("edge443_status") == "active":
        sys.exit("ACL da porta 443 gerenciada pelo root em /etc/nginx/uai-lab-443/allow.conf; veja docs/08-publicacao-443.md.")
    networks = []
    if a.action == "allow":
        if not a.network: sys.exit("Informe IP/CIDR de origem do Windows ou NAT/VPN.")
        network = ipaddress.ip_network(a.network, strict=False)
        if network.version != 4 or network.prefixlen < 16:
            sys.exit("Use origem IPv4 especifica (/16 ou menor conjunto), nunca internet inteira.")
        networks = m.get("allowed_clients", [])
        if str(network) not in networks: networks.append(str(network))
    rules = ["allow 127.0.0.1;", f"allow {m['ip']};"]
    rules += [f"allow {n};" for n in networks]
    rules += ["deny all;"]
    config = LAB / "nginx/allow.conf"
    old = config.read_text()
    config.write_text("\n".join(rules) + "\n")
    try:
        run("/usr/sbin/nginx", "-t", "-p", str(LAB / "nginx") + "/", "-c", str(LAB / "nginx/nginx.conf"))
        run("systemctl", "--user", "reload", "uai-lab-web")
    except subprocess.CalledProcessError:
        config.write_text(old)
        raise
    m["allowed_clients"] = networks
    (LAB / "manifest.json").write_text(json.dumps(m, indent=2) + "\n")
    print("Origens externas permitidas:", ", ".join(networks) or "nenhuma")
