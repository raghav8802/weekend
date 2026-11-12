package com.weekend.app.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Hosting providers such as Render and Neon give the database as one DATABASE_URL in the form
 * postgres://user:password@host:port/dbname. Spring needs a JDBC URL plus a separate user and
 * password, so this converts it. Used only when DATABASE_URL is set and DB_URL is not.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment env, SpringApplication app) {
        String raw = env.getProperty("DATABASE_URL");
        if (raw == null || raw.isBlank() || env.containsProperty("DB_URL")) {
            return;
        }
        env.getPropertySources().addFirst(new MapPropertySource("databaseUrl", convert(raw)));
    }

    public static Map<String, Object> convert(String raw) {
        URI uri = URI.create(raw.trim());
        if (!"postgres".equals(uri.getScheme()) && !"postgresql".equals(uri.getScheme())) {
            throw new IllegalArgumentException("DATABASE_URL must start with postgres:// or postgresql://");
        }
        Map<String, Object> props = new HashMap<>();
        String jdbc = "jdbc:postgresql://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "")
                + uri.getRawPath() + (uri.getRawQuery() != null ? "?" + uri.getRawQuery() : "");
        props.put("spring.datasource.url", jdbc);
        String userInfo = uri.getRawUserInfo();
        if (userInfo != null) {
            int colon = userInfo.indexOf(':');
            String user = colon >= 0 ? userInfo.substring(0, colon) : userInfo;
            props.put("spring.datasource.username", URLDecoder.decode(user, StandardCharsets.UTF_8));
            if (colon >= 0) {
                props.put("spring.datasource.password",
                        URLDecoder.decode(userInfo.substring(colon + 1), StandardCharsets.UTF_8));
            }
        }
        return props;
    }
}
