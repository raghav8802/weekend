package com.weekend.app.availability;

import com.weekend.app.availability.AvailabilityBlock.BlockSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AvailabilityRepository {

    private static final RowMapper<AvailabilityBlock> MAPPER = AvailabilityRepository::map;

    private final JdbcClient jdbc;

    public AvailabilityRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Inserts the block; the database's exclusion constraint rejects overlaps (mapped to HTTP 409). */
    public AvailabilityBlock insert(UUID propertyId, LocalDate start, LocalDate endExclusive, BlockSource source,
                                    UUID leadId, String note) {
        return jdbc.sql("""
                INSERT INTO availability_blocks (id, property_id, start_date, end_date, source, lead_id, note)
                VALUES (:id, :propertyId, :start, :end, :source, :leadId, :note)
                RETURNING *
                """)
                .param("id", UUID.randomUUID())
                .param("propertyId", propertyId)
                .param("start", start)
                .param("end", endExclusive)
                .param("source", source.name())
                .param("leadId", leadId)
                .param("note", note)
                .query(MAPPER).single();
    }

    public boolean overlaps(UUID propertyId, LocalDate start, LocalDate endExclusive) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM availability_blocks
                WHERE property_id = :propertyId AND start_date < :end AND end_date > :start)
                """)
                .param("propertyId", propertyId).param("start", start).param("end", endExclusive)
                .query(Boolean.class).single();
    }

    public int delete(UUID id, UUID propertyId) {
        return jdbc.sql("DELETE FROM availability_blocks WHERE id = :id AND property_id = :propertyId")
                .param("id", id).param("propertyId", propertyId).update();
    }

    public List<AvailabilityBlock> findEndingAfter(UUID propertyId, LocalDate date) {
        return jdbc.sql("""
                SELECT * FROM availability_blocks WHERE property_id = :propertyId AND end_date > :date
                ORDER BY start_date
                """)
                .param("propertyId", propertyId).param("date", date)
                .query(MAPPER).list();
    }

    /** Every blocked day between from and to, both inclusive. */
    public List<LocalDate> blockedDays(UUID propertyId, LocalDate from, LocalDate to) {
        return jdbc.sql("""
                SELECT DISTINCT d::date AS day
                FROM availability_blocks b,
                     generate_series(greatest(b.start_date, :from), least(b.end_date - 1, :to), interval '1 day') d
                WHERE b.property_id = :propertyId AND b.start_date <= :to AND b.end_date > :from
                ORDER BY day
                """)
                .param("propertyId", propertyId).param("from", from).param("to", to)
                .query((rs, i) -> rs.getObject("day", LocalDate.class)).list();
    }

    private static AvailabilityBlock map(ResultSet rs, int row) throws SQLException {
        return new AvailabilityBlock(
                rs.getObject("id", UUID.class),
                rs.getObject("property_id", UUID.class),
                rs.getObject("start_date", LocalDate.class),
                rs.getObject("end_date", LocalDate.class),
                BlockSource.valueOf(rs.getString("source")),
                rs.getObject("lead_id", UUID.class),
                rs.getString("note"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
