package com.weekend.app.host;

import com.weekend.app.availability.AvailabilityBlock;
import com.weekend.app.availability.AvailabilityBlock.BlockSource;
import com.weekend.app.availability.AvailabilityRepository;
import com.weekend.app.common.ApiException;
import com.weekend.app.lead.Lead;
import com.weekend.app.lead.Lead.LeadStatus;
import com.weekend.app.lead.LeadRepository;
import com.weekend.app.lead.LeadService;
import com.weekend.app.property.Property;
import com.weekend.app.property.PropertyRepository;
import com.weekend.app.property.PublicProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The host's own page, opened with the secret link the team sends them on WhatsApp.
 * Hosts see their leads, block dates and say which leads became bookings.
 */
@RestController
@RequestMapping("/api/host/{token}")
public class HostController {

    private static final int MAX_BLOCK_DAYS = 120;

    private final PropertyRepository properties;
    private final LeadRepository leads;
    private final AvailabilityRepository availability;

    public HostController(PropertyRepository properties, LeadRepository leads, AvailabilityRepository availability) {
        this.properties = properties;
        this.leads = leads;
        this.availability = availability;
    }

    public record HostBlock(UUID id, LocalDate fromDate, LocalDate toDate, BlockSource source, String note) {
        static HostBlock from(AvailabilityBlock b) {
            return new HostBlock(b.id(), b.startDate(), b.lastDate(), b.source(), b.note());
        }
    }

    public record LeadSummary(int total, int booked, int lastThirtyDays) {
    }

    public record HostView(PublicProperty property, String status, LeadSummary summary, List<Lead> leads,
                           List<HostBlock> blocks) {
    }

    /** fromDate and toDate are both included: 31 Dec to 1 Jan blocks two days. */
    public record BlockRequest(@NotNull LocalDate fromDate, @NotNull LocalDate toDate, @Size(max = 200) String note) {
        @AssertTrue(message = "The end date cannot be before the start date")
        public boolean isOrdered() {
            return fromDate == null || toDate == null || !toDate.isBefore(fromDate);
        }
    }

    public record Outcome(@NotNull LeadStatus status) {
        @AssertTrue(message = "Choose BOOKED or NOT_BOOKED")
        public boolean isFinal() {
            return status != LeadStatus.NEW;
        }
    }

    public record OutcomeResult(Lead lead, boolean datesBlocked, boolean datesAlreadyBlocked) {
    }

    @GetMapping
    public HostView view(@PathVariable String token) {
        Property p = host(token);
        List<Lead> all = leads.findByProperty(p.id(), 200);
        LocalDate today = LocalDate.now(LeadService.INDIA);
        int booked = (int) all.stream().filter(l -> l.status() == LeadStatus.BOOKED).count();
        int recent = (int) all.stream()
                .filter(l -> l.createdAt().atZoneSameInstant(LeadService.INDIA).toLocalDate()
                        .isAfter(today.minusDays(30)))
                .count();
        List<HostBlock> blocks = availability.findEndingAfter(p.id(), today).stream().map(HostBlock::from).toList();
        return new HostView(PublicProperty.from(p), p.status().name(), new LeadSummary(all.size(), booked, recent),
                all, blocks);
    }

    @PostMapping("/blocks")
    @ResponseStatus(HttpStatus.CREATED)
    public HostBlock block(@PathVariable String token, @Valid @RequestBody BlockRequest req) {
        Property p = host(token);
        if (ChronoUnit.DAYS.between(req.fromDate(), req.toDate()) >= MAX_BLOCK_DAYS) {
            throw ApiException.badRequest("Block at most " + MAX_BLOCK_DAYS + " days at a time");
        }
        if (req.toDate().isBefore(LocalDate.now(LeadService.INDIA))) {
            throw ApiException.badRequest("These dates are in the past");
        }
        return HostBlock.from(availability.insert(p.id(), req.fromDate(), req.toDate().plusDays(1),
                BlockSource.HOST_BLOCKED, null, blankToNull(req.note())));
    }

    @DeleteMapping("/blocks/{blockId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@PathVariable String token, @PathVariable UUID blockId) {
        if (availability.delete(blockId, host(token).id()) == 0) {
            throw ApiException.notFound("Blocked dates");
        }
    }

    /** "Did this enquiry become a booking?" A booking also blocks the dates so no one else asks for them. */
    @PostMapping("/leads/{leadId}/outcome")
    @Transactional
    public OutcomeResult outcome(@PathVariable String token, @PathVariable UUID leadId,
                                 @Valid @RequestBody Outcome outcome) {
        Property p = host(token);
        Lead lead = leads.findForProperty(leadId, p.id()).orElseThrow(() -> ApiException.notFound("Enquiry"));
        leads.updateStatus(lead.id(), outcome.status());

        boolean blocked = false;
        boolean alreadyBlocked = false;
        if (outcome.status() == LeadStatus.BOOKED && lead.status() != LeadStatus.BOOKED) {
            LocalDate end = lead.eventDate().plusDays(lead.nights());
            if (availability.overlaps(p.id(), lead.eventDate(), end)) {
                alreadyBlocked = true;
            } else {
                availability.insert(p.id(), lead.eventDate(), end, BlockSource.DIRECT_CONFIRMED, lead.id(),
                        "Booked via enquiry " + lead.reference());
                blocked = true;
            }
        }
        Lead updated = leads.findForProperty(leadId, p.id()).orElseThrow();
        return new OutcomeResult(updated, blocked, alreadyBlocked);
    }

    private Property host(String token) {
        return properties.findByHostToken(token).orElseThrow(() -> ApiException.notFound("Host page"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
