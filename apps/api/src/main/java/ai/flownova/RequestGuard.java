package ai.flownova;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounded request bodies, process-local abuse limits, and safe correlation identifiers. */
@Component @Order(-200)
class RequestGuard extends OncePerRequestFilter {
    record Window(long minute,int count){}
    private final ConcurrentHashMap<String,Window> windows=new ConcurrentHashMap<>();
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException{
        String requestId=UUID.randomUUID().toString();response.setHeader("X-Request-ID",requestId);response.setHeader("Cache-Control","no-store");
        String key=request.getRemoteAddr()+(request.getRequestURI().equals("/api/v1/auth/login")?":login":":api");long minute=System.currentTimeMillis()/60000;
        if(windows.size()>10000)windows.entrySet().removeIf(e->e.getValue().minute()<minute);
        if(windows.size()>10000){reject(response,429,"API rate limit reached");return;}
        int count=windows.compute(key,(k,v)->v==null||v.minute()!=minute?new Window(minute,1):new Window(minute,v.count()+1)).count();
        int limit=key.endsWith(":login")?15:300;
        if(count>limit){response.setHeader("Retry-After","60");reject(response,429,"Too many requests. Try again in a minute.");return;}
        if(request.getContentLengthLong()>262144){reject(response,413,"Request exceeds 256 KB");return;}
        if(Objects.toString(request.getContentType(),"").startsWith("application/json")){
            byte[] body=request.getInputStream().readNBytes(262145);if(body.length>262144){reject(response,413,"Request exceeds 256 KB");return;}
            chain.doFilter(new HttpServletRequestWrapper(request){
                @Override public ServletInputStream getInputStream(){var in=new ByteArrayInputStream(body);return new ServletInputStream(){public int read(){return in.read();}public boolean isFinished(){return in.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener listener){throw new UnsupportedOperationException();}};}
                @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
            },response);
        }else chain.doFilter(request,response);
    }
    void reject(HttpServletResponse response,int status,String message)throws IOException{response.setStatus(status);response.setContentType("application/json");response.getWriter().write("{\"status\":"+status+",\"message\":\""+message+"\"}");}
}
