#!/bin/sh
set -eu
if [ "${MESH_ENABLED:-false}" = "true" ]; then
  test -f /mesh-ca/root-cert-public.crt || { echo 'Disponibilize a CA do MeshCentral em /mesh-ca/root-cert-public.crt'; exit 1; }
  cp "$JAVA_HOME/lib/security/cacerts" /app/trust/cacerts
  keytool -importcert -noprompt -alias uai-mesh -file /mesh-ca/root-cert-public.crt -keystore /app/trust/cacerts -storepass changeit >/dev/null 2>&1
  exec java -Djavax.net.ssl.trustStore=/app/trust/cacerts -Djavax.net.ssl.trustStorePassword=changeit -jar /app/app.jar
fi
exec java -jar /app/app.jar
