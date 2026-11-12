package com.weekend.app.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * In production the React app is bundled into the jar (classpath:/static). Its page addresses
 * (/farmhouse/..., /host/..., /admin) are handled in the browser, so the server answers them
 * with index.html and lets React pick the page.
 */
@Controller
public class SpaController {

    @GetMapping({"/farmhouse/**", "/host/**", "/admin", "/admin/**"})
    public String app() {
        return "forward:/index.html";
    }
}
