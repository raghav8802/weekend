package com.weekend.app.property;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PropertyRepository {

    private static final RowMapper<Property> MAPPER = PropertyRepository::map;

    private final JdbcClient jdbc;

    public PropertyRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Property> findById(UUID id) {
        return jdbc.sql("SELECT * FROM properties WHERE id = :id").param("id", id).query(MAPPER).optional();
    }

    public Optional<Property> findBySlug(String slug) {
        return jdbc.sql("SELECT * FROM properties WHERE slug = :slug").param("slug", slug).query(MAPPER).optional();
    }

    public Optional<Property> findByHostToken(String token) {
        return jdbc.sql("SELECT * FROM properties WHERE host_token = :t").param("t", token).query(MAPPER).optional();
    }

    public List<Property> findAll() {
        return jdbc.sql("SELECT * FROM properties ORDER BY created_at DESC").query(MAPPER).list();
    }

    public boolean slugExists(String slug) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM properties WHERE slug = :slug)")
                .param("slug", slug).query(Boolean.class).single();
    }

    /**
     * Live farmhouses that fit the group and, when a date is given, are free for
     * every day in [date, date + nights).
     */
    public List<Property> searchLive(String area, Integer guests, LocalDate date, int nights) {
        StringBuilder sql = new StringBuilder("SELECT p.* FROM properties p WHERE p.status = 'LIVE'");
        Map<String, Object> params = new LinkedHashMap<>();
        if (area != null && !area.isBlank()) {
            sql.append(" AND lower(p.area) = lower(:area)");
            params.put("area", area.trim());
        }
        if (guests != null) {
            sql.append(" AND p.max_guests >= :guests");
            params.put("guests", guests);
        }
        if (date != null) {
            sql.append(" AND NOT EXISTS (SELECT 1 FROM availability_blocks b WHERE b.property_id = p.id"
                    + " AND b.start_date < :endDate AND b.end_date > :startDate)");
            params.put("startDate", date);
            params.put("endDate", date.plusDays(nights));
        }
        sql.append(" ORDER BY p.verified_at DESC NULLS LAST, p.name");
        return jdbc.sql(sql.toString()).params(params).query(MAPPER).list();
    }

    public List<String> liveAreas() {
        return jdbc.sql("SELECT DISTINCT area FROM properties WHERE status = 'LIVE' ORDER BY area")
                .query(String.class).list();
    }

    public void insert(Property p) {
        jdbc.sql("""
                INSERT INTO properties (id, slug, name, area, address, latitude, longitude, description,
                    house_rules, max_guests, bedrooms, has_pool, amenities, photo_urls, day_use_price_min,
                    day_use_price_max, night_price_min, night_price_max, host_name, host_phone, host_token, status)
                VALUES (:id, :slug, :name, :area, :address, :latitude, :longitude, :description, :houseRules,
                    :maxGuests, :bedrooms, :hasPool, CAST(:amenities AS text[]), CAST(:photoUrls AS text[]),
                    :dayUsePriceMin, :dayUsePriceMax, :nightPriceMin, :nightPriceMax, :hostName, :hostPhone,
                    :hostToken, :status)
                """)
                .params(detailParams(p))
                .param("id", p.id())
                .param("slug", p.slug())
                .param("hostToken", p.hostToken())
                .param("status", p.status().name())
                .update();
    }

    public void updateDetails(Property p) {
        jdbc.sql("""
                UPDATE properties SET name = :name, area = :area, address = :address, latitude = :latitude,
                    longitude = :longitude, description = :description, house_rules = :houseRules,
                    max_guests = :maxGuests, bedrooms = :bedrooms, has_pool = :hasPool,
                    amenities = CAST(:amenities AS text[]), photo_urls = CAST(:photoUrls AS text[]),
                    day_use_price_min = :dayUsePriceMin, day_use_price_max = :dayUsePriceMax,
                    night_price_min = :nightPriceMin, night_price_max = :nightPriceMax,
                    host_name = :hostName, host_phone = :hostPhone, updated_at = now()
                WHERE id = :id
                """)
                .params(detailParams(p))
                .param("id", p.id())
                .update();
    }

    /** Going LIVE for the first time records when the team verified the farmhouse. */
    public void updateStatus(UUID id, PropertyStatus status) {
        jdbc.sql("""
                UPDATE properties SET status = :status, updated_at = now(),
                    verified_at = CASE WHEN :status = 'LIVE' THEN coalesce(verified_at, now()) ELSE verified_at END
                WHERE id = :id
                """)
                .param("status", status.name())
                .param("id", id)
                .update();
    }

    public void updateHostToken(UUID id, String token) {
        jdbc.sql("UPDATE properties SET host_token = :t, updated_at = now() WHERE id = :id")
                .param("t", token).param("id", id).update();
    }

    private static Map<String, Object> detailParams(Property p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", p.name());
        m.put("area", p.area());
        m.put("address", p.address());
        m.put("latitude", p.latitude());
        m.put("longitude", p.longitude());
        m.put("description", p.description());
        m.put("houseRules", p.houseRules());
        m.put("maxGuests", p.maxGuests());
        m.put("bedrooms", p.bedrooms());
        m.put("hasPool", p.hasPool());
        m.put("amenities", p.amenities().toArray(String[]::new));
        m.put("photoUrls", p.photoUrls().toArray(String[]::new));
        m.put("dayUsePriceMin", p.dayUsePriceMin());
        m.put("dayUsePriceMax", p.dayUsePriceMax());
        m.put("nightPriceMin", p.nightPriceMin());
        m.put("nightPriceMax", p.nightPriceMax());
        m.put("hostName", p.hostName());
        m.put("hostPhone", p.hostPhone());
        return m;
    }

    private static Property map(ResultSet rs, int row) throws SQLException {
        return new Property(
                rs.getObject("id", UUID.class),
                rs.getString("slug"),
                rs.getString("name"),
                rs.getString("area"),
                rs.getString("address"),
                (Double) rs.getObject("latitude"),
                (Double) rs.getObject("longitude"),
                rs.getString("description"),
                rs.getString("house_rules"),
                rs.getInt("max_guests"),
                rs.getInt("bedrooms"),
                rs.getBoolean("has_pool"),
                strings(rs.getArray("amenities")),
                strings(rs.getArray("photo_urls")),
                (Integer) rs.getObject("day_use_price_min"),
                (Integer) rs.getObject("day_use_price_max"),
                (Integer) rs.getObject("night_price_min"),
                (Integer) rs.getObject("night_price_max"),
                rs.getString("host_name"),
                rs.getString("host_phone"),
                rs.getString("host_token"),
                PropertyStatus.valueOf(rs.getString("status")),
                rs.getObject("verified_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class));
    }

    private static List<String> strings(Array array) throws SQLException {
        if (array == null) {
            return List.of();
        }
        return new ArrayList<>(Arrays.asList((String[]) array.getArray()));
    }
}
