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
let inventory = [];
let inventoryLoaded = false;
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
const inventoryDashboard=document.querySelector('#inventory-dashboard');
const inventoryCategory=document.querySelector('#inventory-category');
const inventorySearch=document.querySelector('#inventory-search');
const inventoryStockFilter=document.querySelector('#inventory-stock-filter');
const lowStockThreshold=4;
const productStatus=product=>product.stock===0?'Out of stock':product.stock<=lowStockThreshold?'Low stock':'In stock';
const stockValue=product=>product.cost*product.stock;
function renderBars(title,metric,formatter,items){
  const grouped=new Map();
  items.forEach(product=>{const key=product.category||'Uncategorized';grouped.set(key,(grouped.get(key)||0)+metric(product));});
  const entries=[...grouped.entries()].sort((a,b)=>b[1]-a[1]);
  const max=Math.max(...entries.map(([,value])=>value),1);
  return `<section class="inventory-chart"><h2>${title}</h2><div class="inventory-bars" aria-hidden="true">${entries.map(([category,value])=>`<div class="inventory-bar-row"><span>${escapeHtml(category)}</span><div class="inventory-bar-track"><i style="width:${Math.max(value>0?2:0,value/max*100)}%"></i></div><strong>${formatter(value)}</strong></div>`).join('')}</div><ul class="sr-only">${entries.map(([category,value])=>`<li>${escapeHtml(category)}: ${formatter(value)}</li>`).join('')||'<li>No matching inventory.</li>'}</ul></section>`;
}
function renderInventory(){
  inventoryDashboard.hidden=!inventoryLoaded;
  if(!inventoryLoaded)return;
  const search=inventorySearch.value.trim().toLowerCase();
  const category=inventoryCategory.value;
  const stockFilter=inventoryStockFilter.value;
  const filtered=inventory.filter(product=>{
    if(category&&product.category!==category)return false;
    if(search&&!`${product.name} ${product.id}`.toLowerCase().includes(search))return false;
    if(stockFilter==='out'&&product.stock!==0)return false;
    if(stockFilter==='low'&&product.stock>lowStockThreshold)return false;
    if(stockFilter==='available'&&product.stock<=lowStockThreshold)return false;
    return true;
  });
  const units=filtered.reduce((sum,product)=>sum+product.stock,0);
  const costValue=filtered.reduce((sum,product)=>sum+stockValue(product),0);
  const retailValue=filtered.reduce((sum,product)=>sum+product.price*product.stock,0);
  const grossProfit=filtered.reduce((sum,product)=>sum+(product.price-product.cost)*product.stock,0);
  const outOfStock=filtered.filter(product=>product.stock===0).length;
  const lowStock=filtered.filter(product=>product.stock<=lowStockThreshold).length;
  const highestCostProduct=filtered.reduce((highest,product)=>!highest||stockValue(product)>stockValue(highest)?product:highest,null);
  const nearOutProducts=filtered.filter(product=>product.stock<5).sort((a,b)=>a.stock-b.stock||a.name.localeCompare(b.name));
  document.querySelector('#inventory-summary').innerHTML=`<strong>${inventory.length}</strong><span>products loaded · ${inventory.reduce((sum,item)=>sum+item.stock,0).toLocaleString('en-US')} units on hand</span>`;
  document.querySelector('#inventory-highlights').innerHTML=`<article class="inventory-highlight"><span>Highest inventory cost</span>${highestCostProduct?`<strong>${escapeHtml(highestCostProduct.name)}</strong><b>${money(stockValue(highestCostProduct))}</b><small>${highestCostProduct.stock.toLocaleString('en-US')} units × ${money(highestCostProduct.cost)} unit cost</small>`:'<strong>No matching products</strong>'}</article><article class="inventory-highlight"><span>Potential retail value</span><strong>${money(retailValue)}</strong><small>At listed prices, before expenses</small></article><article class="inventory-highlight inventory-near-out"><span>Products under 5 units <b>${nearOutProducts.length}</b></span>${nearOutProducts.length?`<ul>${nearOutProducts.map(product=>`<li><span>${escapeHtml(product.name)}</span><strong>${product.stock} ${product.stock===1?'unit':'units'}</strong></li>`).join('')}</ul>`:'<strong>None</strong>'}</article>`;
  document.querySelector('#inventory-alerts').innerHTML=`<div class="inventory-alert ${outOfStock?'inventory-alert-critical':''}"><strong>${outOfStock}</strong><span>out of stock</span></div><div class="inventory-alert ${lowStock?'inventory-alert-warning':''}"><strong>${lowStock}</strong><span>under 5 units</span></div><p>Alerts reflect the current filters. Near out of stock means fewer than 5 units.</p>`;
  document.querySelector('#inventory-kpis').innerHTML=[['Products',filtered.length],['Units on hand',units.toLocaleString('en-US')],['Inventory at cost',money(costValue)],['Potential gross profit',money(grossProfit)]].map(([label,value])=>`<article class="inventory-kpi"><span>${label}</span><strong>${value}</strong>${label==='Potential gross profit'?'<small>At listed price, before expenses</small>':''}</article>`).join('');
  const categories=[...new Set(inventory.map(product=>product.category))].sort((a,b)=>a.localeCompare(b));
  const selectedCategory=inventoryCategory.value;
  inventoryCategory.innerHTML='<option value="">All categories</option>'+categories.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  inventoryCategory.value=selectedCategory;
  document.querySelector('#inventory-charts').innerHTML=renderBars('Units on hand by category',product=>product.stock,value=>value.toLocaleString('en-US'),filtered)+renderBars('Inventory cost by category',stockValue,value=>money(value),filtered);
  inventoryRows.innerHTML=filtered.map(product=>`<tr><td>${escapeHtml(product.id)}</td><th scope="row">${escapeHtml(product.name)}</th><td>${escapeHtml(product.category)}</td><td>${escapeHtml(product.weight)}</td><td>${money(product.cost)}</td><td>${money(product.price)}</td><td>${product.stock.toLocaleString('en-US')}</td><td>${money(stockValue(product))}</td><td><span class="stock-badge ${product.stock===0?'is-out':product.stock<=lowStockThreshold?'is-low':''}">${productStatus(product)}</span></td></tr>`).join('');
  if(!filtered.length)inventoryRows.innerHTML='<tr><td colspan="9" class="inventory-empty">No products match these filters.</td></tr>';
  document.querySelector('#inventory-result-count').textContent=`${filtered.length} of ${inventory.length} products`;
  document.querySelector('#inventory-kpis').setAttribute('aria-label','Inventory key indicators');
}
renderProducts();

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
    inventoryLoaded=true;
    inventorySearch.value='';inventoryCategory.value='';inventoryStockFilter.value='';
    renderInventory();
    inventoryStatus.textContent=`Inventory report updated with ${inventory.length} products for this session.`;
    showToast('Inventory updated');
  }catch(error){inventoryStatus.textContent=`Inventory was not changed. ${error.message}`;}
  inventoryFile.value='';
});
inventorySearch.addEventListener('input',renderInventory);
inventoryCategory.addEventListener('change',renderInventory);
inventoryStockFilter.addEventListener('change',renderInventory);
document.querySelector('#inventory-reset').addEventListener('click',()=>{inventorySearch.value='';inventoryCategory.value='';inventoryStockFilter.value='';renderInventory();});

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
