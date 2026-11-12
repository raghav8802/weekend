package com.weekend.app.availability;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Days a farmhouse is unavailable: startDate inclusive, endDate exclusive. */
public record AvailabilityBlock(
        UUID id,
        UUID propertyId,
        LocalDate startDate,
        LocalDate endDate,
        BlockSource source,
        UUID leadId,
        String note,
        OffsetDateTime createdAt) {

    /** The last blocked day, for display ("31 Dec to 2 Jan"). */
    public LocalDate lastDate() {
        return endDate.minusDays(1);
    }

    public enum BlockSource {
        /** Host blocked the dates (offline booking, maintenance, family use). */
        HOST_BLOCKED,
        /** Host confirmed that a lead from us became a booking. */
        DIRECT_CONFIRMED
    }
}
