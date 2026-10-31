// ==== Free public page: accounts (Supabase) and payment (Stripe Checkout) ====
// Modules 3-5 are NOT in this page. After login, the backend checks that the account
// has paid and only then sends the full app, which is shown in a frame over this page.
const CFG=__CONFIG__;
const SB=window.supabase&&CFG.supabaseUrl.indexOf("YOUR-")<0?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey):null;
let ME=null; // logged-in user who has not paid (yet)
const here=()=>location.origin+location.pathname;
const authed=()=>false;
const free=k=>TOP[k][0]==2;
const lockCard=k=>`<button class="card lock" data-unlock="${esc(TOP[k][1])}" aria-label="${esc(TOP[k][1])} (locked, full access needed)"><b>🔒 ${TOP[k][1]}</b><small>Full access</small></button>`;
const limBanner=()=>`<div class="lim"><p><b>🔒 Free version</b><br>Only <b>Module 2</b> is free. Full access (${esc(CFG.priceLabel)}, one-time payment) unlocks Modules 3–5, mixed practice across all topics and the practice exam.</p><button class="btn p" data-unlock="">${ME?"Get full access":"Log in or create an account"}</button></div>`;
document.addEventListener("click",e=>{const b=e.target.closest("[data-unlock]");if(b){e.stopPropagation();loginPage(b.dataset.unlock)}},true);
function logout(){if(SB)SB.auth.signOut().finally(()=>{ME=null;menu()});else menu()}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function api(name,method){const{data:{session}}=await SB.auth.getSession();if(!session)return null;
  return fetch(`${CFG.supabaseUrl}/functions/v1/${name}`,{method:method||"GET",headers:{Authorization:`Bearer ${session.access_token}`,apikey:CFG.supabaseAnonKey}})}
// Ask the backend for the full app. Returns "ok", "unpaid", "none" (not logged in) or "error".
async function openFull(){if(!SB)return"error";let r;try{r=await api("app")}catch(e){return"error"}
  if(!r)return"none";if(r.status==402)return"unpaid";if(r.status==401)return"none";if(!r.ok)return"error";
  const html=await r.text(),f=document.createElement("iframe");
  f.id="full";f.title="Python Practice";f.style.cssText="position:fixed;inset:0;width:100%;height:100%;border:0";
  f.onload=()=>f.contentWindow.focus();f.srcdoc=html;
  document.body.innerHTML="";document.body.style.margin="0";document.body.style.overflow="hidden";document.body.appendChild(f);return"ok"}
window.addEventListener("message",e=>{const f=document.getElementById("full");
  if(f&&e.source===f.contentWindow&&e.data&&e.data.pyApp=="logout")SB.auth.signOut().finally(()=>location.reload())});
function note(title,text,btn,fn){$("#nav").innerHTML="";A.innerHTML=`<div class="login"><h1>${title}</h1><p id="nt">${text}</p>${btn?`<button class="btn p" id="nb">${btn}</button>`:""}</div>`;if(btn)$("#nb").onclick=fn}
async function afterLogin(what){ME=(await SB.auth.getUser()).data.user;const s=await openFull();
  if(s=="ok")return;if(s=="unpaid")return payPage(what);
  note("⚠️ Something went wrong","Could not check your account right now. Try again in a moment.","← Back",menu)}
