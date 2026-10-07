import importlib.util, pathlib, tempfile, unittest, hashlib, threading, http.client, http.server
class AssetsTest(unittest.TestCase):
 def test_content_addressed_immutable_storage(self):
  path=pathlib.Path(__file__).with_name('server.py')
  self.assertTrue(path.exists(),'NAS asset service is missing')
  spec=importlib.util.spec_from_file_location('edit_assets',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  with tempfile.TemporaryDirectory() as root:
   store=module.Assets(root);body=b'\x89PNG\r\n\x1a\n'+b'example';digest=hashlib.sha256(body).hexdigest()
   self.assertEqual(store.save(digest,body),len(body));self.assertEqual(store.save(digest,body),len(body))
   self.assertEqual(list(pathlib.Path(root).iterdir())[0].read_bytes(),body)
   for bad,data in [('../escape',body),(digest,b'invalid'),('a'*64,body)]:
    with self.assertRaises(ValueError):store.save(bad,data)
   self.assertEqual(len(list(pathlib.Path(root).iterdir())),1)
 def test_http_authorization_and_public_reads(self):
  spec=importlib.util.spec_from_file_location('edit_assets_http',pathlib.Path(__file__).with_name('server.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  with tempfile.TemporaryDirectory() as root:
   server=http.server.ThreadingHTTPServer(('127.0.0.1',0),module.Handler);server.token='test-only-token-'+'a'*32;server.assets=module.Assets(root)
   worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
   def request(method,path,body=None,headers=None):
    connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3);connection.request(method,path,body,headers or {});response=connection.getresponse();result=(response.status,dict(response.getheaders()),response.read());connection.close();return result
   try:
    body=b'\x89PNG\r\n\x1a\n'+b'http-fixture';digest=hashlib.sha256(body).hexdigest();path='/v1/'+digest
    self.assertEqual(request('PUT',path,body,{'Content-Type':'image/png'})[0],401)
    headers={'Authorization':'Bearer '+server.token,'Content-Type':'image/png'}
    self.assertEqual(request('PUT',path,body,headers)[0],200)
    status,received,data=request('GET','/assets/'+digest+'.png');self.assertEqual(status,200);self.assertEqual(received['Content-Type'],'image/png');self.assertEqual(data,body)
    self.assertEqual(request('HEAD','/assets/'+digest+'.png')[2],b'')
    self.assertEqual(request('GET','/assets/../server.py')[0],404)
    self.assertEqual(request('PUT','/v1/'+'a'*64,body,headers)[0],400)
    self.assertEqual(request('PUT',path,body,{**headers,'Content-Type':'text/html'})[0],400)
   finally:server.shutdown();server.server_close();worker.join(timeout=3)
if __name__=='__main__':unittest.main()
