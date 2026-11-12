package com.weekend.app.property;

import com.weekend.app.common.ApiException;
import com.weekend.app.common.Phones;
import com.weekend.app.common.Tokens;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PropertyService {

    private final PropertyRepository properties;

    public PropertyService(PropertyRepository properties) {
        this.properties = properties;
    }

    public Property get(UUID id) {
        return properties.findById(id).orElseThrow(() -> ApiException.notFound("Farmhouse"));
    }

    /** New listings start PENDING: hidden until the team has visited and verified them. */
    @Transactional
    public Property create(PropertyForm form) {
        Property p = fromForm(UUID.randomUUID(), uniqueSlug(form.name(), form.area()), Tokens.hostToken(),
                PropertyStatus.PENDING, form);
        properties.insert(p);
        return get(p.id());
    }

    @Transactional
    public Property update(UUID id, PropertyForm form) {
        Property existing = get(id);
        properties.updateDetails(fromForm(id, existing.slug(), existing.hostToken(), existing.status(), form));
        return get(id);
    }

    @Transactional
    public Property setStatus(UUID id, PropertyStatus status) {
        get(id);
        properties.updateStatus(id, status);
        return get(id);
    }

    /** Use when a host's page link was shared with the wrong person: the old link stops working. */
    @Transactional
    public Property rotateHostToken(UUID id) {
        get(id);
        properties.updateHostToken(id, Tokens.hostToken());
        return get(id);
    }

    private String uniqueSlug(String name, String area) {
        String base = Tokens.slugify(name + " " + area);
        String slug = base;
        for (int i = 2; properties.slugExists(slug); i++) {
            slug = base + "-" + i;
        }
        return slug;
    }

    private static Property fromForm(UUID id, String slug, String token, PropertyStatus status, PropertyForm f) {
        String phone = Phones.normalizeIndianMobile(f.hostPhone())
                .orElseThrow(() -> ApiException.badRequest("Host phone must be a valid Indian mobile number"));
        return new Property(id, slug, f.name().trim(), f.area().trim(), f.address().trim(), f.latitude(),
                f.longitude(), nullToEmpty(f.description()), nullToEmpty(f.houseRules()), f.maxGuests(),
                f.bedrooms(), f.hasPool(), clean(f.amenities()), clean(f.photoUrls()), f.dayUsePriceMin(),
                f.dayUsePriceMax(), f.nightPriceMin(), f.nightPriceMax(), f.hostName().trim(), phone, token,
                status, null, null, null);
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    private static List<String> clean(List<String> values) {
        return values == null ? List.of() : values.stream().map(String::trim).distinct().toList();
    }
}
