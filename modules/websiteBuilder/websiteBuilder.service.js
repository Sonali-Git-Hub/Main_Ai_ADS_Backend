const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY || process.env.VERTEX_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Generate Production Website / App Code using Google Gemini
 */
async function generateWebsiteCode(payload = {}) {
  const {
    prompt = 'Build a food delivery app like Zomato',
    brandName = 'FoodDash',
    domainUrl = 'https://fooddash.com',
    logoUrl = '',
    brandColors = ['#10B981', '#059669'],
    templateType = 'ECOMMERCE'
  } = payload;

  const primaryColor = brandColors[0] || '#10B981';
  const secondaryColor = brandColors[1] || '#059669';

  if (!genAI) {
    console.log('Gemini API key missing, returning high quality structured HTML fallback');
    return { success: true, code: buildFallbackWebsite(brandName, primaryColor, secondaryColor, templateType, prompt) };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const systemPrompt = `You are a World-Class Senior Web & Mobile App Developer and UI/UX Designer.
Your task is to generate a COMPLETE, HIGHLY PRODUCTION-READY, FULLY RESPONSIVE Single-Page Web Application or Mobile Web App HTML5 document using Tailwind CSS (via CDN) and FontAwesome icons (via CDN).

BRAND INFORMATION:
- Brand Name: ${brandName}
- Primary Accent Color: ${primaryColor}
- Secondary Color: ${secondaryColor}
- Template / Target Platform: ${templateType}
- User Prompt / Goal: "${prompt}"

STRICT REQUIREMENTS FOR THE GENERATED CODE:
1. Return ONLY pure HTML5 code. Do NOT wrap in markdown code blocks like \`\`\`html. Start directly with <!DOCTYPE html> and end with </html>.
2. Include Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
3. Include FontAwesome CDN: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
4. Configure Tailwind dark mode and brand color palette in head script.
5. IF TEMPLATE IS MOBILE_APP or ECOMMERCE:
   - Provide a Desktop Responsive View AND a Mobile Bottom Navigation Bar (<div class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950 border-t border-slate-800 flex items-center justify-around z-40 px-4">).
6. MANDATORY CTA BEHAVIOR:
   - All Call-To-Action buttons (like "Order Now", "Get Started Free", "Cart", "Launch Workspace") MUST have an onclick attribute calling openLeadModal('CTA Title').
7. Include an interactive Lead Capture Popup Modal (<div id="leadModal" ...>) with a form (Name, Address/Note, Phone) that submits and shows a success state.
8. Make the design wowed, modern, dark slate/emerald or vibrant theme, with glassmorphism cards and smooth transitions.`;

    const result = await model.generateContent(systemPrompt);
    let code = result.response.text().trim();

    // Strip markdown fence if model includes it
    if (code.startsWith('```html')) {
      code = code.replace(/^```html\s*/i, '').replace(/```$/i, '').trim();
    } else if (code.startsWith('```')) {
      code = code.replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    return { success: true, code };
  } catch (err) {
    console.error('Gemini Website Generation Error:', err.message);
    return { success: true, code: buildFallbackWebsite(brandName, primaryColor, secondaryColor, templateType, prompt) };
  }
}

function buildFallbackWebsite(brandName, primaryColor, secondaryColor, templateType, prompt) {
  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brandName} - Fast Delivery & Ordering App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#ecfdf5',
              500: '${primaryColor}',
              600: '${secondaryColor}',
              700: '#047857'
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 font-sans antialiased min-h-screen flex flex-col relative pb-16 md:pb-0">
  <!-- Header Navigation Component -->
  <header class="sticky top-0 z-40 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
    <div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-950 font-extrabold text-xl" style="background-color:${primaryColor}">
          <i class="fa-solid fa-utensils"></i>
        </div>
        <div>
          <span class="font-extrabold text-lg text-white tracking-tight">${brandName}</span>
          <p class="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Fast Delivery App</p>
        </div>
      </div>

      <div class="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 w-72">
        <i class="fa-solid fa-magnifying-glass text-slate-400 text-xs"></i>
        <input type="text" placeholder="Search dishes or categories..." class="bg-transparent text-xs text-white focus:outline-none w-full">
      </div>

      <nav class="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
        <a href="javascript:void(0)" onclick="openLeadModal('Restaurants')" class="hover:text-emerald-400 transition-colors">Restaurants</a>
        <a href="javascript:void(0)" onclick="openLeadModal('Menu')" class="hover:text-emerald-400 transition-colors">Menu Catalog</a>
        <a href="javascript:void(0)" onclick="openLeadModal('Offers')" class="hover:text-emerald-400 transition-colors">Offers</a>
      </nav>

      <button onclick="openLeadModal('Header Cart')" class="px-5 py-2.5 rounded-xl text-slate-950 font-extrabold text-xs transition-all shadow-lg flex items-center gap-2" style="background-color:${primaryColor}">
        <i class="fa-solid fa-cart-shopping"></i> Cart (2)
      </button>
    </div>
  </header>

  <!-- Hero Section Component -->
  <section class="py-16 px-6 text-center space-y-6 max-w-4xl mx-auto">
    <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-extrabold border border-emerald-500/30">
      <i class="fa-solid fa-bolt text-amber-400"></i> 10-Minute Express Delivery
    </span>
    <h1 class="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
      Delicious Meals Delivered Fast to Your Doorstep
    </h1>
    <p class="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
      Order fresh gourmet food online from top local restaurants. Track live GPS location, customize your meal, and pay securely.
    </p>

    <!-- Visual Hero Graphic Banner -->
    <div class="relative max-w-3xl mx-auto rounded-3xl overflow-hidden border border-slate-800 shadow-2xl my-4">
      <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80" alt="${brandName} Hero Graphic" class="w-full h-64 md:h-80 object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent flex items-end p-6">
        <div class="p-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center justify-between w-full">
          <span class="text-xs font-extrabold text-white flex items-center gap-1.5"><i class="fa-solid fa-fire text-amber-400"></i> FLAT 50% OFF Code: FAST50</span>
          <button onclick="openLeadModal('Claim Offer')" class="px-3 py-1.5 rounded-xl text-slate-950 font-extrabold text-xs" style="background-color:${primaryColor}">Claim Offer</button>
        </div>
      </div>
    </div>

    <div class="pt-4 flex flex-wrap justify-center gap-4">
      <button onclick="openLeadModal('Order Food Now')" class="px-8 py-4 rounded-2xl text-slate-950 text-sm font-extrabold shadow-xl transition-all flex items-center gap-2" style="background-color:${primaryColor}">
        <i class="fa-solid fa-burger"></i> Order Food Now &rarr;
      </button>
      <button onclick="openLeadModal('Explore')" class="px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-sm font-extrabold transition-all">
        Explore Menu Catalog
      </button>
    </div>
  </section>

  <!-- Feature Cards Component Grid -->
  <section class="py-12 px-6 max-w-7xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-clock"></i>
        </div>
        <h3 class="text-lg font-extrabold text-white">Superfast Delivery</h3>
        <p class="text-xs text-slate-400">Hot meals delivered to your doorstep in under 15 minutes.</p>
      </div>

      <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <h3 class="text-lg font-extrabold text-white">Hygienic Packaging</h3>
        <p class="text-xs text-slate-400">100% tamper-proof and temperature-controlled food boxes.</p>
      </div>

      <div class="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl font-bold">
          <i class="fa-solid fa-location-dot"></i>
        </div>
        <h3 class="text-lg font-extrabold text-white">Live GPS Tracking</h3>
        <p class="text-xs text-slate-400">Track your delivery driver in real-time on interactive maps.</p>
      </div>
    </div>
  </section>

  <!-- Mobile Bottom Navigation Bar Component -->
  <div class="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-950 border-t border-slate-800 flex items-center justify-around z-40 px-4">
    <button onclick="openLeadModal('Mobile Home')" class="flex flex-col items-center gap-1 text-emerald-400 text-[10px] font-bold">
      <i class="fa-solid fa-house text-base"></i> Home
    </button>
    <button onclick="openLeadModal('Mobile Search')" class="flex flex-col items-center gap-1 text-slate-400 hover:text-white text-[10px] font-bold">
      <i class="fa-solid fa-magnifying-glass text-base"></i> Search
    </button>
    <button onclick="openLeadModal('Mobile Orders')" class="flex flex-col items-center gap-1 text-slate-400 hover:text-white text-[10px] font-bold">
      <i class="fa-solid fa-bag-shopping text-base"></i> Orders
    </button>
    <button onclick="openLeadModal('Mobile Profile')" class="flex flex-col items-center gap-1 text-slate-400 hover:text-white text-[10px] font-bold">
      <i class="fa-solid fa-user text-base"></i> Profile
    </button>
  </div>

  <!-- Interactive Lead Capture Popup Modal Component -->
  <div id="leadModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md hidden items-center justify-center z-50 p-4">
    <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full relative shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
      <button onclick="closeLeadModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors">
        ✕
      </button>
      <div class="text-center space-y-1.5">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-xl font-extrabold">
          🍔
        </div>
        <h3 class="text-xl font-extrabold text-white">Order Food on ${brandName}</h3>
        <p class="text-xs text-slate-400">Fill in your delivery address & contact details below.</p>
      </div>

      <form onsubmit="handleLeadSubmit(event)" class="space-y-3.5">
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Full Name</label>
          <input type="text" id="leadName" required placeholder="Enter your full name" class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Delivery Address</label>
          <input type="text" id="leadNote" required placeholder="Full house address & landmark" class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500">
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-300 mb-1">Phone / WhatsApp</label>
          <input type="tel" id="leadPhone" required placeholder="+91 98765 43210" class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500">
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl text-slate-950 font-extrabold text-xs transition-all shadow-lg" style="background-color:${primaryColor}">
          Confirm Order & Launch Live Tracking &rarr;
        </button>
      </form>

      <div id="leadSuccess" class="hidden text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold space-y-2">
        <p class="text-sm">🎉 Food Order Confirmed!</p>
        <p class="text-[11px] text-slate-300 font-normal">Thank you! Your order has been dispatched via ${brandName}.</p>
      </div>
    </div>
  </div>

  <script>
    function openLeadModal(title) {
      document.getElementById('leadModal').classList.remove('hidden');
      document.getElementById('leadModal').classList.add('flex');
    }

    function closeLeadModal() {
      document.getElementById('leadModal').classList.add('hidden');
      document.getElementById('leadModal').classList.remove('flex');
    }

    function handleLeadSubmit(e) {
      e.preventDefault();
      document.querySelector('#leadModal form').classList.add('hidden');
      document.getElementById('leadSuccess').classList.remove('hidden');
      setTimeout(function() {
        closeLeadModal();
        document.querySelector('#leadModal form').classList.remove('hidden');
        document.getElementById('leadSuccess').classList.add('hidden');
      }, 3500);
    }
  </script>

  <footer class="mt-auto py-8 px-6 border-t border-slate-800 text-center text-xs text-slate-500">
    <p>&copy; ${new Date().getFullYear()} ${brandName}. All rights reserved. Powered by Autonomous AI Website & App Builder Agent.</p>
  </footer>
</body>
</html>`;
}

module.exports = {
  generateWebsiteCode
};
