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
let cart = [];
let toastTimer;

grid.innerHTML = products.map(product => `
  <article class="product-card">
    <div class="product-visual"><img src="${product.image}" alt="${product.name} in polished gold" loading="lazy"><span class="product-tag">${product.tag}</span></div>
    <div class="product-info"><div class="product-title-row"><h3>${product.name}</h3><span class="product-price">${money(product.price)}</span></div>
      <p class="product-purity">${product.purity}</p>
      <button class="add-button" type="button" data-add="${product.id}" aria-label="Add ${product.name} to cart">Add to cart <span aria-hidden="true">+</span></button>
    </div>
  </article>`).join('');

const count = document.querySelector('.cart-count');
const dialog = document.querySelector('#cart-dialog');
const cartItems = document.querySelector('#cart-items');
const total = document.querySelector('#cart-total');

function renderCart(){
  count.textContent = cart.length;
  if(!cart.length){cartItems.innerHTML='<p class="empty-cart">Your cart is waiting for something lovely.</p>';}
  else {cartItems.innerHTML=cart.map((item,index)=>`<div class="cart-row"><img src="${item.image}" alt=""><div><strong>${item.name}</strong><small>${item.purity}</small><button class="remove-item" type="button" data-remove="${index}" aria-label="Remove ${item.name} from cart">Remove</button></div><span class="cart-row-price">${money(item.price)}</span></div>`).join('');}
  total.textContent=money(cart.reduce((sum,item)=>sum+item.price,0));
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
