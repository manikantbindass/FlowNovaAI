package ai.flownova;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class GraphTests {
    Graphs graphs=new Graphs();
    @Test void rejectsCyclesAndMissingTrigger(){assertFalse(graphs.validate(graphs.parse("{\"nodes\":[{\"id\":\"x\",\"data\":{\"kind\":\"transform\",\"schemaVersion\":1,\"config\":{\"mapping\":{}}}}],\"edges\":[{\"source\":\"x\",\"target\":\"x\"}]}")).isEmpty());}
    @Test void rejectsMalformedGraph(){assertFalse(graphs.validate(graphs.parse("{}")).isEmpty());}
    @Test void redactsNestedSecrets(){String result=graphs.stringify(graphs.redact(graphs.parse("{\"nested\":[{\"authorization\":\"secret\",\"api_key\":\"private\",\"safe\":\"ok\"}]}")));assertFalse(result.contains("secret"));assertFalse(result.contains("private"));assertTrue(result.contains("ok"));}
    @Test void missingPathIsNull(){assertTrue(graphs.resolve(graphs.parse("{}"),"$.missing.key").isNull());}
    @Test void aiWithoutCredentialsFailsHonestly(){var ai=new AiProvider("","unused",graphs);assertFalse(ai.configured());var e=assertThrows(IllegalStateException.class,()->ai.complete("test",graphs.parse("{}")));assertTrue(e.getMessage().contains("not configured"));}
}
