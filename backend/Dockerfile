FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src src
RUN mvn -B package
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/uai-suporte-0.1.0.jar app.jar
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod 755 /app/entrypoint.sh && mkdir /app/trust && chown -R 10001:10001 /app
USER 10001
ENTRYPOINT ["/app/entrypoint.sh"]
