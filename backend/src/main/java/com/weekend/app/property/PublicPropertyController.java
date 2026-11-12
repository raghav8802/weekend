package com.weekend.app.property;

import com.weekend.app.availability.AvailabilityRepository;
import com.weekend.app.common.ApiException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@Validated
public class PublicPropertyController {

    private static final int MAX_CALENDAR_DAYS = 180;

    private final PropertyRepository properties;
    private final AvailabilityRepository availability;

    public PublicPropertyController(PropertyRepository properties, AvailabilityRepository availability) {
        this.properties = properties;
        this.availability = availability;
    }

    @GetMapping("/properties")
    public List<PublicProperty> search(
            @RequestParam(required = false) String area,
            @RequestParam(required = false) @Min(1) @Max(2000) Integer guests,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "1") @Min(1) @Max(30) int nights) {
        return properties.searchLive(area, guests, date, nights).stream().map(PublicProperty::from).toList();
    }

    @GetMapping("/areas")
    public List<String> areas() {
        return properties.liveAreas();
    }

    @GetMapping("/properties/{slug}")
    public PublicProperty get(@PathVariable String slug) {
        return PublicProperty.from(live(slug));
    }

    /** Booked days between from and to (inclusive), for the listing's calendar. */
    @GetMapping("/properties/{slug}/blocked-dates")
    public List<LocalDate> blockedDates(
            @PathVariable String slug,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_CALENDAR_DAYS) {
            throw ApiException.badRequest("Choose a range of up to " + MAX_CALENDAR_DAYS + " days");
        }
        return availability.blockedDays(live(slug).id(), from, to);
    }

    private Property live(String slug) {
        return properties.findBySlug(slug)
                .filter(p -> p.status() == PropertyStatus.LIVE)
                .orElseThrow(() -> ApiException.notFound("Farmhouse"));
    }
}
