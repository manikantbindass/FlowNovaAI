package ai.flownova;

import java.util.*;
import org.springframework.scheduling.annotation.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

@Configuration @EnableScheduling
class Scheduling {}

@Component
class ExecutionWorker {
    final WorkflowService s;final Graphs graphs;final AiProvider ai;final TransactionTemplate tx;
    ExecutionWorker(WorkflowService s,Graphs graphs,AiProvider ai,TransactionTemplate tx){this.s=s;this.graphs=graphs;this.ai=ai;this.tx=tx;}
    @Scheduled(fixedDelayString="${flownova.worker.interval:250}")
    void tick(){
        long now=System.currentTimeMillis();
        s.jdbc().update("UPDATE execution SET status='FAILED',error='Worker recovery limit exceeded',finished_at=? WHERE status='RUNNING' AND lease_until<? AND attempt>=3",now,now);
        s.jdbc().update("UPDATE execution SET status='QUEUED',claim_token=NULL WHERE status='RUNNING' AND lease_until<? AND attempt<3",now);
        var queue=s.jdbc().queryForList("SELECT id FROM execution WHERE status='QUEUED' ORDER BY created_at LIMIT 1");if(queue.isEmpty())return;
        String id=(String)queue.getFirst().get("id"),claim=WorkflowService.id();
        int claimed=s.jdbc().update("UPDATE execution SET status='RUNNING',started_at=COALESCE(started_at,?),lease_until=?,claim_token=?,attempt=attempt+1 WHERE id=? AND status='QUEUED'",now,now+60000,claim,id);if(claimed!=1)return;
        try{run(id,claim);}catch(Cancelled ignored){}catch(Exception e){String message=e instanceof IllegalStateException?e.getMessage():"Node execution failed; inspect configuration and provider connectivity";finish(id,claim,"FAILED",message);}
    }
    void active(String id,String claim){var rows=s.jdbc().queryForList("SELECT status,started_at,claim_token FROM execution WHERE id=?",id);if(rows.isEmpty()||!rows.getFirst().get("status").equals("RUNNING")||!claim.equals(rows.getFirst().get("claim_token")))throw new Cancelled();if(System.currentTimeMillis()-((Number)rows.getFirst().get("started_at")).longValue()>120000){finish(id,claim,"TIMED_OUT","Workflow exceeded 120 seconds");throw new Cancelled();}s.jdbc().update("UPDATE execution SET lease_until=? WHERE id=? AND claim_token=? AND status='RUNNING'",System.currentTimeMillis()+60000,id,claim);}
    void run(String id,String claim)throws Exception{
        var row=s.jdbc().queryForMap("SELECT e.input,v.graph FROM execution e JOIN workflow_version v ON v.workflow_id=e.workflow_id AND v.version=e.version WHERE e.id=?",id);
        var graph=graphs.parse((String)row.get("graph"));if(!graphs.validate(graph).isEmpty())throw new IllegalStateException("Published graph is invalid");
        var nodes=new LinkedHashMap<String,JsonNode>();graph.path("nodes").forEach(n->nodes.put(n.path("id").asText(),n));
        var outputs=new HashMap<String,JsonNode>();var statuses=new HashMap<String,String>();
        for(var checkpoint:s.jdbc().queryForList("SELECT node_id,status,output FROM node_execution WHERE execution_id=?",id)){String n=(String)checkpoint.get("node_id");outputs.put(n,graphs.parse((String)checkpoint.get("output")));statuses.put(n,(String)checkpoint.get("status"));}
        while(statuses.size()<nodes.size()){
            boolean progress=false;
            for(var entry:nodes.entrySet()){
                String nodeId=entry.getKey();var node=entry.getValue();if(statuses.containsKey(nodeId))continue;
                var incoming=new ArrayList<JsonNode>();graph.path("edges").forEach(e->{if(e.path("target").asText().equals(nodeId))incoming.add(e);});
                if(!incoming.isEmpty()&&!statuses.containsKey(incoming.getFirst().path("source").asText()))continue;
                active(id,claim);boolean skip=false;JsonNode input=graphs.parse((String)row.get("input"));
                if(!incoming.isEmpty()){
                    var edge=incoming.getFirst();String source=edge.path("source").asText();input=outputs.get(source);
                    skip=statuses.get(source).equals("SKIPPED");
                    if(Graphs.type(nodes.get(source)).equals("condition"))skip=skip||!edge.path("sourceHandle").asText().equals(input.path("matched").asBoolean()?"true":"false");
                }
                long start=System.currentTimeMillis();String state=skip?"SKIPPED":"SUCCEEDED";
                s.event(id,nodeId,skip?"SKIPPED":"NODE_STARTED",skip?"Branch skipped":"Node started");
                JsonNode output=skip?Graphs.JSON.createObjectNode():executeNode(id,claim,node,input);
                output=graphs.redact(output);if(graphs.stringify(output).length()>32768)throw new IllegalStateException("Node output exceeded 32 KB");
                final JsonNode result=output;final boolean skipped=skip;
                tx.executeWithoutResult(t->{
                    // Lock the execution row so cancellation cannot interleave with checkpoint persistence.
                    s.jdbc().queryForList("SELECT id FROM execution WHERE id=? FOR UPDATE",id);active(id,claim);
                    s.jdbc().update("INSERT INTO node_execution VALUES (?,?,?,?,?,?)",id,nodeId,state,graphs.stringify(result),start,System.currentTimeMillis());
                    s.event(id,nodeId,state,skipped?"Branch skipped":"Node completed");
                });
                outputs.put(nodeId,output);statuses.put(nodeId,state);progress=true;
            }
            if(!progress)throw new IllegalStateException("Graph could not make progress");
        }
        active(id,claim);finish(id,claim,"SUCCEEDED",null);
    }
    JsonNode executeNode(String id,String claim,JsonNode node,JsonNode input)throws Exception{
        var config=Graphs.config(node);
        return switch(Graphs.type(node)){
            case "manual" -> input;
            case "transform" -> {var output=Graphs.JSON.createObjectNode();config.path("mapping").properties().forEach(e->output.set(e.getKey(),e.getValue().isTextual()&&e.getValue().asText().startsWith("$.")?graphs.resolve(input,e.getValue().asText()):e.getValue()));yield output;}
            case "condition" -> Graphs.JSON.valueToTree(Map.of("matched",graphs.resolve(input,config.path("path").asText()).equals(config.path("equals")),"data",input));
            case "delay" -> {long until=System.currentTimeMillis()+config.path("milliseconds").asInt();while(System.currentTimeMillis()<until){active(id,claim);Thread.sleep(Math.min(100,Math.max(1,until-System.currentTimeMillis())));}yield input;}
            case "ai" -> ai.complete(config.path("prompt").asText(),input);
            case "assert" -> {if(!graphs.resolve(input,config.path("path").asText()).equals(config.path("equals")))throw new IllegalStateException("Assertion failed: required data condition was not met");yield input;}
            case "collection" -> {
                var items=graphs.resolve(input,config.path("path").asText());if(!items.isArray()||items.size()>1000)throw new IllegalStateException("Collection input must be an array with at most 1000 items");
                var selected=Graphs.JSON.createArrayNode();String op=config.path("operation").asText();int total=0,limit=config.path("limit").asInt(100);
                for(var item:items){boolean include=!op.equals("filter")||graphs.resolve(item,"$."+config.path("field").asText()).equals(config.path("equals"));if(include){total++;if(selected.size()<limit&&!op.equals("count"))selected.add(op.equals("pluck")?graphs.resolve(item,"$."+config.path("field").asText()):item);}}
                yield Graphs.JSON.valueToTree(Map.of("items",selected,"total",total,"returned",selected.size()));
            }
            default -> throw new IllegalStateException("Unsupported node type");
        };
    }
    void finish(String id,String claim,String status,String error){tx.executeWithoutResult(t->{if(s.jdbc().update("UPDATE execution SET status=?,error=?,finished_at=?,lease_until=NULL WHERE id=? AND claim_token=? AND status='RUNNING'",status,error,System.currentTimeMillis(),id,claim)==1)s.event(id,null,status,error==null?"Execution completed":error);});}
    static class Cancelled extends RuntimeException{}
}
