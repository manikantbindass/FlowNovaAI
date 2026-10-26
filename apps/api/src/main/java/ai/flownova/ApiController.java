package ai.flownova;

import java.security.Principal;
import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@RestController @RequestMapping("/api/v1")
class ApiController {
    final WorkflowService service;final Graphs graphs;final Environment env;final AiProvider ai;
    ApiController(WorkflowService service,Graphs graphs,Environment env,AiProvider ai){this.service=service;this.graphs=graphs;this.env=env;this.ai=ai;}
    @GetMapping("/auth/session") Map<String,Object> session(Principal principal,HttpServletRequest request){var result=new LinkedHashMap<String,Object>();result.put("authenticated",principal!=null);result.put("username",principal==null?"":principal.getName());result.put("mode",env.matchesProfiles("production")?"oidc":"local");var csrf=(CsrfToken)request.getAttribute(CsrfToken.class.getName());if(csrf!=null){result.put("csrf",csrf.getToken());result.put("csrfHeader",csrf.getHeaderName());}return result;}
    @GetMapping("/workspaces") Object workspaces(Principal p){return service.workspaces(p.getName());}
    @GetMapping("/workspaces/{w}/workflows") Object list(Principal p,@PathVariable String w,@RequestParam(defaultValue="30")int limit,@RequestParam(defaultValue="0")int offset){return service.list(p.getName(),w,bound(limit),Math.max(0,offset));}
    @PostMapping("/workspaces/{w}/workflows") @ResponseStatus(HttpStatus.CREATED) Object create(Principal p,@PathVariable String w,@RequestBody WorkflowService.Save save){return service.create(p.getName(),w,save);}
    @GetMapping("/workspaces/{w}/workflows/{id}") Object get(Principal p,@PathVariable String w,@PathVariable String id){return service.get(p.getName(),w,id);}
    @PutMapping("/workspaces/{w}/workflows/{id}") Object save(Principal p,@PathVariable String w,@PathVariable String id,@RequestBody WorkflowService.Save save){return service.save(p.getName(),w,id,save);}
    @PostMapping("/workspaces/{w}/workflows/{id}/validate") Object validate(Principal p,@PathVariable String w,@PathVariable String id){return Map.of("issues",graphs.validate(service.get(p.getName(),w,id).graph()));}
    @PostMapping("/workspaces/{w}/workflows/{id}/publish") Object publish(Principal p,@PathVariable String w,@PathVariable String id,@RequestBody Map<String,Integer> body){return service.publish(p.getName(),w,id,body.getOrDefault("revision",-1));}
    @GetMapping("/workspaces/{w}/workflows/{id}/versions") Object versions(Principal p,@PathVariable String w,@PathVariable String id){return service.versions(p.getName(),w,id);}
    @GetMapping("/workspaces/{w}/workflows/{id}/versions/{version}") Object version(Principal p,@PathVariable String w,@PathVariable String id,@PathVariable int version){return service.version(p.getName(),w,id,version);}
    @PostMapping("/workspaces/{w}/workflows/{id}/versions/{version}/restore") Object restore(Principal p,@PathVariable String w,@PathVariable String id,@PathVariable int version,@RequestBody Map<String,Integer> body){return service.restore(p.getName(),w,id,version,body.getOrDefault("revision",-1));}
    @PostMapping("/workspaces/{w}/workflows/{id}/execute") @ResponseStatus(HttpStatus.ACCEPTED) Object execute(Principal p,@PathVariable String w,@PathVariable String id,@RequestHeader("Idempotency-Key")String key,@RequestBody JsonNode input){return service.execute(p.getName(),w,id,input,key);}
    @GetMapping("/workspaces/{w}/executions") Object runs(Principal p,@PathVariable String w,@RequestParam(defaultValue="30")int limit,@RequestParam(defaultValue="0")int offset){return service.executions(p.getName(),w,bound(limit),Math.max(0,offset));}
    @GetMapping("/workspaces/{w}/executions/{id}") Object detail(Principal p,@PathVariable String w,@PathVariable String id){return service.detail(p.getName(),w,id);}
    @PostMapping("/workspaces/{w}/executions/{id}/cancel") @ResponseStatus(HttpStatus.NO_CONTENT) void cancel(Principal p,@PathVariable String w,@PathVariable String id){service.cancel(p.getName(),w,id);}
    @GetMapping("/workspaces/{w}/analytics/overview") Object analytics(Principal p,@PathVariable String w){return service.analytics(p.getName(),w);}
    @GetMapping("/workspaces/{w}/audit-logs") Object audit(Principal p,@PathVariable String w){service.access(p.getName(),w,false);return service.jdbc().queryForList("SELECT actor,action,resource_id,created_at FROM audit_log WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100",w);}
    @GetMapping("/capabilities") Object capabilities(){return Map.of("nodes",Graphs.TYPES,"aiConfigured",ai.configured(),"aiModel",ai.model,"planned",List.of("http","webhook","schedule","slack","github","rag","billing","oidc-browser-login"));}
    int bound(int n){return Math.clamp(n,1,100);}
}

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ResponseStatusException.class) ResponseEntity<?> status(ResponseStatusException ex){return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message",Objects.toString(ex.getReason(),"Request failed"),"status",ex.getStatusCode().value()));}
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,org.springframework.web.bind.MissingRequestHeaderException.class}) ResponseEntity<?> malformed(Exception ex){return ResponseEntity.badRequest().body(Map.of("message","Malformed request body or missing required header","status",400));}
    @ExceptionHandler(Exception.class) ResponseEntity<?> other(Exception ex){return ResponseEntity.status(500).body(Map.of("message","The request could not be completed. Check API diagnostics.","status",500));}
}
