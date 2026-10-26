package ai.flownova;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration @Profile("!production")
class LocalSeed {
    @Bean ApplicationRunner seed(JdbcTemplate db) {
        return args -> {
            if (db.queryForObject("SELECT COUNT(*) FROM workspace", Integer.class) != 0) return;
            db.update("INSERT INTO workspace VALUES (?,?)", "local-workspace", "Nova workspace");
            db.update("INSERT INTO workspace VALUES (?,?)", "other-workspace", "Isolated workspace");
            db.update("INSERT INTO membership VALUES (?,?,?)", "demo", "local-workspace", "OWNER");
            db.update("INSERT INTO membership VALUES (?,?,?)", "viewer", "local-workspace", "VIEWER");
            db.update("INSERT INTO membership VALUES (?,?,?)", "other", "other-workspace", "OWNER");
        };
    }
}
