package com.weekend.app.common;

import java.util.Optional;
import java.util.regex.Pattern;

/** Indian mobile numbers, stored as 12 digits: 91 + a 10-digit number starting 6-9. */
public final class Phones {

    private static final Pattern INDIAN_MOBILE = Pattern.compile("91[6-9]\\d{9}");

    private Phones() {
    }

    /** Accepts "+91 98123 45678", "098123-45678", "9812345678" and similar. */
    public static Optional<String> normalizeIndianMobile(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        if (digits.length() == 10) {
            digits = "91" + digits;
        }
        return INDIAN_MOBILE.matcher(digits).matches() ? Optional.of(digits) : Optional.empty();
    }
}
