package com.weekend.app.property;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** A farmhouse listing as stored. Contains host contact details: never return it from public endpoints. */
public record Property(
        UUID id,
        String slug,
        String name,
        String area,
        String address,
        Double latitude,
        Double longitude,
        String description,
        String houseRules,
        int maxGuests,
        int bedrooms,
        boolean hasPool,
        List<String> amenities,
        List<String> photoUrls,
        Integer dayUsePriceMin,
        Integer dayUsePriceMax,
        Integer nightPriceMin,
        Integer nightPriceMax,
        String hostName,
        String hostPhone,
        String hostToken,
        PropertyStatus status,
        OffsetDateTime verifiedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
