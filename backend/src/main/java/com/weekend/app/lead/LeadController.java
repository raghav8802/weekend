package com.weekend.app.lead;

import com.weekend.app.lead.LeadService.LeadResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LeadController {

    private final LeadService service;

    public LeadController(LeadService service) {
        this.service = service;
    }

    /**
     * The host's number is only ever returned here, inside the contact link, after the enquiry is logged.
     * Behind a proxy, set server.forward-headers-strategy=native so getRemoteAddr() is the guest's IP.
     */
    @PostMapping("/api/properties/{slug}/leads")
    @ResponseStatus(HttpStatus.CREATED)
    public LeadResponse create(@PathVariable String slug, @Valid @RequestBody LeadRequest request,
                               HttpServletRequest http) {
        return service.create(slug, request, http.getRemoteAddr());
    }
}
