package ai.flownova;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:context;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "flownova.worker.interval=1000000"})
class FlowNovaApplicationTests {

	@Test
	void contextLoads() {
	}

}
