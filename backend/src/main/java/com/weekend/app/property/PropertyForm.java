package com.weekend.app.property;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Listing details entered by the team in the admin page. */
public record PropertyForm(
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Size(max = 80) String area,
        @NotBlank @Size(max = 500) String address,
        @DecimalMin("-90") @DecimalMax("90") Double latitude,
        @DecimalMin("-180") @DecimalMax("180") Double longitude,
        @Size(max = 5000) String description,
        @Size(max = 3000) String houseRules,
        @Min(1) @Max(2000) int maxGuests,
        @Min(0) @Max(100) int bedrooms,
        boolean hasPool,
        @Size(max = 40) List<@NotBlank @Size(max = 60) String> amenities,
        @Size(max = 30) List<@NotBlank @Size(max = 1000) String> photoUrls,
        @Positive Integer dayUsePriceMin,
        @Positive Integer dayUsePriceMax,
        @Positive Integer nightPriceMin,
        @Positive Integer nightPriceMax,
        @NotBlank @Size(max = 120) String hostName,
        @NotBlank String hostPhone) {

    @AssertTrue(message = "Give at least a day-use or a night price, so guests always see a price")
    public boolean isPriceShown() {
        return dayUsePriceMin != null || nightPriceMin != null;
    }

    @AssertTrue(message = "A maximum price needs a minimum price at or below it")
    public boolean isRangesValid() {
        return validRange(dayUsePriceMin, dayUsePriceMax) && validRange(nightPriceMin, nightPriceMax);
    }

    @AssertTrue(message = "Photo links must start with https://")
    public boolean isPhotoUrlsSecure() {
        return photoUrls == null || photoUrls.stream().allMatch(u -> u != null && u.startsWith("https://"));
    }

    private static boolean validRange(Integer min, Integer max) {
        return max == null || (min != null && max >= min);
    }
}