function loginPage(what){window.scrollTo(0,0);
  if(!SB)return note("🔒 Full access","Accounts are not available right now. Try again later.","← Back",menu);
  if(ME)return payPage(what);
  let mode="in",em="";
  const draw=()=>{$("#nav").innerHTML="";const up=mode=="up";
    A.innerHTML=`<form class="login" id="lf" novalidate><h1>🐍 Python Practice</h1><p class="mu">${what?`<b>${esc(what)}</b> is part of full access. `:""}${up?`Create an account, then pay ${esc(CFG.priceLabel)} once for full access.`:"Log in to your account."} Module 2 is always free.</p>
    <label for="le">Email</label><input id="le" type="email" autocomplete="username" required value="${esc(em)}">
    <label for="lp">Password${up?" (at least 8 characters)":""}</label><input id="lp" type="password" autocomplete="${up?"new-password":"current-password"}" required>
    <div class="lerr" id="lx" role="alert"></div><button class="btn p" type="submit" id="ls">${up?"Create account":"Log in"}</button>
    <button class="ghost" type="button" id="lm">${up?"Already have an account? Log in":"No account yet? Create one"}</button>${up?"":`<button class="ghost" type="button" id="lr">Forgot password?</button>`}
    <button class="ghost" type="button" id="lb">← Continue with the free version (Module 2)</button></form>`;
    const msg=t=>{$("#lx").textContent=t};
    $("#lb").onclick=menu;$("#lm").onclick=()=>{em=$("#le").value.trim();mode=up?"in":"up";draw()};
    if(!up)$("#lr").onclick=async()=>{const e=$("#le").value.trim().toLowerCase();if(!e)return msg("Enter your email first, then click “Forgot password?”.");
      const{error}=await SB.auth.resetPasswordForEmail(e,{redirectTo:here()});msg(error?error.message:"If this account exists, we sent you an email with a link to choose a new password.")};
    (em?$("#lp"):$("#le")).focus();
    $("#lf").onsubmit=async e=>{e.preventDefault();const mail=$("#le").value.trim().toLowerCase(),pw=$("#lp").value;
      if(!mail||!pw)return msg("Enter your email and password.");if(up&&pw.length<8)return msg("Use a password of at least 8 characters.");
      $("#ls").disabled=true;msg("");
      try{if(up){const{data,error}=await SB.auth.signUp({email:mail,password:pw,options:{emailRedirectTo:here()}});if(error)throw error;
          if(!data.session)return note("📧 Check your email",`We sent a confirmation link to <b>${esc(mail)}</b>. Click it, then log in and pay to unlock everything.`,"OK",()=>{em=mail;mode="in";draw()})}
        else{const{error}=await SB.auth.signInWithPassword({email:mail,password:pw});if(error)throw error}
        await afterLogin(what)}
      catch(err){msg(/invalid login/i.test(err.message)?"Incorrect email or password.":err.message||"Something went wrong.");$("#ls").disabled=false;$("#lp").value="";$("#lp").focus()}}};
  draw()}
function payPage(what){$("#nav").innerHTML="";window.scrollTo(0,0);
  A.innerHTML=`<div class="login"><h1>🔓 Full access</h1><p class="mu">Logged in as <b>${esc(ME.email)}</b></p><p>${what?`<b>${esc(what)}</b> is part of full access. `:""}Pay <b>${esc(CFG.priceLabel)}</b> once to unlock Modules 3–5, mixed practice and the practice exam on this account. You pay with iDEAL or card on Stripe's secure payment page; your account unlocks automatically afterwards.</p>
  <div class="lerr" id="lx" role="alert"></div><button class="btn p" id="pay">Pay ${esc(CFG.priceLabel)} →</button><button class="ghost" id="lb">← Continue with the free version (Module 2)</button><button class="ghost" id="lo">Log out</button></div>`;
  $("#lb").onclick=menu;$("#lo").onclick=logout;
  $("#pay").onclick=async()=>{$("#pay").disabled=true;$("#lx").textContent="";
    try{const r=await api("create-checkout","POST");if(!r)return loginPage(what);const j=await r.json();
      if(j.paid){if(await openFull()=="ok")return}if(!r.ok||!j.url)throw new Error(j.error||"Could not start the payment.");location.href=j.url}
    catch(e){$("#lx").textContent=e.message;$("#pay").disabled=false}}}
function newPassword(){$("#nav").innerHTML="";
  A.innerHTML=`<form class="login" id="nf" novalidate><h1>🔑 New password</h1><label for="np">New password (at least 8 characters)</label><input id="np" type="password" autocomplete="new-password" required><div class="lerr" id="lx" role="alert"></div><button class="btn p" type="submit">Save password</button></form>`;
  $("#np").focus();$("#nf").onsubmit=async e=>{e.preventDefault();const pw=$("#np").value;if(pw.length<8)return $("#lx").textContent="Use at least 8 characters.";
    const{error}=await SB.auth.updateUser({password:pw});if(error)return $("#lx").textContent=error.message;await afterLogin("")}}
async function boot(){if(!SB)return;let recovery=/type=recovery/.test(location.hash);
  SB.auth.onAuthStateChange(ev=>{if(ev=="PASSWORD_RECOVERY"){recovery=true;setTimeout(newPassword,0)}});
  const q=new URLSearchParams(location.search),paid=q.has("paid");if(paid||q.has("cancel"))history.replaceState(null,"",here());
  const{data:{session}}=await SB.auth.getSession();if(!session||recovery)return;ME=session.user;
  if(paid){note("✅ Payment received","Unlocking full access…");
    for(let i=0;i<20;i++){const s=await openFull();if(s=="ok")return;if(s!="unpaid")break;await wait(2000)}
    return note("⏳ Almost there","Your payment is still being processed. Refresh this page in a minute. If it stays locked, contact the app owner with the email address of your account.","Refresh",()=>location.reload())}
  if(await openFull()!="ok")menu()}
setTimeout(boot,0);
