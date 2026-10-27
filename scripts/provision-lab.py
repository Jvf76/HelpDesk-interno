#!/usr/bin/env python3
"""One-time isolated Linux lab setup. Does not change existing services or /etc."""
import argparse, datetime, ipaddress, json, os, pathlib, secrets, shutil, socket, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
LAB = ROOT / ".tools/lab"
p = argparse.ArgumentParser()
p.add_argument("--ip", required=True)
a = p.parse_args()
ip = str(ipaddress.IPv4Address(a.ip))
if LAB.exists(): raise SystemExit("Laboratorio ja existe. Use labctl; nao sobrescrever dados.")
for port in [18443, 14433, 14434, 18080, 55433]:
    with socket.socket() as s: s.bind(("0.0.0.0", port))
os.umask(0o077)
LAB.mkdir(parents=True, mode=0o700)
for d in ["secrets", "tls", "logs", "app", "www/lab", "mesh-data", "mesh-runtime", "nginx", "socket"]:
    (LAB / d).mkdir(parents=True, mode=0o700, exist_ok=True)
def write(path, text):
    dest = LAB / path
    dest.write_text(text)
def run(*args, data=None):
    result = subprocess.run([str(v) for v in args], input=data, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    with (LAB / "logs/provision.log").open("a") as f: f.write(result.stdout)
    if result.returncode: raise SystemExit("Provisionamento falhou; detalhes no log privado do laboratorio.")
human = {name: {"login": login, "password": secrets.token_urlsafe(27)} for name, login in [("panel", "admin-lab"), ("mesh", "mesh-admin-lab")]}
machine_secrets = {name: secrets.token_urlsafe(32) for name in ["database_password", "mesh_password"]}
machine_secrets["mesh_user"] = "uai-integration"
write("secrets/admin-access.json", json.dumps(human, indent=2) + "\n")
write("secrets/service-secrets.json", json.dumps(machine_secrets, indent=2) + "\n")
write("manifest.json", json.dumps({"ip": ip, "panel_url":"https://suporte.internal:18443", "mesh_url":"https://mesh.internal:14433", "allowed_clients":[]}, indent=2)+"\n")
# Dedicated TLS CA; never install it globally in the VM.
day = datetime.date.today().isoformat()
ca = LAB / "tls/lab-ca.crt"
key = LAB / "secrets/lab-ca.key"
run("openssl", "req", "-x509", "-newkey", "rsa:3072", "-nodes", "-sha256", "-days", "365",
    "-subj", f"/CN=Uai Suporte LAB {ip} {day}/O=Uai Telecom Laboratory",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0", "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-keyout", key, "-out", ca)
leaf = LAB / "tls/server.crt"
leafkey = LAB / "secrets/server.key"
run("openssl", "req", "-new", "-newkey", "rsa:3072", "-nodes", "-subj", "/CN=mesh.internal/O=Uai Telecom Laboratory",
    "-keyout", leafkey, "-out", LAB / "tls/server.csr")
write("tls/server.ext", f"basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:mesh.internal,DNS:suporte.internal,DNS:localhost,IP:127.0.0.1,IP:{ip}\n")
run("openssl", "x509", "-req", "-in", LAB / "tls/server.csr", "-CA", ca, "-CAkey", key, "-CAcreateserial",
    "-days", "90", "-sha256", "-extfile", LAB / "tls/server.ext", "-out", leaf)
run("openssl", "verify", "-CAfile", ca, leaf)
for src, dest in [(leaf,"webserver-cert-public.crt"), (leafkey,"webserver-cert-private.key"), (ca,"webserver-cert-chain1.crt")]:
    shutil.copy2(src, LAB / "mesh-data" / dest)
shutil.copytree(ROOT / "infra/mesh/node_modules", LAB / "mesh-runtime/node_modules")
config = json.loads((ROOT / "infra/mesh/config.example.json").read_text())
config["settings"].update({"port":14434,"aliasPort":14433,"portBind":"127.0.0.1","exactPorts":True,"trustedProxy":"127.0.0.1"})
write("mesh-data/config.json", json.dumps(config, indent=2)+"\n")
# Separate runtime snapshots; later builds do not overwrite running artifacts.
shutil.copy2(ROOT / "backend/target/uai-suporte-0.1.0.jar", LAB / "app/backend.jar")
shutil.copytree(ROOT / "frontend/dist", LAB / "www", dirs_exist_ok=True)
shutil.copy2(ca, LAB / "www/lab/lab-ca.crt")
shutil.copy2(ROOT / "scripts/Test-UaiConnection.ps1", LAB / "www/lab/Test-UaiConnection.ps1")
write("hosts", "127.0.0.1 localhost suporte.internal mesh.internal\n::1 localhost\n")
java = ROOT / ".tools/java"
run(java / "bin/keytool", "-importcert", "-noprompt", "-alias", "uai-lab-tls", "-file", ca,
    "-keystore", LAB / "tls/truststore.p12", "-storepass", "changeit")
# Dedicated cluster, private Unix socket and SCRAM host authentication.
run("/usr/lib/postgresql/16/bin/initdb", "-D", LAB / "pgdata", "--auth-local=peer", "--auth-host=scram-sha-256", "-U", os.environ["USER"], "--encoding=UTF8")
with (LAB / "pgdata/postgresql.conf").open("a") as f:
    f.write(f"\nlisten_addresses = '127.0.0.1'\nport = 55433\nunix_socket_directories = '{LAB / 'socket'}'\nshared_buffers = '128MB'\nmax_connections = 30\npassword_encryption = 'scram-sha-256'\n")
write("pgdata/pg_hba.conf", f"local all {os.environ['USER']} peer\nhost uai_lab uai_lab 127.0.0.1/32 scram-sha-256\nhost all all 127.0.0.1/32 reject\n")
# No passwords in OS command arguments. Admin CLI wrapper sets in-process argv only.
meshentry = LAB / "mesh-runtime/node_modules/meshcentral/meshcentral.js"
write("bootstrap-mesh.cjs", """const fs=require('fs'),path=require('path');
const base=__dirname, human=JSON.parse(fs.readFileSync(path.join(base,'secrets/admin-access.json')));
const service=JSON.parse(fs.readFileSync(path.join(base,'secrets/service-secrets.json')));
const entry=path.join(base,'mesh-runtime/node_modules/meshcentral/meshcentral.js');
let args;
switch(process.argv[2]){
case 'admin': args=['--createaccount',human.mesh.login,'--pass',human.mesh.password];break;
case 'integration':args=['--createaccount',service.mesh_user,'--pass',service.mesh_password];break;
case 'promote':args=['--adminaccount',human.mesh.login];break;
default:throw Error('Invalid provision action');
}
process.argv=[process.execPath,entry,'--datapath',path.join(base,'mesh-data'),...args];
require(entry).mainStart();
""")
# Backend reads an owner-only EnvironmentFile; bootstrap is removed after verification.
env = {"DATABASE_URL":"jdbc:postgresql://127.0.0.1:55433/uai_lab","POSTGRES_USER":"uai_lab",
       "POSTGRES_PASSWORD":machine_secrets["database_password"],"BOOTSTRAP_LOGIN":human["panel"]["login"],
       "BOOTSTRAP_PASSWORD":human["panel"]["password"],"BIND_ADDRESS":"127.0.0.1","SERVER_PORT":"18080",
       "SECURE_COOKIE":"true","MESH_ENABLED":"true","MESH_URL":"https://mesh.internal:14433",
       "MESH_USER":machine_secrets["mesh_user"],"MESH_PASSWORD":machine_secrets["mesh_password"]}
write("secrets/backend.env", "".join(f'{k}={v}\n' for k,v in env.items()))
write("nginx/allow.conf", f"allow 127.0.0.1;\nallow {ip};\ndeny all;\n")
# Same TLS leaf at edge and Mesh: no mismatch in MeshAgent's server certificate pin.
write("nginx/nginx.conf", f"""worker_processes 1;
pid "{LAB}/nginx/nginx.pid";
error_log "{LAB}/logs/nginx-error.log" warn;
events {{ worker_connections 256; }}
http {{
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  log_format safe '$remote_addr $request_method $uri $status';
  access_log "{LAB}/logs/nginx-access.log" safe;
  client_body_temp_path "{LAB}/nginx/body";
  proxy_temp_path "{LAB}/nginx/proxy";
  fastcgi_temp_path "{LAB}/nginx/fastcgi";
  uwsgi_temp_path "{LAB}/nginx/uwsgi";
  scgi_temp_path "{LAB}/nginx/scgi";
  map $http_upgrade $connection_upgrade {{ default upgrade; '' close; }}
  ssl_certificate "{leaf}";
  ssl_certificate_key "{leafkey}";
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_tickets off;
  server {{
    listen {ip}:18443 ssl;
    listen 127.0.0.1:18443 ssl;
    server_name suporte.internal;
    include "{LAB}/nginx/allow.conf";
    root "{LAB}/www";
    add_header X-Content-Type-Options nosniff always;
    location /api/ {{
      proxy_pass http://127.0.0.1:18080;
      proxy_set_header Host $http_host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-For $remote_addr;
    }}
    location /lab/ {{ try_files $uri =404; }}
    location / {{ try_files $uri $uri/ /index.html; }}
  }}
  server {{
    listen {ip}:14433 ssl;
    listen 127.0.0.1:14433 ssl;
    server_name mesh.internal;
    include "{LAB}/nginx/allow.conf";
    location / {{
      proxy_pass https://127.0.0.1:14434;
      proxy_ssl_server_name on;
      proxy_ssl_name mesh.internal;
      proxy_ssl_verify on;
      proxy_ssl_trusted_certificate "{ca}";
      proxy_set_header Host $http_host;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_buffering off;
      proxy_read_timeout 120s;
    }}
  }}
}}
""")
unitdir = pathlib.Path.home() / ".config/systemd/user"
unitdir.mkdir(parents=True, exist_ok=True)
def unit(name, body):
    target = unitdir / name
    if target.exists(): raise SystemExit("Unit preexistente; nao sobrescrever: "+name)
    target.write_text(body)
unit("uai-lab.target", """[Unit]
Description=Uai Suporte - laboratorio isolado
Wants=uai-lab-postgres.service uai-lab-mesh.service uai-lab-backend.service uai-lab-web.service
[Install]
WantedBy=default.target
""")
def service(name, description, body, after=""):
    unit(f"uai-lab-{name}.service", f"""[Unit]
Description={description}
PartOf=uai-lab.target
{after}
[Service]
UMask=0077
NoNewPrivileges=true
Restart=on-failure
RestartSec=5
{body}
""")
service("postgres", "Uai Lab PostgreSQL exclusivo", f"""Type=forking
PIDFile={LAB}/pgdata/postmaster.pid
ExecStart=/usr/lib/postgresql/16/bin/pg_ctl -D "{LAB}/pgdata" -l "{LAB}/logs/postgres.log" -w start
ExecStop=/usr/lib/postgresql/16/bin/pg_ctl -D "{LAB}/pgdata" -m fast -w stop
TimeoutStopSec=60
""")
node = shutil.which("node")
service("mesh", "Uai Lab MeshCentral", f"""WorkingDirectory={LAB}/mesh-runtime
Environment=NODE_OPTIONS=--max-old-space-size=384
ExecStart="{node}" "{meshentry}" --datapath "{LAB}/mesh-data"
""")
service("backend", "Uai Lab Spring Boot", f"""WorkingDirectory={LAB}
EnvironmentFile={LAB}/secrets/backend.env
ExecStart="{java}/bin/java" -Xms64m -Xmx512m "-Djdk.net.hosts.file={LAB}/hosts" "-Djavax.net.ssl.trustStore={LAB}/tls/truststore.p12" -Djavax.net.ssl.trustStorePassword=changeit -jar "{LAB}/app/backend.jar"
""", "Requires=uai-lab-postgres.service\nAfter=uai-lab-postgres.service uai-lab-web.service")
service("web", "Uai Lab Nginx independente", f"""Type=forking
PIDFile={LAB}/nginx/nginx.pid
ExecStartPre=/usr/sbin/nginx -t -p "{LAB}/nginx/" -c "{LAB}/nginx/nginx.conf"
ExecStart=/usr/sbin/nginx -p "{LAB}/nginx/" -c "{LAB}/nginx/nginx.conf"
ExecReload=/usr/sbin/nginx -p "{LAB}/nginx/" -c "{LAB}/nginx/nginx.conf" -s reload
ExecStop=/usr/sbin/nginx -p "{LAB}/nginx/" -c "{LAB}/nginx/nginx.conf" -s quit
""")
run("systemctl","--user","daemon-reload")
run("systemctl","--user","start","uai-lab-postgres")
# Only the dedicated cluster accepts this private socket.
sql = f"CREATE ROLE uai_lab LOGIN PASSWORD '{machine_secrets['database_password']}';\nCREATE DATABASE uai_lab OWNER uai_lab;\n"
dbsetup = subprocess.run(["/usr/bin/psql", "-h", str(LAB / "socket"), "-p", "55433", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
                         input=sql, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if dbsetup.returncode: raise SystemExit("Falha ao criar banco isolado; nenhum segredo foi registrado.")
for action in ["admin", "integration", "promote"]:
    run(node, LAB / "bootstrap-mesh.cjs", action)
run("systemctl", "--user", "enable", "uai-lab.target")
run("systemctl", "--user", "start", "uai-lab.target")
print("Laboratorio iniciado. Origens externas bloqueadas. Validar com os scripts de teste.")
