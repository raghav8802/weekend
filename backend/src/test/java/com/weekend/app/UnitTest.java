package com.weekend.app;

import static org.assertj.core.api.Assertions.assertThat;

import com.weekend.app.common.Phones;
import com.weekend.app.config.DatabaseUrlEnvironmentPostProcessor;
import com.weekend.app.common.Tokens;
import org.junit.jupiter.api.Test;

class UnitTest {

    @Test
    void normalisesIndianMobiles() {
        assertThat(Phones.normalizeIndianMobile("+91 98123 45678")).contains("919812345678");
        assertThat(Phones.normalizeIndianMobile("098123-45678")).contains("919812345678");
        assertThat(Phones.normalizeIndianMobile("9812345678")).contains("919812345678");
        assertThat(Phones.normalizeIndianMobile("919812345678")).contains("919812345678");
        assertThat(Phones.normalizeIndianMobile("5812345678")).isEmpty();
        assertThat(Phones.normalizeIndianMobile("12345")).isEmpty();
        assertThat(Phones.normalizeIndianMobile(null)).isEmpty();
    }

    @Test
    void slugs() {
        assertThat(Tokens.slugify("Green Valley  Farm, Chhattarpur!")).isEqualTo("green-valley-farm-chhattarpur");
        assertThat(Tokens.slugify("Café Délice")).isEqualTo("cafe-delice");
        assertThat(Tokens.slugify("!!!")).isEqualTo("farmhouse");
    }

    @Test
    void tokens() {
        assertThat(Tokens.hostToken()).hasSize(43).doesNotContain("+", "/", "=");
        assertThat(Tokens.leadReference()).matches("WK-[A-HJ-NP-Z2-9]{6}");
    }

    @Test
    void convertsHostingDatabaseUrl() {
        var props = DatabaseUrlEnvironmentPostProcessor.convert(
                "postgresql://weekend:p%40ss:word@dpg-abc.oregon-postgres.render.com:5432/weekend?sslmode=require");
        assertThat(props.get("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://dpg-abc.oregon-postgres.render.com:5432/weekend?sslmode=require");
        assertThat(props.get("spring.datasource.username")).isEqualTo("weekend");
        assertThat(props.get("spring.datasource.password")).isEqualTo("p@ss:word");

        var internal = DatabaseUrlEnvironmentPostProcessor.convert("postgres://u:pw@dpg-abc-a/weekend");
        assertThat(internal.get("spring.datasource.url")).isEqualTo("jdbc:postgresql://dpg-abc-a/weekend");
    }
}
