package com.weekend.app.common;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.Base64;
import java.util.Locale;

public final class Tokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    /** No 0/O or 1/I/L, so a host can read the code out over the phone. */
    private static final char[] REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();

    private Tokens() {
    }

    /** 32 random bytes, URL-safe: the secret in a host's page link. */
    public static String hostToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Short lead code such as "WK-7QH3XM" put in the guest's WhatsApp message. */
    public static String leadReference() {
        StringBuilder sb = new StringBuilder("WK-");
        for (int i = 0; i < 6; i++) {
            sb.append(REFERENCE_ALPHABET[RANDOM.nextInt(REFERENCE_ALPHABET.length)]);
        }
        return sb.toString();
    }

    public static String slugify(String text) {
        String ascii = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (slug.length() > 120) {
            slug = slug.substring(0, 120).replaceAll("-$", "");
        }
        return slug.isEmpty() ? "farmhouse" : slug;
    }
}
