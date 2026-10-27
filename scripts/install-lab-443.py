#!/usr/bin/env python3
"""Prepare isolated vhosts or install them with root privileges. Never replaces existing sites."""
import argparse, datetime, ipaddress, json, os, pathlib, pwd, shutil, subprocess, sys, time
ROOT = pathlib.Path(__file__).resolve().parents[1]
LAB = ROOT / ".tools/lab"
NAME = "zz-uai-lab-443.conf"
def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)
def config(directory, listen="443"):
    d = str(directory)
    blocks = ["map $http_upgrade $uai443_upgrade { default upgrade; '' close; }",
              "log_format uai443_safe '$remote_addr $request_method $uri $status';"]
    for host, port in [("suporte.internal",18443),("mesh.internal",14433)]:
        blocks.append(f'''server {{
 listen {listen} ssl;
 server_name {host};
 ssl_certificate "{d}/server.crt";
 ssl_certificate_key "{d}/server.key";
 ssl_protocols TLSv1.2 TLSv1.3;
 ssl_session_tickets off;
 include "{d}/allow.conf";
 access_log "{d}/access.log" uai443_safe;
 error_log "{d}/error.log" warn;
 location / {{
  proxy_pass https://127.0.0.1:{port};
  proxy_ssl_server_name on;
  proxy_ssl_name {host};
  proxy_ssl_verify on;
  proxy_ssl_trusted_certificate "{d}/lab-ca.crt";
  proxy_set_header Host $http_host;
  proxy_set_header X-Forwarded-Proto https;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $uai443_upgrade;
  proxy_buffering off;
  proxy_read_timeout 120s;
 }}
}}''')
    return "\n".join(blocks)+"\n"
def files(directory, sources):
    directory.mkdir(mode=0o755)
    for src, dest in [("tls/server.crt","server.crt"),("secrets/server.key","server.key"),("tls/lab-ca.crt","lab-ca.crt")]:
        shutil.copyfile(LAB/src,directory/dest)
        (directory/dest).chmod(0o600 if dest=="server.key" else 0o644)
    (directory/"allow.conf").write_text("allow 127.0.0.1;\n"+"".join(f"allow {s};\n" for s in sources)+"deny all;\n")
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source",required=True,help="Public IPv4 address/CIDR authorized by Uai")
    p.add_argument("--preview",action="store_true")
    a=p.parse_args()
    network=ipaddress.ip_network(a.source,strict=False)
    if network.version!=4 or network.prefixlen<24: sys.exit("Use IPv4 /24 ou mais restrito.")
    if a.preview:
        d=LAB/"edge443-preview"
        if d.exists(): sys.exit("Preview ja existe; preserve ou remova antes de gerar novamente.")
        files(d,[str(network)])
        (d/"vhosts.conf").write_text(config(d,"127.0.0.1:19443"))
        (d/"nginx.conf").write_text(f'pid "{d}/nginx.pid";\nerror_log "{d}/error.log";\nevents {{}}\nhttp {{\nproxy_temp_path "{d}/proxy";\nclient_body_temp_path "{d}/body";\ninclude "{d}/vhosts.conf";\n}}\n')
        print(d/"nginx.conf")
        return
    if os.geteuid()!=0: sys.exit("Execute com sudo no terminal da VM; privilegio necessario para /etc/nginx e reload.")
    d=pathlib.Path("/etc/nginx/uai-lab-443")
    site=pathlib.Path("/etc/nginx/sites-available")/NAME
    link=pathlib.Path("/etc/nginx/sites-enabled")/NAME
    if any(x.exists() or x.is_symlink() for x in (d,site,link)): sys.exit("Destino existente; recusando sobrescrever. Consulte docs/08-publicacao-443.md.")
    run("/usr/sbin/nginx","-t")
    # Back up the complete configuration, preserving symbolic links and private permissions.
    backup=pathlib.Path("/var/backups/uai-lab-443")/datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup.mkdir(parents=True,mode=0o700)
    backup.parent.chmod(0o700)
    shutil.copytree("/etc/nginx",backup/"nginx",symlinks=True)
    owner=pwd.getpwuid(LAB.stat().st_uid)
    env={**os.environ,"XDG_RUNTIME_DIR":f"/run/user/{owner.pw_uid}","DBUS_SESSION_BUS_ADDRESS":f"unix:path=/run/user/{owner.pw_uid}/bus"}
    def user(*args):
        return run("runuser","-u",owner.pw_name,"--",*args,env=env)
    runtime=[LAB/"mesh-data/config.json",LAB/"secrets/backend.env",LAB/"manifest.json"]
    old={f:f.read_bytes() for f in runtime}
    import re
    labconfig=(LAB/"nginx/nginx.conf").read_text()
    for addr in re.findall(r"listen\s+([^;]+);",labconfig):
        if ("18443" in addr or "14433" in addr) and not addr.startswith("127.0.0.1:"):
            sys.exit("Listener interno ainda exposto: "+addr)
    meshpid=subprocess.check_output(["runuser","-u",owner.pw_name,"--","systemctl","--user","show","uai-lab-mesh","-p","MainPID","--value"],env=env,text=True).strip()
    node=str((pathlib.Path("/proc")/meshpid/"exe").resolve(strict=True))
    for i,(f,data) in enumerate(old.items()):
        target=backup/f"runtime-{i}"
        target.write_bytes(data); target.chmod(0o600)
    pid=pathlib.Path("/run/nginx.pid").read_text()
    try:
        files(d,[str(network)])
        site.write_text(config(d))
        link.symlink_to(site)
        run("/usr/sbin/nginx","-t")
        run("systemctl","reload","nginx")
        if pathlib.Path("/run/nginx.pid").read_text()!=pid: raise RuntimeError("PID mestre alterado inesperadamente")
        mesh=json.loads(runtime[0].read_text())
        mesh["settings"]["aliasPort"]=443
        runtime[0].write_text(json.dumps(mesh,indent=2)+"\n")
        import re
        text=runtime[1].read_text()
        text,count=re.subn(r"(?m)^MESH_URL=.*$", "MESH_URL=https://mesh.internal:443",text)
        if count!=1: raise RuntimeError("MESH_URL ausente ou duplicada")
        runtime[1].write_text(text)
        manifest=json.loads(runtime[2].read_text())
        manifest.update(panel_url="https://suporte.internal:443",mesh_url="https://mesh.internal:443",allowed_clients=[str(network)],edge443_status="active")
        runtime[2].write_text(json.dumps(manifest,indent=2)+"\n")
        user("systemctl","--user","restart","uai-lab-mesh","uai-lab-backend")
        for attempt in range(12):
            time.sleep(5)
            try:
                user("/usr/bin/python3",str(ROOT/"scripts/verify-lab.py"))
                user(node,str(ROOT/"scripts/verify-lab-wss.cjs"))
                break
            except subprocess.CalledProcessError:
                if attempt==11: raise
        print("Instalado e verificado localmente. Backup:",backup)
        print("Conectividade Windows ainda precisa ser validada. Origem autorizada:",network)
    except BaseException:
        for f,data in old.items(): f.write_bytes(data)
        if link.is_symlink(): link.unlink()
        if site.exists(): site.unlink()
        run("/usr/sbin/nginx","-t")
        run("systemctl","reload","nginx")
        user("systemctl","--user","restart","uai-lab-mesh","uai-lab-backend")
        # Preserve failed deployment files for diagnosis; never touch other vhosts.
        print("Rollback aplicado; arquivos de diagnostico preservados em",d,file=sys.stderr)
        raise
if __name__=="__main__": main()
