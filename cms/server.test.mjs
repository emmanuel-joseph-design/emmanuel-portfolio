import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createCMS, validateProject } from './server.mjs';

const project = { slug:'test-project', title:'Test project', year:2026, order:0, categories:['Brand'], cover_image:'', sections:[] };
test('local CMS keeps drafts private, restricts requests, and validates uploads', async (t) => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-cms-test-'));
  const server=await createCMS({root,allowPublish:false});
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise((resolve)=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const html=await (await fetch(origin)).text();
  const token=html.match(/name="cms-token" content="([a-f0-9]+)"/)[1];
  const post=(route,body,headers={})=>fetch(`${origin}/api/${route}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-CMS-Token':token,...headers},body:JSON.stringify(body)});
  assert.equal((await post('save',project,{Origin:'https://evil.example'})).status,403);
  assert.equal((await post('save',project,{'X-CMS-Token':'invalid'})).status,403);
  const hostileHost = await new Promise((resolve,reject)=>{const request=http.get(origin,{headers:{Host:'evil.example'}},(response)=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});
  assert.equal(hostileHost,403);
  assert.equal((await post('save',{...project,slug:'../escape'})).status,400);
  assert.equal((await post('save',project)).status,200);
  assert.deepEqual(await fs.readdir(path.join(root,'content/projects')),[]);
  const saved=JSON.parse(await fs.readFile(path.join(root,'.local-cms/drafts/test-project.json'),'utf8'));
  assert.equal(saved.published,false);
  assert.equal((await (await fetch(`${origin}/api/projects`)).json())[0].draft,true);
  assert.equal((await post('upload',{name:'bad.html',data:Buffer.from('<script>').toString('base64')})).status,400);
  assert.equal((await post('upload',{name:'bad.png',data:Buffer.from('<script>').toString('base64')})).status,400);
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const upload=await (await post('upload',{name:'photo.png',data:png})).json();
  assert.match(upload.url,/^\/media\/cms\/[a-f0-9-]+\.png$/);
  const asset=await fetch(`${origin}${upload.url}`);
  assert.equal(asset.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()),Buffer.from(png,'base64'));
  assert.equal((await post('publish',{slug:'test-project',published:true})).status,202);
  assert.equal((await (await fetch(`${origin}/api/status`)).json()).state,'error');
  assert.deepEqual(await fs.readdir(path.join(root,'content/projects')),[]);
});
test('validation rejects traversal and incorrect gallery media types',()=>{
  assert.throws(()=>validateProject({...project,cover_image:'/media/../../secret.png'}));
  assert.throws(()=>validateProject({...project,sections:[{type:'video',assets:['/media/image.png']}]}));
  assert.equal(validateProject({...project,sections:[{type:'video',assets:['https://youtu.be/dQw4w9WgXcQ']}]}).sections[0].assets[0],'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  const mixed=validateProject({...project,sections:[{type:'double-image',assets:['/media/image.png','https://youtu.be/dQw4w9WgXcQ']}]}).sections[0];
  assert.deepEqual(mixed.assets,['/media/image.png','https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ']);
  assert.throws(()=>validateProject({...project,sections:[{type:'double-image',assets:['/media/image.png','https://evil.example/video']}]}));
  assert.throws(()=>validateProject({...project,sections:[{type:'full-image',assets:['https://youtu.be/dQw4w9WgXcQ']}]}));
  assert.throws(()=>validateProject({...project,sections:[{type:'video',assets:['https://evil.example/video']}]}));
  assert.throws(()=>validateProject({...project,categories:['Unknown']}));
  assert.equal(validateProject({...project,title:'  Brand work  '}).title,'Brand work');
});

for (const failBuild of [false,true]) test(`publishing ${failBuild ? 'stops before Git push on a failed build' : 'includes only selected content and uploaded media'}`,async(t)=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-cms-publish-test-'));
  const calls=[];
  const runCommand=async(file,args)=>{
    calls.push([file,...args]);
    if(file!== 'git'){if(failBuild)throw new Error('Build failed');return '';}
    if(args[0]==='branch')return 'main';
    if(args[0]==='remote')return 'https://github.com/emmanuel-joseph-design/emmanuel-portfolio.git';
    if(args[0]==='rev-list')return '0';
    if(args[0]==='diff'&&args.includes('--cached')&&calls.some((c)=>c[1]==='add'))return 'content/projects/test-project.json';
    return '';
  };
  const server=await createCMS({root,runCommand});await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise((resolve)=>server.close(resolve));await fs.rm(root,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const token=(await(await fetch(origin)).text()).match(/name="cms-token" content="([a-f0-9]+)"/)[1];
  const post=(route,body)=>fetch(`${origin}/api/${route}`,{method:'POST',headers:{Origin:origin,'X-CMS-Token':token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const {url}=await(await post('upload',{name:'photo.png',data})).json();
  await post('save',{...project,cover_image:url});await post('save',{...project,slug:'private-draft'});
  await post('publish',{slug:project.slug,published:true});
  let status;
  for(let i=0;i<100;i++){status=await(await fetch(`${origin}/api/status`)).json();if(status.state!=='running')break;await new Promise((resolve)=>setTimeout(resolve,10));}
  assert.equal(status.state,failBuild?'error':'success');
  assert.equal(calls.some((c)=>c[1]==='push'),!failBuild);
  assert.equal((await fs.readdir(path.join(root,'content/projects'))).includes('private-draft.json'),false);
  if(!failBuild){
    const add=calls.find((c)=>c[1]==='add');assert.deepEqual(add.slice(3),['content/projects/test-project.json',`public${url}`]);
    await assert.rejects(fs.access(path.join(root,'.local-cms/drafts/test-project.json')));
  }else{
    await fs.access(path.join(root,'.local-cms/drafts/test-project.json'));
    await assert.rejects(fs.access(path.join(root,'content/projects/test-project.json')));
    await assert.rejects(fs.access(path.join(root,'public',url)));
  }
});
