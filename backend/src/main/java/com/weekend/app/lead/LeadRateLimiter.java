package com.weekend.app.lead;

import com.weekend.app.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Limits contact requests per IP address per hour, so nobody can collect every host's number.
 * In memory: fine for one server in the pilot; move to Redis or the database when running several.
 */
@Component
public class LeadRateLimiter {

    private static final Duration WINDOW = Duration.ofHours(1);

    private final int maxPerWindow;
    private final Clock clock;
    private final Map<String, Deque<Instant>> hits = new ConcurrentHashMap<>();

    @Autowired
    public LeadRateLimiter(AppProperties props) {
        this(props.leads().maxPerHourPerIp(), Clock.systemUTC());
    }

    LeadRateLimiter(int maxPerWindow, Clock clock) {
        this.maxPerWindow = maxPerWindow;
        this.clock = clock;
    }

    /** Records a hit and returns false when the caller is over the limit. */
    public boolean tryAcquire(String key) {
        Instant now = clock.instant();
        Instant cutoff = now.minus(WINDOW);
        Deque<Instant> deque = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                deque.pollFirst();
            }
            if (deque.size() >= maxPerWindow) {
                return false;
            }
            deque.addLast(now);
        }
        if (hits.size() > 50_000) {
            hits.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    return e.getValue().isEmpty() || e.getValue().peekLast().isBefore(cutoff);
                }
            });
        }
        return true;
    }

    public void reset() {
        hits.clear();
    }
}
