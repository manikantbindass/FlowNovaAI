package ai.flownova;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@SpringBootTest(properties={"spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:integration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1}","flownova.worker.interval=1000000"})
class WorkflowIntegrationTests {
    @Autowired WorkflowService service;@Autowired Graphs graphs;@Autowired ExecutionWorker worker;
    JsonNode graph(){return graphs.parse("""
        {"nodes":[
          {"id":"start","type":"step","data":{"kind":"manual","schemaVersion":1,"config":{}}},
          {"id":"map","type":"step","data":{"kind":"transform","schemaVersion":1,"config":{"mapping":{"greeting":"$.message","ready":true}}}}
        ],"edges":[{"id":"e","source":"start","target":"map"}]}
        """);}
    WorkflowService.Workflow create(JsonNode g){return service.create("demo","local-workspace",new WorkflowService.Save("Test "+UUID.randomUUID(),"",g,0));}
    void denied(Runnable fn,int expected){var ex=assertThrows(ResponseStatusException.class,fn::run);assertEquals(expected,ex.getStatusCode().value());}
    WorkflowService.Execution queue(WorkflowService.Workflow f,String key){return service.execute("demo","local-workspace",f.id(),graphs.parse("{\"message\":\"Hello\",\"apiKey\":\"do-not-record\"}"),key);}
    @Test void savePublishExecuteAndPreserveSnapshot(){
        var draft=create(graph());assertEquals(1,draft.revision());
        var published=service.publish("demo","local-workspace",draft.id(),draft.revision());assertEquals(1,published.publishedVersion());
        var changed=graphs.parse(graphs.stringify(graph()));((tools.jackson.databind.node.ObjectNode)changed.path("nodes").path(1).path("data").path("config").path("mapping")).put("greeting","Changed draft");
        service.save("demo","local-workspace",draft.id(),new WorkflowService.Save("Renamed","",changed,1));
        var run=queue(published,UUID.randomUUID().toString());worker.tick();var detail=service.detail("demo","local-workspace",run.id());
        assertEquals("SUCCEEDED",service.execution("demo","local-workspace",run.id()).status());
        assertTrue(graphs.stringify(detail.get("nodes")).contains("Hello"));assertFalse(graphs.stringify(detail).contains("do-not-record"));
        assertEquals(1,service.execution("demo","local-workspace",run.id()).version());
    }
    @Test void concurrentDraftRevisionIsRejected(){var f=create(graph());service.save("demo","local-workspace",f.id(),new WorkflowService.Save("New name","",f.graph(),1));denied(()->service.save("demo","local-workspace",f.id(),new WorkflowService.Save("Stale","",f.graph(),1)),409);denied(()->service.publish("demo","local-workspace",f.id(),1),409);}
    @Test void crossTenantAndViewerAccessDenied(){var f=create(graph());denied(()->service.get("other","local-workspace",f.id()),404);denied(()->service.save("other","other-workspace",f.id(),new WorkflowService.Save("Attack","",graph(),1)),404);denied(()->service.publish("viewer","local-workspace",f.id(),1),403);denied(()->queueAsOther(f),404);denied(()->service.create("viewer","local-workspace",new WorkflowService.Save("No","",graph(),0)),403);service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());denied(()->service.execution("other","other-workspace",run.id()),404);denied(()->service.cancel("other","other-workspace",run.id()),404);service.cancel("demo","local-workspace",run.id());}
    void queueAsOther(WorkflowService.Workflow f){service.execute("other","other-workspace",f.id(),graphs.parse("{}"),UUID.randomUUID().toString());}
    @Test void idempotencyPreventsDuplicateJobs(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);String key=UUID.randomUUID().toString();var a=queue(f,key);var b=queue(f,key);assertEquals(a.id(),b.id());service.cancel("demo","local-workspace",a.id());}
    @Test void invalidAndUnsafeNodesCannotPublish(){var g=graph();((tools.jackson.databind.node.ObjectNode)g.path("nodes").path(1).path("data")).put("kind","http");var f=create(g);denied(()->service.publish("demo","local-workspace",f.id(),1),422);}
    @Test void cancellationStopsClaimingAndKeepsTerminalState(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());service.cancel("demo","local-workspace",run.id());worker.tick();assertEquals("CANCELLED",service.execution("demo","local-workspace",run.id()).status());denied(()->service.cancel("demo","local-workspace",run.id()),409);}
    @Test void staleWorkerLeaseRecoversPersistedJob(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());service.jdbc().update("UPDATE execution SET status='RUNNING',lease_until=0,claim_token='old',attempt=1 WHERE id=?",run.id());worker.tick();assertEquals("SUCCEEDED",service.execution("demo","local-workspace",run.id()).status());}
    @Test void staleLeasesHaveABoundedRecoveryLimit(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());service.jdbc().update("UPDATE execution SET status='RUNNING',lease_until=0,claim_token='old',attempt=3 WHERE id=?",run.id());worker.tick();assertEquals("FAILED",service.execution("demo","local-workspace",run.id()).status());}
    @Test void nodeCheckpointsResumeWithoutRepeatingCompletedNodes(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());long now=System.currentTimeMillis();service.jdbc().update("INSERT INTO node_execution VALUES (?,?,?,?,?,?)",run.id(),"start","SUCCEEDED","{\"message\":\"Checkpoint\"}",now,now);worker.tick();assertEquals("SUCCEEDED",service.execution("demo","local-workspace",run.id()).status());assertTrue(graphs.stringify(service.detail("demo","local-workspace",run.id())).contains("Checkpoint"));}
    @Test void workflowDeadlineIsEnforced(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());service.jdbc().update("UPDATE execution SET started_at=? WHERE id=?",System.currentTimeMillis()-130000,run.id());worker.tick();assertEquals("TIMED_OUT",service.execution("demo","local-workspace",run.id()).status());}
    @Test void restoringVersionCreatesNewDraftAndPreservesSnapshots(){var f=create(graph());service.publish("demo","local-workspace",f.id(),1);service.save("demo","local-workspace",f.id(),new WorkflowService.Save("Changed","",graphs.parse("{\"nodes\":[],\"edges\":[]}"),1));var restored=service.restore("demo","local-workspace",f.id(),1,2);assertEquals(3,restored.revision());assertEquals(graph(),restored.graph());assertEquals(1,restored.publishedVersion());denied(()->service.restore("viewer","local-workspace",f.id(),1,3),403);denied(()->service.version("other","other-workspace",f.id(),1),404);}
    @Test void collectionFilterAndAssertionExecute(){var g=graph();var node=(tools.jackson.databind.node.ObjectNode)g.path("nodes").path(1).path("data");node.put("kind","collection");node.set("config",graphs.parse("{\"path\":\"$.items\",\"operation\":\"filter\",\"field\":\"status\",\"equals\":\"active\",\"limit\":1}"));var f=create(g);service.publish("demo","local-workspace",f.id(),1);var run=service.execute("demo","local-workspace",f.id(),graphs.parse("{\"items\":[{\"status\":\"active\",\"name\":\"A\"},{\"status\":\"inactive\"},{\"status\":\"active\",\"name\":\"B\"}]}"),UUID.randomUUID().toString());worker.tick();assertEquals("SUCCEEDED",service.execution("demo","local-workspace",run.id()).status());String output=service.jdbc().queryForObject("SELECT output FROM node_execution WHERE execution_id=? AND node_id='map'",String.class,run.id());assertEquals(2,graphs.parse(output).path("total").asInt());assertEquals(1,graphs.parse(output).path("returned").asInt());}
    @Test void assertionFailsWithoutLeakingInput(){var g=graph();var node=(tools.jackson.databind.node.ObjectNode)g.path("nodes").path(1).path("data");node.put("kind","assert");node.set("config",graphs.parse("{\"path\":\"$.approved\",\"equals\":true}"));var f=create(g);service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());worker.tick();assertEquals("FAILED",service.execution("demo","local-workspace",run.id()).status());assertTrue(service.execution("demo","local-workspace",run.id()).error().contains("Assertion failed"));}
    @Test void branchesSkipTheUnselectedPath(){var g=graphs.parse("""
        {"nodes":[{"id":"start","data":{"kind":"manual","schemaVersion":1,"config":{}}},{"id":"check","data":{"kind":"condition","schemaVersion":1,"config":{"path":"$.message","equals":"Hello"}}},{"id":"yes","data":{"kind":"transform","schemaVersion":1,"config":{"mapping":{"route":"yes"}}}},{"id":"no","data":{"kind":"transform","schemaVersion":1,"config":{"mapping":{"route":"no"}}}}],"edges":[{"source":"start","target":"check"},{"source":"check","sourceHandle":"true","target":"yes"},{"source":"check","sourceHandle":"false","target":"no"}]}
        """);var f=create(g);service.publish("demo","local-workspace",f.id(),1);var run=queue(f,UUID.randomUUID().toString());worker.tick();assertEquals("SUCCEEDED",service.execution("demo","local-workspace",run.id()).status());assertEquals("SKIPPED",service.jdbc().queryForObject("SELECT status FROM node_execution WHERE execution_id=? AND node_id='no'",String.class,run.id()));}
}
