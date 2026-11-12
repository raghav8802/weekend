package com.weekend.app.lead;

import com.weekend.app.availability.AvailabilityRepository;
import com.weekend.app.common.ApiException;
import com.weekend.app.common.Tokens;
import com.weekend.app.config.AppProperties;
import com.weekend.app.lead.Lead.Channel;
import com.weekend.app.lead.Lead.LeadStatus;
import com.weekend.app.lead.Lead.SlotType;
import com.weekend.app.property.Property;
import com.weekend.app.property.PropertyRepository;
import com.weekend.app.property.PropertyStatus;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeadService {

    public static final ZoneId INDIA = ZoneId.of("Asia/Kolkata");
    private static final int MAX_DAYS_AHEAD = 365;

    private final PropertyRepository properties;
    private final LeadRepository leads;
    private final AvailabilityRepository availability;
    private final LeadRateLimiter rateLimiter;
    private final AppProperties props;
    private final Clock clock;

    public LeadService(PropertyRepository properties, LeadRepository leads, AvailabilityRepository availability,
                       LeadRateLimiter rateLimiter, AppProperties props) {
        this.properties = properties;
        this.leads = leads;
        this.availability = availability;
        this.rateLimiter = rateLimiter;
        this.props = props;
        this.clock = Clock.system(INDIA);
    }

    public record LeadResponse(String reference, String contactUrl, String message) {
    }

    /** Logs the enquiry, then hands the guest a WhatsApp or call link to the host. */
    @Transactional
    public LeadResponse create(String slug, LeadRequest req, String clientKey) {
        Property p = properties.findBySlug(slug)
                .filter(x -> x.status() == PropertyStatus.LIVE)
                .orElseThrow(() -> ApiException.notFound("Farmhouse"));

        LocalDate today = LocalDate.now(clock);
        if (req.eventDate().isBefore(today) || req.eventDate().isAfter(today.plusDays(MAX_DAYS_AHEAD))) {
            throw ApiException.badRequest("Choose a date between today and one year from now");
        }
        if (req.guests() > p.maxGuests()) {
            throw ApiException.badRequest("This farmhouse allows up to " + p.maxGuests() + " guests");
        }
        int nights = req.slotType() == SlotType.NIGHT ? req.nightsOrDefault() : 1;
        if (availability.overlaps(p.id(), req.eventDate(), req.eventDate().plusDays(nights))) {
            throw ApiException.conflict("The host has marked these dates as booked. Try another date.");
        }
        if (!rateLimiter.tryAcquire(clientKey)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many enquiries from this connection. Please try again in an hour.");
        }

        Lead lead = new Lead(UUID.randomUUID(), p.id(), Tokens.leadReference(),
                req.guestName().trim(), req.eventDate(), nights, req.guests(), req.slotType(), req.channel(),
                LeadStatus.NEW, null);
        leads.insert(lead);

        String firstName = p.hostName().trim().split("\\s+")[0];
        String message = ContactLinks.message(props.brandName(), firstName, p.name(), lead);
        String url = req.channel() == Channel.WHATSAPP
                ? ContactLinks.whatsapp(p.hostPhone(), message)
                : ContactLinks.tel(p.hostPhone());
        return new LeadResponse(lead.reference(), url, message);
    }
}
