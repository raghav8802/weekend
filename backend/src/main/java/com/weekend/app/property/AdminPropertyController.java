package com.weekend.app.property;

import com.weekend.app.lead.Lead;
import com.weekend.app.lead.LeadRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Team-only endpoints (login required, see SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
public class AdminPropertyController {

    private final PropertyService service;
    private final PropertyRepository properties;
    private final LeadRepository leads;

    public AdminPropertyController(PropertyService service, PropertyRepository properties, LeadRepository leads) {
        this.service = service;
        this.properties = properties;
        this.leads = leads;
    }

    public record StatusChange(@NotNull PropertyStatus status) {
    }

    @GetMapping("/me")
    public void me() {
        // 200 when the login is right; the admin page uses it to check the password.
    }

    @GetMapping("/properties")
    public List<Property> list() {
        return properties.findAll();
    }

    @GetMapping("/properties/{id}")
    public Property get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/properties")
    @ResponseStatus(HttpStatus.CREATED)
    public Property create(@Valid @RequestBody PropertyForm form) {
        return service.create(form);
    }

    @PutMapping("/properties/{id}")
    public Property update(@PathVariable UUID id, @Valid @RequestBody PropertyForm form) {
        return service.update(id, form);
    }

    @PostMapping("/properties/{id}/status")
    public Property status(@PathVariable UUID id, @Valid @RequestBody StatusChange change) {
        return service.setStatus(id, change.status());
    }

    @PostMapping("/properties/{id}/rotate-host-link")
    public Property rotateHostLink(@PathVariable UUID id) {
        return service.rotateHostToken(id);
    }

    @GetMapping("/leads")
    public List<Lead> leads(@RequestParam(required = false) UUID propertyId) {
        return propertyId == null ? leads.findRecent(500) : leads.findByProperty(propertyId, 500);
    }
}
