#!/usr/bin/env python3
"""Isolated PostgreSQL 16 tests; never uses the laboratory database. Requires local Java/Maven tools."""
import os,pathlib,tempfile,subprocess,secrets,socket,shutil,sys
root=pathlib.Path(__file__).resolve().parents[1];os.chdir(root); bind=socket.socket();bind.bind(('127.0.0.1',0));port=bind.getsockname()[1];bind.close()
stage=pathlib.Path(tempfile.mkdtemp(prefix='monitoring-pg-',dir=root/'.tools'));data=stage/'data';log=stage/'postgres.log';pw=stage/'password';pw.write_text(secrets.token_urlsafe(32));pw.chmod(0o600)
bin=pathlib.Path('/usr/lib/postgresql/16/bin');started=False
try:
 subprocess.run([str(bin/'initdb'),'-D',str(data),'-A','scram-sha-256','--pwfile',str(pw)],stdout=subprocess.DEVNULL,check=True)
 with (data/'postgresql.conf').open('a') as f:f.write("\nlisten_addresses='127.0.0.1'\nport="+str(port)+"\nunix_socket_directories='"+str(stage)+"'\n")
 subprocess.run([str(bin/'pg_ctl'),'-D',str(data),'-l',str(log),'-w','start'],stdout=subprocess.DEVNULL,check=True);started=True
 env=dict(os.environ,JAVA_HOME=str(root/'.tools/java'),UAI_TEST_DATABASE=f'jdbc:postgresql://127.0.0.1:{port}/postgres',UAI_TEST_DB_USER='agenda',UAI_TEST_DB_PASSWORD=pw.read_text())
 with (root/'.tools/monitoring-postgres.log').open('w') as out:result=subprocess.run([str(root/'.tools/apache-maven-3.9.11/bin/mvn'),'-q','-f','backend/pom.xml','test'],env=env,stdout=out,stderr=subprocess.STDOUT)
 print('Isolated PostgreSQL result:',result.returncode)
finally:
 if started:subprocess.run([str(bin/'pg_ctl'),'-D',str(data),'-w','stop'],stdout=subprocess.DEVNULL,check=True)
 shutil.rmtree(stage)

sys.exit(result.returncode)
