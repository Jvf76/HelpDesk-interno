package br.com.uaitelecom.suporte;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
final class PresenceBody extends HttpServletRequestWrapper {
 static final int LIMIT=32768;
 final byte[] bytes;
 PresenceBody(HttpServletRequest request,byte[] bytes){super(request);this.bytes=bytes;}
 @Override public ServletInputStream getInputStream(){var input=new ByteArrayInputStream(bytes);return new ServletInputStream(){public int read(){return input.read();}public boolean isFinished(){return input.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener listener){throw new UnsupportedOperationException();}};}
 @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
 @Override public int getContentLength(){return bytes.length;}
 @Override public long getContentLengthLong(){return bytes.length;}
}
