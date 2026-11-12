package com.weekend.app;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weekend.app.lead.LeadRateLimiter;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Runs against a real Postgres (the overlap rule needs it). Point TEST_DB_URL at an empty database. */
@SpringBootTest(properties = {
        "spring.datasource.url=${TEST_DB_URL:jdbc:postgresql://localhost:5432/weekend_test}",
        "app.admin.username=admin",
        "app.admin.password=secret",
        "app.leads.max-per-hour-per-ip=5",
        "app.brand-name=Weekend"
})
@AutoConfigureMockMvc
class ApiIntegrationTest {

    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    JdbcClient jdbc;
    @Autowired
    LeadRateLimiter rateLimiter;

    private final LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));

    @BeforeEach
    void clean() {
        jdbc.sql("TRUNCATE availability_blocks, leads, properties CASCADE").update();
        rateLimiter.reset();
    }

    @Test
    void adminEndpointsNeedLogin() throws Exception {
        mvc.perform(get("/api/admin/properties")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/properties").with(httpBasic("admin", "wrong"))).andExpect(status().isUnauthorized());
        mvc.perform(admin(get("/api/admin/properties"))).andExpect(status().isOk());
    }

    @Test
    void newListingIsHiddenUntilLive() throws Exception {
        JsonNode created = createProperty("Green Valley", "Chhattarpur", 40);
        String slug = created.get("slug").asText();
        assertThat(slug).isEqualTo("green-valley-chhattarpur");
        assertThat(created.get("status").asText()).isEqualTo("PENDING");
        assertThat(created.get("hostPhone").asText()).isEqualTo("919812345678");

        mvc.perform(get("/api/properties")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/properties/" + slug)).andExpect(status().isNotFound());

        goLive(created);

        mvc.perform(get("/api/properties/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.hostFirstName").value("Ramesh"))
                .andExpect(jsonPath("$.hostPhone").doesNotExist())
                .andExpect(jsonPath("$.hostToken").doesNotExist())
                .andExpect(jsonPath("$.address").doesNotExist());
        mvc.perform(get("/api/areas")).andExpect(jsonPath("$[0]").value("Chhattarpur"));
    }

    @Test
    void duplicateNamesGetUniqueSlugs() throws Exception {
        createProperty("Green Valley", "Chhattarpur", 40);
        JsonNode second = createProperty("Green Valley", "Chhattarpur", 40);
        assertThat(second.get("slug").asText()).isEqualTo("green-valley-chhattarpur-2");
    }

    @Test
    void listingValidationRejectsBadInput() throws Exception {
        Map<String, Object> form = form("No Price", "Sohna Road", 20);
        form.remove("dayUsePriceMin");
        form.remove("nightPriceMin");
        mvc.perform(admin(post("/api/admin/properties")).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(form)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.priceShown").exists());

        Map<String, Object> badPhone = form("Bad Phone", "Sohna Road", 20);
        badPhone.put("hostPhone", "12345");
        mvc.perform(admin(post("/api/admin/properties")).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(badPhone)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Host phone must be a valid Indian mobile number"));
    }

    @Test
    void searchFiltersByAreaGuestsAndDate() throws Exception {
        JsonNode big = goLive(createProperty("Big Lawn", "Chhattarpur", 100));
        JsonNode small = goLive(createProperty("Small Villa", "Chhattarpur", 15));
        goLive(createProperty("Sohna Retreat", "Sohna Road", 60));

        mvc.perform(get("/api/properties").param("area", "chhattarpur")).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/properties").param("area", "Chhattarpur").param("guests", "30"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].slug").value(big.get("slug").asText()));

        LocalDate nye = today.plusDays(20);
        block(big, nye, nye.plusDays(1)).andExpect(status().isCreated());

        mvc.perform(get("/api/properties").param("area", "Chhattarpur").param("date", nye.toString()))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].slug").value(small.get("slug").asText()));
        // A 3-night stay starting the day before still overlaps the block.
        mvc.perform(get("/api/properties").param("area", "Chhattarpur")
                        .param("date", nye.minusDays(1).toString()).param("nights", "3"))
                .andExpect(jsonPath("$.length()").value(1));
        // The day after the block ends is free again.
        mvc.perform(get("/api/properties").param("area", "Chhattarpur").param("date", nye.plusDays(2).toString()))
                .andExpect(jsonPath("$.length()").value(2));

        mvc.perform(get("/api/properties/" + big.get("slug").asText() + "/blocked-dates")
                        .param("from", nye.minusDays(5).toString()).param("to", nye.plusDays(5).toString()))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0]").value(nye.toString()))
                .andExpect(jsonPath("$[1]").value(nye.plusDays(1).toString()));
    }

    @Test
    void overlappingBlocksAreRefusedByTheDatabase() throws Exception {
        JsonNode p = goLive(createProperty("Green Valley", "Chhattarpur", 40));
        LocalDate d = today.plusDays(10);
        block(p, d, d.plusDays(2)).andExpect(status().isCreated());
        block(p, d.plusDays(2), d.plusDays(3))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("These dates are already blocked"));
        block(p, d.plusDays(3), d.plusDays(3)).andExpect(status().isCreated());
    }

    @Test
    void leadReturnsWhatsappLinkAndShowsOnHostPage() throws Exception {
        JsonNode p = goLive(createProperty("Green Valley", "Chhattarpur", 40));
        String slug = p.get("slug").asText();
        LocalDate date = today.plusDays(14);

        JsonNode lead = createLead(slug, date, "NIGHT", 2, 25, "WHATSAPP", status().isCreated());
        String url = lead.get("contactUrl").asText();
        assertThat(url).startsWith("https://wa.me/919812345678?text=");
        assertThat(url).doesNotContain("+");
        assertThat(lead.get("message").asText())
                .startsWith("Hi Ramesh, I found Green Valley on Weekend (ref " + lead.get("reference").asText() + ")")
                .contains("2 nights from")
                .contains("for 25 guests");

        JsonNode call = createLead(slug, date, "DAY_USE", null, 10, "CALL", status().isCreated());
        assertThat(call.get("contactUrl").asText()).isEqualTo("tel:+919812345678");

        String token = p.get("hostToken").asText();
        mvc.perform(get("/api/host/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.total").value(2))
                .andExpect(jsonPath("$.summary.lastThirtyDays").value(2))
                .andExpect(jsonPath("$.leads[0].reference").exists())
                .andExpect(jsonPath("$.property.name").value("Green Valley"));
        mvc.perform(get("/api/host/not-a-real-token")).andExpect(status().isNotFound());
        mvc.perform(admin(get("/api/admin/leads"))).andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void leadValidation() throws Exception {
        JsonNode p = goLive(createProperty("Green Valley", "Chhattarpur", 40));
        String slug = p.get("slug").asText();
        createLead(slug, today.minusDays(1), "DAY_USE", null, 10, "WHATSAPP", status().isBadRequest());
        createLead(slug, today.plusDays(3), "DAY_USE", null, 41, "WHATSAPP", status().isBadRequest());

        LocalDate booked = today.plusDays(5);
        block(p, booked, booked);
        createLead(slug, booked, "EVENT", null, 30, "WHATSAPP", status().isConflict());

        JsonNode pending = createProperty("Hidden Farm", "Chhattarpur", 40);
        createLead(pending.get("slug").asText(), today.plusDays(3), "DAY_USE", null, 10, "WHATSAPP",
                status().isNotFound());
    }

    @Test
    void leadsAreRateLimitedPerIp() throws Exception {
        String slug = goLive(createProperty("Green Valley", "Chhattarpur", 40)).get("slug").asText();
        for (int i = 0; i < 5; i++) {
            createLead(slug, today.plusDays(3), "DAY_USE", null, 10, "WHATSAPP", status().isCreated());
        }
        createLead(slug, today.plusDays(3), "DAY_USE", null, 10, "WHATSAPP", status().isTooManyRequests());
    }

    @Test
    void bookedOutcomeBlocksTheDates() throws Exception {
        JsonNode p = goLive(createProperty("Green Valley", "Chhattarpur", 40));
        String slug = p.get("slug").asText();
        String token = p.get("hostToken").asText();
        LocalDate date = today.plusDays(30);
        String leadId = leadId(token, createLead(slug, date, "NIGHT", 2, 20, "WHATSAPP", status().isCreated()));

        outcome(token, leadId, "BOOKED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lead.status").value("BOOKED"))
                .andExpect(jsonPath("$.datesBlocked").value(true));
        mvc.perform(get("/api/host/" + token))
                .andExpect(jsonPath("$.summary.booked").value(1))
                .andExpect(jsonPath("$.blocks[0].fromDate").value(date.toString()))
                .andExpect(jsonPath("$.blocks[0].toDate").value(date.plusDays(1).toString()))
                .andExpect(jsonPath("$.blocks[0].source").value("DIRECT_CONFIRMED"));
        mvc.perform(get("/api/properties").param("date", date.plusDays(1).toString()))
                .andExpect(jsonPath("$.length()").value(0));

        // Marking it booked twice does not create a second block.
        outcome(token, leadId, "BOOKED").andExpect(jsonPath("$.datesBlocked").value(false));
        outcome(token, leadId, "NEW").andExpect(status().isBadRequest());
    }

    @Test
    void bookedOutcomeOnAlreadyBlockedDatesStillCounts() throws Exception {
        JsonNode p = goLive(createProperty("Green Valley", "Chhattarpur", 40));
        String token = p.get("hostToken").asText();
        LocalDate date = today.plusDays(8);
        String leadId = leadId(token,
                createLead(p.get("slug").asText(), date, "DAY_USE", null, 20, "CALL", status().isCreated()));
        block(p, date, date);
        outcome(token, leadId, "BOOKED")
                .andExpect(jsonPath("$.lead.status").value("BOOKED"))
                .andExpect(jsonPath("$.datesBlocked").value(false))
                .andExpect(jsonPath("$.datesAlreadyBlocked").value(true));
    }

    @Test
    void hostCanRemoveOnlyTheirOwnBlocks() throws Exception {
        JsonNode a = goLive(createProperty("Farm A", "Chhattarpur", 40));
        JsonNode b = goLive(createProperty("Farm B", "Chhattarpur", 40));
        LocalDate d = today.plusDays(4);
        String blockId = json.readTree(block(a, d, d).andReturn().getResponse().getContentAsString())
                .get("id").asText();

        mvc.perform(delete("/api/host/" + b.get("hostToken").asText() + "/blocks/" + blockId))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/host/" + a.get("hostToken").asText() + "/blocks/" + blockId))
                .andExpect(status().isNoContent());
    }

    @Test
    void adminCanEditAndRotateHostLink() throws Exception {
        JsonNode p = createProperty("Green Valley", "Chhattarpur", 40);
        String id = p.get("id").asText();
        Map<String, Object> form = form("Green Valley Farms", "Chhattarpur", 60);
        mvc.perform(admin(put("/api/admin/properties/" + id)).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(form)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Green Valley Farms"))
                .andExpect(jsonPath("$.maxGuests").value(60))
                .andExpect(jsonPath("$.slug").value(p.get("slug").asText()));

        String oldToken = p.get("hostToken").asText();
        mvc.perform(admin(post("/api/admin/properties/" + id + "/rotate-host-link")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/host/" + oldToken)).andExpect(status().isNotFound());
    }

    // --- helpers ---

    private MockHttpServletRequestBuilder admin(MockHttpServletRequestBuilder b) {
        return b.with(httpBasic("admin", "secret"));
    }

    private Map<String, Object> form(String name, String area, int maxGuests) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("name", name);
        m.put("area", area);
        m.put("address", "Farm 12, " + area + ", New Delhi");
        m.put("description", "Lawn, pool and 4 rooms.");
        m.put("houseRules", "Music off by 10 PM.");
        m.put("maxGuests", maxGuests);
        m.put("bedrooms", 4);
        m.put("hasPool", true);
        m.put("amenities", java.util.List.of("Pool", "Lawn", "Parking"));
        m.put("photoUrls", java.util.List.of("https://example.com/1.jpg"));
        m.put("dayUsePriceMin", 15000);
        m.put("dayUsePriceMax", 25000);
        m.put("nightPriceMin", 20000);
        m.put("hostName", "Ramesh Kumar");
        m.put("hostPhone", "+91 98123 45678");
        return m;
    }

    private JsonNode createProperty(String name, String area, int maxGuests) throws Exception {
        String body = mvc.perform(admin(post("/api/admin/properties")).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(form(name, area, maxGuests))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private JsonNode goLive(JsonNode property) throws Exception {
        String body = mvc.perform(admin(post("/api/admin/properties/" + property.get("id").asText() + "/status"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"LIVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verifiedAt").exists())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private org.springframework.test.web.servlet.ResultActions block(JsonNode p, LocalDate from, LocalDate to)
            throws Exception {
        return mvc.perform(post("/api/host/" + p.get("hostToken").asText() + "/blocks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("fromDate", from.toString(), "toDate", to.toString()))));
    }

    private JsonNode createLead(String slug, LocalDate date, String slot, Integer nights, int guests, String channel,
                                org.springframework.test.web.servlet.ResultMatcher expected) throws Exception {
        Map<String, Object> req = new java.util.LinkedHashMap<>();
        req.put("guestName", "Priya");
        req.put("eventDate", date.toString());
        if (nights != null) {
            req.put("nights", nights);
        }
        req.put("guests", guests);
        req.put("slotType", slot);
        req.put("channel", channel);
        String body = mvc.perform(post("/api/properties/" + slug + "/leads").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(expected)
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    private String leadId(String token, JsonNode lead) throws Exception {
        JsonNode view = json.readTree(mvc.perform(get("/api/host/" + token)).andReturn().getResponse()
                .getContentAsString());
        for (JsonNode l : view.get("leads")) {
            if (l.get("reference").asText().equals(lead.get("reference").asText())) {
                return l.get("id").asText();
            }
        }
        throw new AssertionError("lead not found");
    }

    private org.springframework.test.web.servlet.ResultActions outcome(String token, String leadId, String status)
            throws Exception {
        return mvc.perform(post("/api/host/" + token + "/leads/" + leadId + "/outcome")
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + status + "\"}"));
    }
}
