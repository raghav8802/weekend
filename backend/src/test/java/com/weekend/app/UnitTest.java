package com.weekend.app;

import static org.assertj.core.api.Assertions.assertThat;

import com.weekend.app.common.Phones;
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
}
