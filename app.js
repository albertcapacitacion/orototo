const products = [
  {id:'solitaire',name:'Solitaire Ring',purity:'18K yellow gold · Size 7',price:680,image:'assets/solitaire.svg',tag:'A classic'},
  {id:'coin',name:'Heritage Coin',purity:'24K gold · 1 oz',price:2480,image:'assets/coin.svg',tag:'24 karat'},
  {id:'chain',name:'Fine Link Chain',purity:'18K yellow gold · 18 in',price:920,image:'assets/chain.svg',tag:'Everyday'},
  {id:'bangle',name:'Sculpted Bangle',purity:'18K yellow gold · 7 in',price:1150,image:'assets/bangle.svg',tag:'Small batch'},
  {id:'hoops',name:'Classic Hoops',purity:'14K yellow gold · 25 mm',price:460,image:'assets/hoops.svg',tag:'A favorite'},
  {id:'pendant',name:'Sunburst Pendant',purity:'18K yellow gold · 16 in',price:740,image:'assets/pendant.svg',tag:'New arrival'}
];

const money = amount => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
const grid = document.querySelector('#product-grid');
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
let inventory = products.map((product,index)=>({id:String(index+1),name:product.name,category:'',purity:product.purity,weight:null,cost:null,price:product.price,stock:null}));
let cart = [];
let toastTimer;

function renderProducts(){
  grid.innerHTML = products.map(product => `
  <article class="product-card">
    <div class="product-visual"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} in polished gold" loading="lazy"><span class="product-tag">${escapeHtml(product.tag)}</span></div>
    <div class="product-info"><div class="product-title-row"><h3>${escapeHtml(product.name)}</h3><span class="product-price">${money(product.price)}</span></div>
      <p class="product-purity">${escapeHtml(product.purity)}</p>
      <button class="add-button" type="button" data-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)} to cart">Add to cart <span aria-hidden="true">+</span></button>
    </div>
  </article>`).join('');
}

const inventoryRows = document.querySelector('#inventory-rows');
function renderInventory(){
  inventoryRows.innerHTML = inventory.map(product => `<tr><td>${escapeHtml(product.id)}</td><th scope="row">${escapeHtml(product.name)}</th><td>${escapeHtml(product.category || '')}</td><td>${escapeHtml(product.purity)}</td><td>${product.weight == null ? '—' : escapeHtml(product.weight)}</td><td>${product.cost == null ? '—' : money(product.cost)}</td><td>${money(product.price)}</td><td>${product.stock == null ? '—' : escapeHtml(product.stock)}</td></tr>`).join('');
  document.querySelector('#inventory-summary').innerHTML = `<strong>${inventory.length}</strong><span>products in the collection</span>`;
}
renderProducts();
renderInventory();

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'&&text[i+1]==='"'){field+='"';i++;}else if(char==='"')quoted=false;else field+=char;}
    else if(char==='"'){if(field)throw new Error('Unexpected quote in CSV.');quoted=true;}
    else if(char===','){row.push(field);field='';}
    else if(char==='\n'||char==='\r'){
      if(char==='\r'&&text[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(value=>value.trim()!==''))rows.push(row);
      row=[];
    }else field+=char;
  }
  if(quoted)throw new Error('The CSV has an unclosed quoted field.');
  row.push(field);if(row.some(value=>value.trim()!==''))rows.push(row);
  if(rows.length<2)throw new Error('The CSV must include a header and at least one product.');
  const headers=rows.shift().map(value=>value.trim().replace(/^\uFEFF/,''));
  if(new Set(headers).size!==headers.length)throw new Error('The CSV contains duplicate column headers.');
  const required=['ID','Product','Category','Purity','Weight_g','Cost_USD','Price_USD','Stock'];
  const positions=new Map(headers.map((header,index)=>[header,index]));
  const missing=required.filter(header=>!positions.has(header));
  if(missing.length)throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  const ids=new Set();
  return rows.map((values,index)=>{
    if(values.length!==headers.length)throw new Error(`Row ${index+2} has a different number of columns than the header.`);
    const get=header=>values[positions.get(header)].trim();
    const id=get('ID'),name=get('Product'),category=get('Category'),purity=get('Purity');
    if(!id||!name||!category||!purity)throw new Error(`Row ${index+2} needs ID, Product, Category, and Purity.`);
    if(ids.has(id))throw new Error(`Duplicate product ID "${id}".`);ids.add(id);
    const number=(header,{integer=false,positive=false}={})=>{
      const raw=get(header),value=Number(raw);
      if(raw===''||!Number.isFinite(value)||value<0||(positive&&value===0)||(integer&&!Number.isInteger(value)))throw new Error(`Row ${index+2} has an invalid ${header} value.`);
      return value;
    };
    return {id,name,category,purity,weight:number('Weight_g',{positive:true}),cost:number('Cost_USD'),price:number('Price_USD'),stock:number('Stock',{integer:true})};
  });
}

