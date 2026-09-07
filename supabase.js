const SUPABASE_URL='https://fzveisahdgjjzahylkid.supabase.co';
const SUPABASE_KEY='sb_publishable_Srn-iAZb3T_XA_lSUrSEIg_ocRZdXBl';
const {createClient}=supabase;
const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const SITE='https://pompkin-art.github.io/Pompkin/';
async function currentUser(){const {data}=await db.auth.getUser();return data.user||null}
async function profile(){const u=await currentUser();if(!u)return null;const {data}=await db.from('profiles').select('*').eq('id',u.id).single();return data}
function money(v){return `₱${Number(v||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}`}
function esc(v){return String(v??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
async function authHeader(){const u=await currentUser();const nav=document.querySelector('.account-links');if(!nav)return;if(u){const p=await profile();nav.innerHTML=`<a href="profile.html" class="login-link">${esc(p?.username||u.email?.split('@')[0]||'Account')}</a><button class="text-button" id="logoutBtn">Log Out</button>`;document.querySelector('#logoutBtn')?.addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html'})}}
function requireUser(returnTo=location.pathname.split('/').pop()||'index.html'){return currentUser().then(u=>{if(!u){location.href=`login.html?return=${encodeURIComponent(returnTo)}`;return null}return u})}
function cart(){try{return JSON.parse(localStorage.getItem('pompkin_cart')||'[]')}catch{return[]}}
function saveCart(c){localStorage.setItem('pompkin_cart',JSON.stringify(c))}
document.addEventListener('DOMContentLoaded',authHeader);
