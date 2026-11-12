package com.weekend.app.property;

public enum PropertyStatus {
    /** Added by the team, not yet verified: hidden from guests. */
    PENDING,
    /** Verified and visible to guests. */
    LIVE,
    /** Temporarily hidden, e.g. the host asked or broke the founding-host rules. */
    PAUSED
}