const inventoryFile=document.querySelector('#inventory-file');
const inventoryStatus=document.querySelector('#inventory-upload-status');
document.querySelector('#inventory-upload-button').addEventListener('click',()=>inventoryFile.click());
inventoryFile.addEventListener('change',async()=>{
  const [file]=inventoryFile.files;if(!file)return;
  inventoryStatus.textContent='';
  try{
    const imported=parseCsv(await file.text());
    inventory.splice(0,inventory.length,...imported);
    renderInventory();
    inventoryStatus.textContent=`Inventory report updated with ${inventory.length} products for this session.`;
    showToast('Inventory updated');
  }catch(error){inventoryStatus.textContent=`Inventory was not changed. ${error.message}`;}
  inventoryFile.value='';
});

function syncPage(){
  const pageId = ['reports', 'analyze-inventory'].includes(location.hash.slice(1)) ? location.hash.slice(1) : null;
  document.querySelectorAll('.report-page').forEach(page => { page.hidden = page.id !== pageId; });
  document.querySelectorAll('#main > section:not(.report-page)').forEach(section => { section.hidden = pageId !== null; });
  document.querySelector('.site-footer').hidden = pageId !== null;
  if(pageId) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', syncPage);
syncPage();

const count = document.querySelector('.cart-count');
const dialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const total = document.querySelector('#cart-total');
const orderForm = document.querySelector('#order-form');
const orderDetails = document.querySelector('#order-details');
const orderSubtotal = document.querySelector('#order-subtotal');
const cartFeedback = document.querySelector('#cart-form-feedback');
const cartSubmit = orderForm.querySelector('[type="submit"]');
let submittingOrder = false;

function renderCart(){
  count.textContent = cart.length;
  if(!cart.length){cartItems.innerHTML='<p class="empty-cart">Your cart is waiting for something lovely.</p>';}
  else {cartItems.innerHTML=cart.map((item,index)=>`<div class="cart-row"><img src="${escapeHtml(item.image)}" alt=""><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.purity)}</small><button class="remove-item" type="button" data-remove="${index}" aria-label="Remove ${escapeHtml(item.name)} from cart">Remove</button></div><span class="cart-row-price">${money(item.price)}</span></div>`).join('');}
  total.textContent=money(cart.reduce((sum,item)=>sum+item.price,0));
  cartSubmit.disabled = cart.length === 0 || submittingOrder;
}

function showToast(message){
  const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2400);
}

grid.addEventListener('click',event=>{
  const button=event.target.closest('[data-add]');if(!button)return;
  const product=products.find(item=>item.id===button.dataset.add);cart.push(product);renderCart();showToast(`${product.name} added to your cart`);
});
document.querySelector('.cart-trigger').addEventListener('click',()=>dialog.showModal());
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
document.querySelector('.cart-done').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
cartItems.addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;const [item]=cart.splice(Number(button.dataset.remove),1);renderCart();showToast(`${item.name} removed from your cart`);});

orderForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!orderForm.reportValidity()||!cart.length||submittingOrder)return;
  orderDetails.value=cart.map(item=>`${item.name} — ${item.purity} — ${money(item.price)}`).join('\n');
  orderSubtotal.value=money(cart.reduce((sum,item)=>sum+item.price,0));
  submittingOrder=true;
  cartSubmit.disabled=true;
  cartFeedback.textContent='Sending your request…';
  try{
    const response=await fetch(orderForm.action,{method:'POST',body:new FormData(orderForm),headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('The request could not be sent. Please try again.');
    cart.splice(0,cart.length);
    renderCart();
    cartFeedback.textContent='Thanks! Your order request was sent.';
  }catch(error){
    cartFeedback.textContent=`${error.message} Check your connection and try again.`;
  }finally{
    submittingOrder=false;
    cartSubmit.disabled=cart.length===0;
  }
});

const menuToggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#primary-nav');
menuToggle.addEventListener('click',()=>{const open=menuToggle.getAttribute('aria-expanded')!=='true';menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('open',open);});
nav.addEventListener('click',event=>{if(event.target.closest('a')){menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','Open navigation');nav.classList.remove('open');}});

document.querySelector('#contact-form').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;const feedback=document.querySelector('#form-feedback');
  if(!form.checkValidity()){form.reportValidity();feedback.textContent='Please complete all fields with a valid email address.';return;}
  feedback.textContent='Thanks for your note! This is a demo, so your message was not sent.';form.reset();
});
document.querySelector('#year').textContent=new Date().getFullYear();
renderCart();
