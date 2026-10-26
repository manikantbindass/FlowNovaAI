package ai.flownova;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class SecurityConfig {
    @Bean @Profile("!production")
    UserDetailsService localUsers(@Value("${flownova.local.password}") String password) {
        var encoder = new BCryptPasswordEncoder();
        return new InMemoryUserDetailsManager(
            User.withUsername("demo").password("{bcrypt}" + encoder.encode(password)).roles("USER").build(),
            User.withUsername("other").password("{bcrypt}" + encoder.encode(password)).roles("USER").build(),
            User.withUsername("viewer").password("{bcrypt}" + encoder.encode(password)).roles("USER").build());
    }
    @Bean @Profile("!production")
    SecurityFilterChain local(HttpSecurity http) throws Exception {
        return http.authorizeHttpRequests(a -> a.requestMatchers("/api/v1/auth/session", "/actuator/health", "/error").permitAll().anyRequest().authenticated())
            .formLogin(f -> f.loginProcessingUrl("/api/v1/auth/login")
                .successHandler((q,s,a) -> {s.setStatus(200);s.setContentType("application/json");s.getWriter().write("{\"authenticated\":true}");})
                .failureHandler((q,s,e) -> {s.setStatus(401);s.setContentType("application/json");s.getWriter().write("{\"message\":\"Invalid username or password\"}");}))
            .logout(l -> l.logoutUrl("/api/v1/auth/logout").logoutSuccessHandler((q,s,a) -> s.setStatus(204)))
            .exceptionHandling(e -> e.authenticationEntryPoint((q,s,x) -> s.sendError(401)).accessDeniedHandler((q,s,x) -> s.sendError(403)))
            .build();
    }
    @Bean @Profile("production")
    SecurityFilterChain production(HttpSecurity http) throws Exception {
        return http.csrf(c -> c.disable()).sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a.requestMatchers("/actuator/health", "/api/v1/auth/session").permitAll().anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(j -> {})).build();
    }
}
