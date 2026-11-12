package com.weekend.app.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app")
public record AppProperties(String brandName, Admin admin, Leads leads) {

    public record Admin(String username, String password) {
    }

    public record Leads(int maxPerHourPerIp) {
    }
}
