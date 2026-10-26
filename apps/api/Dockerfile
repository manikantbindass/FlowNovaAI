FROM maven:3-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn -B -ntp package -DskipTests
FROM eclipse-temurin:21-jre-alpine
RUN apk upgrade --no-cache && addgroup -S flownova && adduser -S -G flownova flownova
WORKDIR /app
COPY --from=build /build/target/api-0.0.1-SNAPSHOT.jar /app/api.jar
RUN chown -R flownova:flownova /app
USER flownova
EXPOSE 8080
ENTRYPOINT []
CMD ["java", "-jar", "/app/api.jar"]
