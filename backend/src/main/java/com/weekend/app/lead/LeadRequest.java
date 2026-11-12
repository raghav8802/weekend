package com.weekend.app.lead;

import com.weekend.app.lead.Lead.Channel;
import com.weekend.app.lead.Lead.SlotType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** What a guest fills in before contacting the host. */
public record LeadRequest(
        @NotBlank @Size(max = 100) String guestName,
        @NotNull LocalDate eventDate,
        @Min(1) @Max(30) Integer nights,
        @Min(1) @Max(2000) int guests,
        @NotNull SlotType slotType,
        @NotNull Channel channel) {

    public int nightsOrDefault() {
        return nights == null ? 1 : nights;
    }
}
