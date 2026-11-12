package com.weekend.app.lead;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A guest who contacted a host through us. This is the proof of value shown to hosts. */
public record Lead(
        UUID id,
        UUID propertyId,
        String reference,
        String guestName,
        LocalDate eventDate,
        int nights,
        int guests,
        SlotType slotType,
        Channel channel,
        LeadStatus status,
        OffsetDateTime createdAt) {

    public enum SlotType {
        DAY_USE, NIGHT, EVENT
    }

    public enum Channel {
        WHATSAPP, CALL
    }

    public enum LeadStatus {
        NEW, BOOKED, NOT_BOOKED
    }
}
