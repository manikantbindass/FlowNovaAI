package ai.flownova;

import java.util.*;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
class Graphs {
    static final JsonMapper JSON = JsonMapper.builder().build();
    static final Set<String> TYPES = Set.of("manual", "transform", "condition", "delay", "ai", "collection", "assert");
    record Issue(String nodeId, String message) {}
    JsonNode parse(String value) { return JSON.readTree(value); }
    String stringify(Object value) { return JSON.writeValueAsString(value); }
    List<Issue> validate(JsonNode graph) {
        var errors = new ArrayList<Issue>();
        if (graph == null || !graph.isObject() || !graph.path("nodes").isArray() || !graph.path("edges").isArray()) return List.of(new Issue(null,"Graph must contain nodes and edges arrays"));
        if (graph.path("nodes").size() < 1 || graph.path("nodes").size() > 50 || graph.path("edges").size() > 100) return List.of(new Issue(null,"Use 1–50 nodes and at most 100 edges"));
        var nodes = new LinkedHashMap<String, JsonNode>();
        for (var n : graph.path("nodes")) {
            String id = n.path("id").asText(""); String type = type(n); var c = config(n);
            if (!id.matches("[a-zA-Z0-9_-]{1,64}") || nodes.put(id,n) != null) errors.add(new Issue(id,"Node IDs must be unique and use letters, numbers, underscores or hyphens"));
            if (!TYPES.contains(type)) errors.add(new Issue(id,"Unsupported node type: " + type));
            if (!c.isObject()) errors.add(new Issue(id,"Node configuration must be an object"));
            if (n.path("data").path("schemaVersion").asInt(0) != 1) errors.add(new Issue(id,"Unsupported node schema version"));
            if (type.equals("transform") && (!c.path("mapping").isObject() || c.path("mapping").size() > 40)) errors.add(new Issue(id,"Transform requires an object mapping with at most 40 keys"));
            if (type.equals("delay") && (!c.path("milliseconds").isIntegralNumber() || c.path("milliseconds").asInt(-1) < 0 || c.path("milliseconds").asInt() > 10000)) errors.add(new Issue(id,"Delay must be an integer from 0 to 10000 ms"));
            if (type.equals("condition") && (!c.path("path").asText("").matches("\\$\\.[a-zA-Z0-9_.-]{1,100}") || !c.has("equals"))) errors.add(new Issue(id,"Condition requires a $.path and equals value"));
            if (type.equals("assert") && (!c.path("path").asText("").matches("\\$\\.[a-zA-Z0-9_.-]{1,100}") || !c.has("equals"))) errors.add(new Issue(id,"Assertion requires a $.path and equals value"));
            if (type.equals("collection") && (!c.path("path").asText("").startsWith("$.") || !Set.of("filter","pluck","take","count").contains(c.path("operation").asText()) || c.path("limit").asInt(100) < 1 || c.path("limit").asInt(100) > 100)) errors.add(new Issue(id,"Collection requires a $.path, filter/pluck/take/count operation, and limit 1–100"));
            if (type.equals("collection") && Set.of("filter","pluck").contains(c.path("operation").asText()) && !c.path("field").asText("").matches("[a-zA-Z0-9_.-]{1,100}")) errors.add(new Issue(id,"Collection filter/pluck requires a field path"));
            if (type.equals("collection") && c.path("operation").asText().equals("filter") && !c.has("equals")) errors.add(new Issue(id,"Collection filter requires an equals value"));
            if (type.equals("ai") && (c.path("prompt").asText("").isBlank() || c.path("prompt").asText().length() > 4000)) errors.add(new Issue(id,"AI requires a prompt up to 4000 characters"));
        }
        var triggers = nodes.values().stream().filter(n -> type(n).equals("manual")).toList();
        if (triggers.size() != 1) errors.add(new Issue(null,"Exactly one manual trigger is required"));
        var adjacency = new HashMap<String,List<String>>(); var incoming = new HashMap<String,Integer>(); var handles = new HashSet<String>();
        for (var e : graph.path("edges")) {
            String s = e.path("source").asText(), t = e.path("target").asText();
            if (!nodes.containsKey(s) || !nodes.containsKey(t)) {errors.add(new Issue(null,"Edge references a missing node"));continue;}
            if (type(nodes.get(t)).equals("manual")) errors.add(new Issue(t,"Triggers cannot have incoming edges"));
            if (incoming.merge(t,1,Integer::sum) > 1) errors.add(new Issue(t,"Joins are not supported in schema v1"));
            String h = e.path("sourceHandle").asText("");
            if (type(nodes.get(s)).equals("condition")) {if (!Set.of("true","false").contains(h)) errors.add(new Issue(s,"Condition edges require true/false handles"));}
            else if (!h.isEmpty()) errors.add(new Issue(s,"Only condition nodes have named output handles"));
            if (!handles.add(s+":"+h)) errors.add(new Issue(s,"Use at most one edge per output handle"));
            adjacency.computeIfAbsent(s,k->new ArrayList<>()).add(t);
        }
        var degrees = new HashMap<String,Integer>(); nodes.keySet().forEach(id -> degrees.put(id,0));
        adjacency.values().forEach(list -> list.forEach(id -> degrees.merge(id,1,Integer::sum)));
        var q = new ArrayDeque<String>(); degrees.forEach((id,d)->{if(d==0)q.add(id);}); int visited=0;
        while(!q.isEmpty()){String id=q.remove();visited++;for(String t:adjacency.getOrDefault(id,List.of()))if(degrees.merge(t,-1,Integer::sum)==0)q.add(t);}
        if(visited!=nodes.size()) errors.add(new Issue(null,"Cycles are not supported"));
        if(triggers.size()==1){var reached=new HashSet<String>();q.add(triggers.getFirst().path("id").asText());while(!q.isEmpty()){String id=q.remove();if(reached.add(id))q.addAll(adjacency.getOrDefault(id,List.of()));}nodes.keySet().stream().filter(id->!reached.contains(id)).forEach(id->errors.add(new Issue(id,"Node is disconnected from the trigger")));}
        return errors;
    }
    static String type(JsonNode node) { return node.path("data").path("kind").asText(""); }
    static JsonNode config(JsonNode node) { return node.path("data").path("config"); }
    JsonNode resolve(JsonNode input, String path) {
        if (!path.startsWith("$.")) return JSON.valueToTree(path);
        JsonNode result=input; for(String key:path.substring(2).split("\\."))result=result.path(key);
        return result.isMissingNode()? JSON.nullNode():result;
    }
    JsonNode redact(JsonNode value) {
        if(value.isObject()){var out=JSON.createObjectNode();value.properties().forEach(e->out.set(e.getKey(),e.getKey().toLowerCase().matches(".*(secret|password|token|authorization|api.?key|cookie).* ".trim())?JSON.valueToTree("[REDACTED]"):redact(e.getValue())));return out;}
        if(value.isArray()){var out=JSON.createArrayNode();value.forEach(v->out.add(redact(v)));return out;}
        return value;
    }
}
