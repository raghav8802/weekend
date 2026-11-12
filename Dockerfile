# One image that serves both the React site and the Spring Boot API.

# 1. Build the React app.
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Build the Spring Boot jar with the React app inside it.
FROM eclipse-temurin:21-jdk AS api
WORKDIR /api
COPY backend/ ./
COPY --from=web /web/dist/ src/main/resources/static/
RUN chmod +x gradlew && ./gradlew bootJar --no-daemon -q

# 3. Small runtime image.
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=api /api/build/libs/weekend-backend-*.jar app.jar
# Free hosting plans have about 512 MB of memory.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC"
EXPOSE 8080
CMD ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
