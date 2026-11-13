const assert=require('node:assert/strict')
const fs=require('node:fs/promises')
const path=require('node:path')
const http=require('node:http')
const {chromium}=require('playwright-core')
const root=path.resolve(__dirname,'../..')
const asset=require('../../frontend/images/units.json')[0]
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.ico':'image/x-icon','.webp':'image/webp'}
async function main(){
 const browser=await chromium.launch({channel:'chrome'})
 try{for(const kind of ['web','native']){
 const dir=path.join(root,kind==='web'?'frontend':'mobile/public')
 const server=http.createServer(async(req,res)=>{try{const file=path.resolve(dir,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!file.startsWith(dir+path.sep))return res.writeHead(403).end();const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes)}catch{res.writeHead(404).end()}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})
 const page=await context.newPage();const errors=[];let reads=0, adminNotice={enabled:false,titulo:'',mensagem:'',cidade:'todas'}
 page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',route=>{
 const url=new URL(route.request().url());const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type'}
 if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers})
 if(url.pathname==='/atendimento'){reads++;return route.fulfill({headers,json:[{_id:asset.id,upa:asset.name,foto:asset.originalURL,tempo_minutos:20,tempo_espera:'20 min',medicosPlantao:[],lat:-23.98,lng:-46.25}]})}
 if(url.pathname==='/admin/avisos/publico')return route.fulfill({headers,json:{titulo:'Aviso de teste',mensagem:'<img src=x onerror=alert(1)> Horário de manutenção: 23h.',revision:kind+'-test'}})
 if(url.pathname==='/admin/avisos'){
 assert.equal(route.request().headers().authorization,'fixture-notices-token')
 if(route.request().method()==='PUT')adminNotice=route.request().postDataJSON()
 return route.fulfill({headers,json:adminNotice})
 }
 if(url.origin===origin)return route.continue()
 return route.fulfill({headers,json:[]})
 })
 try{
 await page.goto(origin);await page.locator('#conectaSplash').waitFor()
 assert.equal(reads,0,'Units should load only after selecting the city')
 await page.waitForTimeout(850)
 const out=path.resolve(root,'../tmp/entry-review');await fs.mkdir(out,{recursive:true})
 await page.screenshot({path:path.join(out,kind+'-splash.png')})
 await page.locator('#conectaSplash').waitFor({state:'detached'})
 assert.equal(await page.locator('[data-city]').count(),1)
 assert.equal(await page.locator('#portalBottomNav').isVisible(),false)
 await page.screenshot({path:path.join(out,kind+'-cities.png')})
 await page.setViewportSize({width:320,height:760})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'City grid fits 320px')
 await page.setViewportSize({width:390,height:844})
 await page.locator('[data-city=guaruja]').click();await page.locator('.unit-card').first().waitFor()
 await page.locator('#conectaNotice').waitFor();assert.equal(await page.locator('#conectaNotice img').count(),0,'Notice content must be plain text')
 await page.screenshot({path:path.join(out,kind+'-notice.png')})
 await page.locator('#conectaNotice').waitFor({state:'detached',timeout:9000})
 await page.evaluate(()=>conectaCarregarAviso());await page.waitForTimeout(150)
 assert.equal(await page.locator('#conectaNotice').count(),0,'Dismissal is remembered for the current revision')
 await page.locator('#citySwitch').click();assert.equal(await page.locator('#conectaCities').isVisible(),true)
 await page.locator('[data-city=guaruja]').click();await page.waitForFunction(()=>document.body.dataset.portalView==='home')
 await page.evaluate(()=>sessionStorage.removeItem('conecta:last-notice'));await page.evaluate(()=>conectaCarregarAviso())
 await page.getByRole('button',{name:'Fechar aviso',exact:true}).click();assert.equal(await page.locator('#conectaNotice').count(),0)
 await page.evaluate(k=>{
   if(k==='native')portalSession.set('token','fixture-notices-token')
   else localStorage.setItem('token','fixture-notices-token')
   conectaEditarAviso()
 },kind)
 const editor=page.getByRole('dialog',{name:'Aviso do portal'})
 await editor.getByRole('button',{name:'Salvar aviso'}).waitFor()
 await editor.getByLabel('Título',{exact:true}).fill('Manutenção programada')
 await editor.getByLabel('Mensagem',{exact:true}).fill('Hoje às 23h. Voltaremos em breve.')
 await editor.getByLabel('Exibir aviso',{exact:true}).check()
 await editor.getByRole('button',{name:'Salvar aviso'}).click()
 await editor.getByText('Aviso salvo. Será exibido no período definido.',{exact:true}).waitFor()
 assert.equal(adminNotice.enabled,true)
 await page.screenshot({path:path.join(out,kind+'-editor.png')})
 await editor.getByRole('button',{name:'Desativar aviso'}).click()
 await editor.getByText('Aviso desativado.',{exact:true}).waitFor()
 assert.equal(adminNotice.enabled,false)
 await editor.getByRole('button',{name:'Fechar editor de aviso'}).click()
 assert.deepEqual(errors,[])
 console.log(kind+': splash, city, plain-text notice, seven-second close, X close and dismissal OK')
 }finally{await context.close();await new Promise(r=>server.close(r))}
 }}finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
