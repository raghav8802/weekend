package com.weekend.app.property;

import java.util.List;

/** What guests see. Deliberately has no host phone, token, exact address or coordinates. */
public record PublicProperty(
        String slug,
        String name,
        String area,
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
        String hostFirstName,
        boolean verified) {

    public static PublicProperty from(Property p) {
        String first = p.hostName().trim().split("\\s+")[0];
        return new PublicProperty(p.slug(), p.name(), p.area(), p.description(), p.houseRules(),
                p.maxGuests(), p.bedrooms(), p.hasPool(), p.amenities(), p.photoUrls(),
                p.dayUsePriceMin(), p.dayUsePriceMax(), p.nightPriceMin(), p.nightPriceMax(),
                first, p.verifiedAt() != null);
    }
}
