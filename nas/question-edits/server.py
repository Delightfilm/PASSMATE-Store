"""Dedicated immutable editor PNGs. No source-bank/AI-cache mount or management port."""
import hashlib, hmac, http.server, json, os, pathlib, re, socket, tempfile
HASH = re.compile(r"[a-f0-9]{64}\Z")
MAX_BYTES = 5_000_000
class Assets:
 def __init__(self,root):
  self.root=pathlib.Path(root).resolve();self.root.mkdir(parents=True,exist_ok=True)
 def save(self,key,body):
  if not HASH.fullmatch(key) or not 8<len(body)<=MAX_BYTES or not body.startswith(b'\x89PNG\r\n\x1a\n') or hashlib.sha256(body).hexdigest()!=key:raise ValueError('invalid_image')
  dest=self.root/(key+'.png')
  if dest.exists():
   if dest.is_symlink() or hashlib.sha256(dest.read_bytes()).hexdigest()!=key:raise ValueError('asset_conflict')
   return len(body)
  fd,name=tempfile.mkstemp(prefix='.upload-',dir=self.root)
  try:
   with os.fdopen(fd,'wb') as f:f.write(body);f.flush();os.fsync(f.fileno())
   # Atomic creation; concurrent identical writes never overwrite an existing file.
   try:os.link(name,dest)
   except FileExistsError:pass
  finally:os.unlink(name)
  return len(body)
class Handler(http.server.BaseHTTPRequestHandler):
 server_version='PASSMATE-Editor'
 def log_message(self,*args):pass
 def reply(self,status,body=b'',content_type='application/json'):
  self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)));self.send_header('X-Content-Type-Options','nosniff');self.send_header('Cache-Control','public, max-age=31536000, immutable' if content_type=='image/png' else 'no-store');self.end_headers()
  if self.command!='HEAD':self.wfile.write(body)
 def do_GET(self):
  if self.path=='/health':return self.reply(200,b'{"status":"ok"}')
  match=re.fullmatch(r'/assets/([a-f0-9]{64})\.png',self.path)
  if not match:return self.reply(404)
  path=self.server.assets.root/(match[1]+'.png')
  if not path.is_file() or path.is_symlink():return self.reply(404)
  return self.reply(200,path.read_bytes(),'image/png')
 def do_HEAD(self):self.do_GET()
 def do_PUT(self):
  if not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+self.server.token):return self.reply(401)
  match=re.fullmatch(r'/v1/([a-f0-9]{64})',self.path)
  try:length=int(self.headers.get('Content-Length','0'))
  except ValueError:return self.reply(400)
  if not match or not 8<length<=MAX_BYTES or self.headers.get('Content-Type')!='image/png' or self.headers.get('Transfer-Encoding'):return self.reply(400)
  try:
   self.connection.settimeout(15);body=self.rfile.read(length)
   if len(body)!=length:return self.reply(400)
   self.server.assets.save(match[1],body)
   return self.reply(200,b'{"stored":true}')
  except (ValueError,socket.timeout):return self.reply(400)
  except OSError:return self.reply(507)
if __name__=='__main__':
 token=os.environ.get('PASSMATE_EDIT_ASSET_TOKEN','')
 if len(token)<32:raise RuntimeError('private token required')
 server=http.server.ThreadingHTTPServer(('0.0.0.0',8091),Handler);server.token=token;server.assets=Assets(os.environ.get('PASSMATE_EDIT_ASSET_DIR','/data'));server.serve_forever()
