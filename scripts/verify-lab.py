#!/usr/bin/env python3
"""Live checks on the isolated VM lab. Prints no credentials/cookies/tokens."""
import os, http.cookiejar, json, pathlib, socket, ssl, urllib.error, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
LAB=ROOT/".tools/lab"
real_dns=socket.getaddrinfo
def lab_dns(host,*args,**kwargs):
    return real_dns("127.0.0.1" if host in ("suporte.internal","mesh.internal") else host,*args,**kwargs)
socket.getaddrinfo=lab_dns
context=ssl.create_default_context(cafile=str(LAB/"tls/lab-ca.crt"))
cookies=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=context),urllib.request.HTTPCookieProcessor(cookies))
def call(url,body=None,csrf=None):
    headers={}
    if body is not None: headers["Content-Type"]="application/json"
    if csrf: headers["X-CSRF-Token"]=csrf
    req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,headers=headers)
    try:
        with opener.open(req,timeout=10) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
manifest=json.loads((LAB/"manifest.json").read_text())
panel=os.environ.get("UAI_TEST_PANEL_URL",manifest["panel_url"])
mesh=os.environ.get("UAI_TEST_MESH_URL",manifest["mesh_url"])
assert call(panel+"/")[0]==200
assert call(mesh+"/")[0]==200
assert call(panel+"/api/auth/me")[0]==401
credentials=json.loads((LAB/"secrets/admin-access.json").read_text())["panel"]
status,body=call(panel+"/api/auth/login",credentials)
assert status==200 and json.loads(body)["role"]=="ADMIN"
csrf=json.loads(body)["csrf"]
assert call(panel+"/api/auth/me")[0]==200
for resource in ["devices","tickets"]:
    status,body=call(panel+"/api/"+resource)
    assert status==200 and isinstance(json.loads(body),list)
assert call(panel+"/api/auth/logout",{},csrf)[0] in (200,204)
assert call(panel+"/api/auth/me")[0]==401
print("HTTPS painel/motor, login ADMIN, logout, consulta de inventario/chamados: OK")
try:
    untrusted=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    untrusted.open(panel+"/",timeout=5)
    raise AssertionError("Untrusted laboratory CA was unexpectedly accepted")
except urllib.error.URLError as e:
    assert isinstance(e.reason,ssl.SSLCertVerificationError)
print("CA nao confiada e rejeitada sem bypass: OK")
