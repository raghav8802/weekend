package com.weekend.app.lead;

import com.weekend.app.lead.Lead.SlotType;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Builds the WhatsApp and phone links handed to a guest after they submit an enquiry. */
public final class ContactLinks {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEE d MMM yyyy", Locale.ENGLISH);

    private ContactLinks() {
    }

    public static String whatsapp(String phoneDigits, String message) {
        return "https://wa.me/" + phoneDigits + "?text=" + URLEncoder.encode(message, StandardCharsets.UTF_8)
                .replace("+", "%20");
    }

    public static String tel(String phoneDigits) {
        return "tel:+" + phoneDigits;
    }

    /** Pre-filled message; the reference lets the host and us tie a booking back to this lead. */
    public static String message(String brand, String hostFirstName, String propertyName, Lead lead) {
        return "Hi " + hostFirstName + ", I found " + propertyName + " on " + brand + " (ref " + lead.reference()
                + "). Looking for " + describe(lead.slotType(), lead.eventDate(), lead.nights()) + " for "
                + lead.guests() + " guests. Is it available? - " + lead.guestName();
    }

    private static String describe(SlotType slot, LocalDate date, int nights) {
        return switch (slot) {
            case DAY_USE -> "day-use on " + DATE.format(date);
            case EVENT -> "an event on " + DATE.format(date);
            case NIGHT -> nights + (nights == 1 ? " night" : " nights") + " from " + DATE.format(date);
        };
    }
}
