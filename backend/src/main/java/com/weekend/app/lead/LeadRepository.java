package com.weekend.app.lead;

import com.weekend.app.lead.Lead.Channel;
import com.weekend.app.lead.Lead.LeadStatus;
import com.weekend.app.lead.Lead.SlotType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class LeadRepository {

    private static final RowMapper<Lead> MAPPER = LeadRepository::map;

    private final JdbcClient jdbc;

    public LeadRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Lead lead) {
        jdbc.sql("""
                INSERT INTO leads (id, property_id, reference, guest_name, event_date, nights, guests,
                    slot_type, channel, status)
                VALUES (:id, :propertyId, :reference, :guestName, :eventDate, :nights, :guests,
                    :slotType, :channel, :status)
                """)
                .param("id", lead.id())
                .param("propertyId", lead.propertyId())
                .param("reference", lead.reference())
                .param("guestName", lead.guestName())
                .param("eventDate", lead.eventDate())
                .param("nights", lead.nights())
                .param("guests", lead.guests())
                .param("slotType", lead.slotType().name())
                .param("channel", lead.channel().name())
                .param("status", lead.status().name())
                .update();
    }

    public Optional<Lead> findForProperty(UUID id, UUID propertyId) {
        return jdbc.sql("SELECT * FROM leads WHERE id = :id AND property_id = :propertyId")
                .param("id", id).param("propertyId", propertyId).query(MAPPER).optional();
    }

    public List<Lead> findByProperty(UUID propertyId, int limit) {
        return jdbc.sql("SELECT * FROM leads WHERE property_id = :propertyId ORDER BY created_at DESC LIMIT :limit")
                .param("propertyId", propertyId).param("limit", limit).query(MAPPER).list();
    }

    public List<Lead> findRecent(int limit) {
        return jdbc.sql("SELECT * FROM leads ORDER BY created_at DESC LIMIT :limit")
                .param("limit", limit).query(MAPPER).list();
    }

    public void updateStatus(UUID id, LeadStatus status) {
        jdbc.sql("UPDATE leads SET status = :status, updated_at = now() WHERE id = :id")
                .param("status", status.name()).param("id", id).update();
    }

    private static Lead map(ResultSet rs, int row) throws SQLException {
        return new Lead(
                rs.getObject("id", UUID.class),
                rs.getObject("property_id", UUID.class),
                rs.getString("reference"),
                rs.getString("guest_name"),
                rs.getObject("event_date", LocalDate.class),
                rs.getInt("nights"),
                rs.getInt("guests"),
                SlotType.valueOf(rs.getString("slot_type")),
                Channel.valueOf(rs.getString("channel")),
                LeadStatus.valueOf(rs.getString("status")),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
