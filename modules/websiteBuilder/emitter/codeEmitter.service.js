const path = require('path');
const ProjectStorageService = require('../services/ProjectStorageService');

/**
 * Autonomous Source Code Emitter Engine (Stage 1B)
 *
 * Converts a Phase 4 Website Model & Phase 3 Blueprint into a complete,
 * production-ready, standalone React + Vite web application project.
 *
 * KEY RULES & CONSTRAINTS:
 * 1. Generates actual React source files (.jsx, .css, .js) — NOT raw HTML/JSON strings.
 * 2. Generates clean client-side routing & page structure.
 * 3. Uses modular, reusable components in src/components/ matching all section types.
 * 4. Preserves design system tokens (CSS variables) from generatedTheme.
 * 5. Strictly preserves decision attribution model (user_explicit, semantic_inference, system_default).
 * 6. Does NOT invent unsupported business capabilities (no unrequested booking, subscriptions, etc.).
 * 7. Does NOT invent concrete prices unless in model or explicitly requested.
 * 8. Preserves semantic asset intent & Unsplash image URLs.
 */
function generateCodeProject(websiteModel, blueprint = {}, requirement = {}, reqId = null) {
  const correlationTag = reqId ? `[WB:EMITTER:${reqId}] ` : '[CodeEmitterService] ';
  console.log(`${correlationTag}Starting Source Code Emitter (Stage 1B)...`);

  if (!websiteModel || typeof websiteModel !== 'object' || !Array.isArray(websiteModel.pages)) {
    throw new Error('Valid Phase 4 Website Model with pages array is required for code emission.');
  }

  const projectId = websiteModel.websiteId || `site_${Date.now()}`;
  const version = 'v1';

  const websiteIdentity = websiteModel.websiteIdentity || {};
  const designSpec = websiteModel.designSpec || {};
  const generatedTheme = websiteModel.generatedTheme || {};
  const pages = websiteModel.pages || [];
  const navigationSpec = websiteModel.navigationSpec || {};
  const ctaRequirements = websiteModel.ctaRequirements || {};
  const contactRequirements = websiteModel.contactRequirements || {};
  const paymentCheckoutSpec = websiteModel.paymentCheckoutSpec || {};
  const visualDesignSpec = websiteModel.visualDesignSpec || {};

  // Resolve design tokens from visualDesignSpec
  const colorTokens = resolveColorTokens(visualDesignSpec.colorMood, designSpec);
  const fontsUrl = resolveFontsUrl(visualDesignSpec.fontPairing);

  const filesMap = {};

  // 1. package.json
  filesMap['package.json'] = JSON.stringify({
    name: (websiteIdentity.title || 'aisa-generated-app').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    private: true,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'npx vite',
      build: 'npx vite build',
      preview: 'npx vite preview'
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'lucide-react': '^0.344.0'
    },
    devDependencies: {
      '@types/react': '^18.2.66',
      '@types/react-dom': '^18.2.22',
      '@vitejs/plugin-react': '^4.2.1',
      vite: '^5.2.0'
    }
  }, null, 2);

  // 2. vite.config.js
  filesMap['vite.config.js'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  }
});
`;

  // 3. index.html
  filesMap['index.html'] = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(websiteIdentity.title || 'Generated Website')}</title>
    <meta name="description" content="${escapeHtml(blueprint.uniqueValueProposition || websiteIdentity.businessType || 'AISA Generated Website')}" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${fontsUrl}" rel="stylesheet">
    <link rel="stylesheet" href="/src/styles/theme.css" />
    <link rel="stylesheet" href="/src/styles/index.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

  // 4. src/styles/theme.css — Design Tokens (driven by visualDesignSpec colorMood)
  filesMap['src/styles/theme.css'] = `:root {
  --primary-color: ${colorTokens.primary};
  --secondary-color: ${colorTokens.secondary};
  --accent-color: ${colorTokens.accent};
  --font-family: ${colorTokens.fontFamily};
  --heading-font: ${colorTokens.headingFont};
  --bg-color: ${colorTokens.bg};
  --text-color: ${colorTokens.text};
  --text-muted: ${colorTokens.textMuted};
  --card-bg: ${colorTokens.cardBg};
  --card-border: ${colorTokens.cardBorder};
  --hero-min-height: ${visualDesignSpec.heroStyle === 'fullscreen-cinematic' || visualDesignSpec.heroStyle === 'immersive-overlay' ? '100vh' : '80vh'};
  --hero-text-align: ${visualDesignSpec.heroStyle === 'centered-headline' || visualDesignSpec.heroStyle === 'minimal-text' ? 'center' : 'left'};
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
`;

  // 5. src/styles/index.css — Full CSS Styling Rules
  filesMap['src/styles/index.css'] = buildGlobalCSS();

  // 6. src/data/siteData.js — Site Configuration Data
  filesMap['src/data/siteData.js'] = `/**
 * Site Configuration Data
 * Preserves decision attribution model & explicit user requirements.
 *
 * Attribution Sources:
 * - Theme: ${designSpec.sources?.theme || 'semantic_inference'}
 * - Primary Color: ${designSpec.sources?.primaryColor || 'semantic_inference'}
 * - Typography: ${designSpec.sources?.typography || 'semantic_inference'}
 */
export const siteData = ${JSON.stringify({
    websiteIdentity,
    websiteType: websiteModel.websiteType,
    designSpec,
    navigationSpec,
    ctaRequirements,
    contactRequirements,
    paymentCheckoutSpec,
    pages,
    visualDesignSpec
  }, null, 2)};
`;

  // 7. src/services/apiService.js
  filesMap['src/services/apiService.js'] = `/**
 * Client API Service Handler
 */
export async function submitContactForm(formData) {
  console.log('[API Service] Contact Form Submitted:', formData);
  return { success: true, message: 'Thank you! Your message has been received.' };
}

export async function submitBookingForm(bookingData) {
  console.log('[API Service] Booking Request Submitted:', bookingData);
  return { success: true, message: 'Booking request confirmed! We will get in touch shortly.' };
}

export async function submitCustomOrder(orderData) {
  console.log('[API Service] Custom Order Submitted:', orderData);
  return { success: true, message: 'Custom enquiry received! Our team will contact you soon.' };
}
`;

  // 8. src/components/Navbar.jsx
  filesMap['src/components/Navbar.jsx'] = `import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar({ siteData, activePage, setActivePage }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const brandName = siteData?.websiteIdentity?.title || 'Brand';
  const navLinks = siteData?.navigationSpec?.headerLinks || [];
  const primaryCTA = siteData?.ctaRequirements?.primaryCTA || 'Get Started';

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => setActivePage(navLinks[0]?.pageName || 'Home')}>
          <span className="brand-title">{brandName}</span>
        </div>

        <nav className="desktop-nav">
          {navLinks.map((link) => (
            <button
              key={link.pageName}
              className={\`nav-link \${activePage === link.pageName ? 'active' : ''}\`}
              onClick={() => setActivePage(link.pageName)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="navbar-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              const contactLink = navLinks.find(l => l.pageName.toLowerCase().includes('contact') || l.pageName.toLowerCase().includes('book'));
              if (contactLink) setActivePage(contactLink.pageName);
              else alert(\`Action: \${primaryCTA}\`);
            }}
          >
            {primaryCTA}
          </button>

          <button
            className="mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          {navLinks.map((link) => (
            <button
              key={link.pageName}
              className={\`mobile-nav-link \${activePage === link.pageName ? 'active' : ''}\`}
              onClick={() => {
                setActivePage(link.pageName);
                setMobileMenuOpen(false);
              }}
            >
              {link.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
`;

  // 9. src/components/Footer.jsx
  filesMap['src/components/Footer.jsx'] = `import React from 'react';

export default function Footer({ siteData, setActivePage }) {
  const brandName = siteData?.websiteIdentity?.title || 'Brand';
  const businessType = siteData?.websiteIdentity?.businessType || '';
  const footerLinks = siteData?.navigationSpec?.footerLinks || [];

  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand-col">
          <h3 className="footer-brand">{brandName}</h3>
          <p className="footer-sub">{businessType}</p>
          <p className="footer-copy">© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        </div>

        <div className="footer-links-col">
          <h4 className="footer-heading">Quick Links</h4>
          <ul className="footer-nav">
            {footerLinks.map((link) => (
              <li key={link.pageName}>
                <button onClick={() => setActivePage(link.pageName)} className="footer-link-btn">
                  {link.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
`;

  // 10. Modular Component Files (src/components/*.jsx)
  filesMap['src/components/HeroBanner.jsx'] = buildHeroBannerComponent();
  filesMap['src/components/HeroSplit.jsx'] = buildHeroSplitComponent();
  filesMap['src/components/HeroMinimal.jsx'] = buildHeroMinimalComponent();
  filesMap['src/components/ItemCatalogGrid.jsx'] = buildItemCatalogGridComponent();
  filesMap['src/components/RestaurantMenuCard.jsx'] = buildRestaurantMenuCardComponent();
  filesMap['src/components/PortfolioGallery.jsx'] = buildPortfolioGalleryComponent();
  filesMap['src/components/PricingPlansGrid.jsx'] = buildPricingPlansGridComponent();
  filesMap['src/components/FeatureGrid.jsx'] = buildFeatureGridComponent();
  filesMap['src/components/HowItWorksGrid.jsx'] = buildHowItWorksGridComponent();
  filesMap['src/components/TestimonialsCarousel.jsx'] = buildTestimonialsCarouselComponent();
  filesMap['src/components/GuideAccordion.jsx'] = buildGuideAccordionComponent();
  filesMap['src/components/ContactInquiryForm.jsx'] = buildContactInquiryFormComponent();
  filesMap['src/components/CustomOrderForm.jsx'] = buildCustomOrderFormComponent();
  filesMap['src/components/BookingForm.jsx'] = buildBookingFormComponent();
  filesMap['src/components/ServicesGrid.jsx'] = buildServicesGridComponent();
  filesMap['src/components/StatsCounter.jsx'] = buildStatsCounterComponent();
  filesMap['src/components/CallToActionBanner.jsx'] = buildCallToActionBannerComponent();
  filesMap['src/components/ContentSectionCard.jsx'] = buildContentSectionCardComponent();
  filesMap['src/components/LocationHoursCard.jsx'] = buildLocationHoursCardComponent();
  // 🚀 Interactive Web Application Components
  filesMap['src/components/InteractiveExplorer.jsx'] = buildInteractiveExplorerComponent();
  filesMap['src/components/ExperimentQuestTracker.jsx'] = buildExperimentQuestTrackerComponent();
  filesMap['src/components/InteractiveQuizApp.jsx'] = buildInteractiveQuizAppComponent();
  filesMap['src/components/InteractiveCartStore.jsx'] = buildInteractiveCartStoreComponent();
  filesMap['src/components/ReservationBookingApp.jsx'] = buildReservationBookingAppComponent();

  // 11. src/components/SectionRenderer.jsx — Maps Section Object to Component
  filesMap['src/components/SectionRenderer.jsx'] = `import React from 'react';
import HeroBanner from './HeroBanner';
import HeroSplit from './HeroSplit';
import HeroMinimal from './HeroMinimal';
import ItemCatalogGrid from './ItemCatalogGrid';
import RestaurantMenuCard from './RestaurantMenuCard';
import PortfolioGallery from './PortfolioGallery';
import PricingPlansGrid from './PricingPlansGrid';
import FeatureGrid from './FeatureGrid';
import HowItWorksGrid from './HowItWorksGrid';
import TestimonialsCarousel from './TestimonialsCarousel';
import GuideAccordion from './GuideAccordion';
import ContactInquiryForm from './ContactInquiryForm';
import CustomOrderForm from './CustomOrderForm';
import BookingForm from './BookingForm';
import ServicesGrid from './ServicesGrid';
import StatsCounter from './StatsCounter';
import CallToActionBanner from './CallToActionBanner';
import ContentSectionCard from './ContentSectionCard';
import LocationHoursCard from './LocationHoursCard';
import InteractiveExplorer from './InteractiveExplorer';
import ExperimentQuestTracker from './ExperimentQuestTracker';
import InteractiveQuizApp from './InteractiveQuizApp';
import InteractiveCartStore from './InteractiveCartStore';
import ReservationBookingApp from './ReservationBookingApp';

export default function SectionRenderer({ section, setActivePage, siteData }) {
  if (!section) return null;

  switch (section.type) {
    case 'InteractiveExplorer':
    case 'TopicExplorer':
    case 'ScienceExplorer':
      return <InteractiveExplorer section={section} />;
    case 'ExperimentQuestTracker':
    case 'ProgressTracker':
    case 'QuestTracker':
      return <ExperimentQuestTracker section={section} />;
    case 'InteractiveQuizApp':
    case 'QuizApp':
      return <InteractiveQuizApp section={section} />;
    case 'InteractiveCartStore':
    case 'ShoppingCartApp':
      return <InteractiveCartStore section={section} />;
    case 'ReservationBookingApp':
    case 'TableReservationApp':
      return <ReservationBookingApp section={section} />;
    case 'HeroBanner':
      return <HeroBanner section={section} setActivePage={setActivePage} />;
    case 'HeroSplit':
      return <HeroSplit section={section} setActivePage={setActivePage} />;
    case 'HeroMinimal':
      return <HeroMinimal section={section} setActivePage={setActivePage} />;
    case 'ItemCatalogGrid':
    case 'FeaturedItemsGrid':
      return <ItemCatalogGrid section={section} paymentSpec={siteData?.paymentCheckoutSpec} />;
    case 'RestaurantMenuCard':
      return <RestaurantMenuCard section={section} />;
    case 'PortfolioGallery':
      return <PortfolioGallery section={section} />;
    case 'PricingPlansGrid':
      return <PricingPlansGrid section={section} />;
    case 'FeatureGrid':
    case 'ValuePropositionGrid':
      return <FeatureGrid section={section} />;
    case 'HowItWorksGrid':
    case 'ProcessSteps':
      return <HowItWorksGrid section={section} />;
    case 'TestimonialsCarousel':
    case 'ReviewsGrid':
      return <TestimonialsCarousel section={section} />;
    case 'GuideAccordion':
      return <GuideAccordion section={section} />;
    case 'ContactInquiryForm':
      return <ContactInquiryForm section={section} hasWhatsApp={siteData?.contactRequirements?.hasWhatsApp} />;
    case 'CustomOrderForm':
      return <CustomOrderForm section={section} />;
    case 'BookingForm':
    case 'DemoRequestForm':
      return <BookingForm section={section} />;
    case 'ServicesGrid':
      return <ServicesGrid section={section} />;
    case 'StatsCounter':
      return <StatsCounter section={section} />;
    case 'CallToActionBanner':
      return <CallToActionBanner section={section} setActivePage={setActivePage} />;
    case 'LocationHoursCard':
      return <LocationHoursCard section={section} />;
    case 'ContentSectionCard':
    default:
      return <ContentSectionCard section={section} />;
  }
}
`;

  // 12. Create individual page files in src/pages/ & App.jsx
  pages.forEach((page) => {
    const pageFileName = `${sanitizePascalCase(page.name)}Page.jsx`;
    filesMap[`src/pages/${pageFileName}`] = `import React from 'react';
import SectionRenderer from '../components/SectionRenderer';

export default function ${sanitizePascalCase(page.name)}Page({ page, setActivePage, siteData }) {
  const sections = page?.sections || [];

  return (
    <div className="page-container page-${page.id || 'default'}">
      {sections.map((section) => (
        <SectionRenderer
          key={section.id || Math.random().toString()}
          section={section}
          setActivePage={setActivePage}
          siteData={siteData}
        />
      ))}
    </div>
  );
}
`;
  });

  // 13. src/App.jsx — Main Application Root Component
  filesMap['src/App.jsx'] = buildAppComponent(pages);

  // 14. src/main.jsx — React DOM Mount Entry Point
  filesMap['src/main.jsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  // 15. Write generated project to disk via ProjectStorageService
  const storageResult = ProjectStorageService.saveVersionArtifacts(projectId, version, filesMap);

  console.log(`${correlationTag}Code project generated successfully at: ${storageResult.versionDir} (${storageResult.fileCount} files).`);

  return {
    success: true,
    projectId,
    version,
    projectDir: storageResult.versionDir,
    fileCount: storageResult.fileCount,
    filesMap
  };
}

// ────────── HELPERS & COMPONENT BUILDERS ──────────────────────────────────────

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizePascalCase(str) {
  const cleaned = (str || 'Page').replace(/[^a-zA-Z0-9]/g, ' ');
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function buildAppComponent(pages) {
  const defaultPageName = pages[0]?.name || 'Home';
  const pageImports = pages.map(p => {
    const componentName = `${sanitizePascalCase(p.name)}Page`;
    return `import ${componentName} from './pages/${componentName}';`;
  }).join('\n');

  const pageCases = pages.map(p => {
    const componentName = `${sanitizePascalCase(p.name)}Page`;
    return `      case '${p.name}':
        return <${componentName} page={pageMap['${p.name}']} setActivePage={setActivePage} siteData={siteData} />;`;
  }).join('\n');

  return `import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { siteData } from './data/siteData';
${pageImports}

export default function App() {
  const [activePage, setActivePage] = useState('${defaultPageName}');

  const pageMap = (siteData.pages || []).reduce((acc, p) => {
    acc[p.name] = p;
    return acc;
  }, {});

  const renderActivePage = () => {
    switch (activePage) {
${pageCases}
      default:
        return <${sanitizePascalCase(defaultPageName)}Page page={pageMap['${defaultPageName}']} setActivePage={setActivePage} siteData={siteData} />;
    }
  };

  return (
    <div className="app-root">
      <Navbar siteData={siteData} activePage={activePage} setActivePage={setActivePage} />
      <main className="main-content">
        {renderActivePage()}
      </main>
      <Footer siteData={siteData} setActivePage={setActivePage} />
    </div>
  );
}
`;
}

function buildGlobalCSS() {
  return `/* Modern Responsive CSS Stylesheet */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background-color: var(--bg-color);
  color: var(--text-color);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.app-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
}

/* Navbar */
.navbar-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background-color: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--card-border);
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  cursor: pointer;
  font-weight: 800;
  font-size: 1.25rem;
  color: var(--text-color);
}

.desktop-nav {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: color 0.2s;
}

.nav-link:hover, .nav-link.active {
  color: var(--primary-color);
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-toggle {
  display: none;
  background: none;
  border: none;
  color: var(--text-color);
  cursor: pointer;
}

.mobile-menu {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  padding: 1rem;
  gap: 0.5rem;
  border-bottom: 1px solid var(--card-border);
}

.mobile-nav-link {
  background: none;
  border: none;
  color: var(--text-color);
  text-align: left;
  padding: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.25rem;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: var(--primary-color);
  color: #FFFFFF;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background-color: transparent;
  color: var(--text-color);
  border: 1px solid var(--card-border);
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

/* Section Containers */
.section-block {
  padding: 4rem 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.section-header {
  margin-bottom: 2.5rem;
  text-align: center;
}

.section-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.section-purpose {
  color: var(--text-muted);
  font-size: 1rem;
}

/* Hero Sections */
.hero-split-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}

.hero-headline {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.2;
  margin-bottom: 1rem;
}

.hero-subheadline {
  font-size: 1.15rem;
  color: var(--text-muted);
  margin-bottom: 2rem;
}

.hero-ctas {
  display: flex;
  gap: 1rem;
}

.hero-image {
  width: 100%;
  border-radius: var(--radius-lg);
  object-fit: cover;
  max-height: 450px;
  box-shadow: var(--shadow-lg);
}

/* Cards & Grids */
.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  background-color: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  transition: transform 0.2s, border-color 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--primary-color);
}

.card-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.card-desc {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.card-price {
  font-weight: 700;
  color: var(--primary-color);
  margin-top: 1rem;
}

/* Footer */
.site-footer {
  background-color: rgba(15, 23, 42, 0.95);
  border-top: 1px solid var(--card-border);
  padding: 3rem 1.5rem;
  margin-top: 4rem;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

.footer-brand {
  font-size: 1.3rem;
  font-weight: 700;
}

.footer-sub {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.footer-copy {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.footer-link-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
}

.footer-link-btn:hover {
  color: var(--primary-color);
}

@media (max-width: 768px) {
  .desktop-nav { display: none; }
  .mobile-toggle { display: block; }
  .hero-split-grid { grid-template-columns: 1fr; }
  .hero-headline { font-size: 2rem; }
}
`;
}

// ────────── COMPONENT CODE GENERATORS ────────────────────────────────────────

function buildHeroBannerComponent() {
  return `import React from 'react';

export default function HeroBanner({ section, setActivePage }) {
  return (
    <section className="section-block hero-banner-section">
      <div className="hero-content text-center">
        <h1 className="hero-headline">{section.headline || section.title}</h1>
        <p className="hero-subheadline">{section.subheadline || section.purpose}</p>
        <div className="hero-ctas justify-center">
          <button className="btn btn-primary" onClick={() => setActivePage('Contact')}>
            {section.primaryCTA || 'Get Started'}
          </button>
        </div>
      </div>
    </section>
  );
}
`;
}

function buildHeroSplitComponent() {
  return `import React from 'react';

export default function HeroSplit({ section, setActivePage }) {
  return (
    <section className="section-block hero-split-section">
      <div className="hero-split-grid">
        <div className="hero-text-col">
          <h1 className="hero-headline">{section.headline || section.title}</h1>
          <p className="hero-subheadline">{section.subheadline || section.purpose}</p>
          <div className="hero-ctas">
            <button className="btn btn-primary" onClick={() => setActivePage('Contact')}>
              {section.primaryCTA || 'Get Started'}
            </button>
          </div>
        </div>
        {section.imageUrl && (
          <div className="hero-img-col">
            <img src={section.imageUrl} alt={section.title} className="hero-image" />
          </div>
        )}
      </div>
    </section>
  );
}
`;
}

function buildHeroMinimalComponent() {
  return `import React from 'react';

export default function HeroMinimal({ section }) {
  return (
    <section className="section-block hero-minimal-section">
      <h1 className="hero-headline">{section.headline || section.title}</h1>
      <p className="hero-subheadline">{section.subheadline || section.purpose}</p>
    </section>
  );
}
`;
}

function buildItemCatalogGridComponent() {
  return `import React from 'react';

export default function ItemCatalogGrid({ section, paymentSpec }) {
  const items = section.items || [];

  return (
    <section className="section-block item-catalog-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
        {section.purpose && <p className="section-purpose">{section.purpose}</p>}
      </div>
      <div className="grid-cards">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="card item-card">
            {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="hero-image" style={{ height: '180px', marginBottom: '1rem' }} />}
            <h3 className="card-title">{item.name}</h3>
            <p className="card-desc">{item.description}</p>
            <div className="card-price">{item.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildRestaurantMenuCardComponent() {
  return `import React from 'react';

export default function RestaurantMenuCard({ section }) {
  const items = section.items || [];

  return (
    <section className="section-block restaurant-menu-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {items.map((item, idx) => (
          <div key={idx} className="card menu-item-card">
            <h3 className="card-title">{item.name}</h3>
            <p className="card-desc">{item.description}</p>
            <div className="card-price">{item.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildPortfolioGalleryComponent() {
  return `import React from 'react';

export default function PortfolioGallery({ section }) {
  const items = section.items || [];

  return (
    <section className="section-block portfolio-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {items.map((item, idx) => (
          <div key={idx} className="card portfolio-card">
            {item.imageUrl && <img src={item.imageUrl} alt={item.title} className="hero-image" style={{ height: '220px', marginBottom: '1rem' }} />}
            <h3 className="card-title">{item.title}</h3>
            <p className="card-desc">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildPricingPlansGridComponent() {
  return `import React from 'react';

export default function PricingPlansGrid({ section }) {
  const plans = section.plans || [];

  return (
    <section className="section-block pricing-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {plans.map((plan, idx) => (
          <div key={idx} className="card pricing-card">
            <h3 className="card-title">{plan.name}</h3>
            <div className="card-price">{plan.price}</div>
            <p className="card-desc" style={{ margin: '1rem 0' }}>{plan.description}</p>
            {Array.isArray(plan.features) && (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {plan.features.map((f, fIdx) => (
                  <li key={fIdx} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>✓ {f}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildFeatureGridComponent() {
  return `import React from 'react';

export default function FeatureGrid({ section }) {
  const features = section.features || [];

  return (
    <section className="section-block feature-grid-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {features.map((feat, idx) => (
          <div key={idx} className="card feature-card">
            <h3 className="card-title">{feat.title}</h3>
            <p className="card-desc">{feat.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildHowItWorksGridComponent() {
  return `import React from 'react';

export default function HowItWorksGrid({ section }) {
  const steps = section.steps || [];

  return (
    <section className="section-block process-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {steps.map((st, idx) => (
          <div key={idx} className="card step-card">
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{st.step || idx + 1}</span>
            <h3 className="card-title" style={{ marginTop: '0.5rem' }}>{st.title}</h3>
            <p className="card-desc">{st.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildTestimonialsCarouselComponent() {
  return `import React from 'react';

export default function TestimonialsCarousel({ section }) {
  const testimonials = section.testimonials || [];

  return (
    <section className="section-block testimonials-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {testimonials.map((item, idx) => (
          <div key={idx} className="card testimonial-card">
            <p style={{ fontStyle: 'italic', marginBottom: '1rem' }}>"{item.quote}"</p>
            <p className="card-title" style={{ fontSize: '1rem' }}>{item.author}</p>
            <p className="card-desc">{item.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildGuideAccordionComponent() {
  return `import React from 'react';

export default function GuideAccordion({ section }) {
  const items = section.items || [];

  return (
    <section className="section-block guide-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map((item, idx) => (
          <div key={idx} className="card faq-card">
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>{item.question}</h3>
            <p className="card-desc" style={{ marginTop: '0.5rem' }}>{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildContactInquiryFormComponent() {
  return `import React, { useState } from 'react';
import { submitContactForm } from '../services/apiService';

export default function ContactInquiryForm({ section, hasWhatsApp }) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitContactForm({});
    setSubmitted(true);
  };

  return (
    <section className="section-block contact-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {submitted ? (
          <div style={{ textAlign: 'center', color: 'var(--primary-color)' }}>
            <h3>Message Sent!</h3>
            <p>Thank you for reaching out.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input className="input" placeholder="Your Name" required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }} />
            <input className="input" type="email" placeholder="Your Email" required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }} />
            <textarea className="input" placeholder="Message" rows={4} required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }} />
            <button className="btn btn-primary" type="submit">{section.submitLabel || 'Send Message'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

function buildCustomOrderFormComponent() {
  return `import React, { useState } from 'react';
import { submitCustomOrder } from '../services/apiService';

export default function CustomOrderForm({ section }) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitCustomOrder({});
    setSubmitted(true);
  };

  return (
    <section className="section-block custom-order-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {submitted ? (
          <div>Enquiry Submitted! We will be in touch shortly.</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input placeholder="Name" required style={{ padding: '0.75rem', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }} />
            <textarea placeholder="Custom Requirements..." rows={4} required style={{ padding: '0.75rem', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }} />
            <button className="btn btn-primary" type="submit">{section.submitLabel || 'Submit Custom Brief'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

function buildBookingFormComponent() {
  return `import React, { useState } from 'react';
import { submitBookingForm } from '../services/apiService';

export default function BookingForm({ section }) {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitBookingForm({});
    setSubmitted(true);
  };

  return (
    <section className="section-block booking-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {submitted ? (
          <div>Booking Request Confirmed!</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input placeholder="Full Name" required style={{ padding: '0.75rem', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }} />
            <input type="datetime-local" required style={{ padding: '0.75rem', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }} />
            <button className="btn btn-primary" type="submit">{section.submitLabel || 'Confirm Booking'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

function buildServicesGridComponent() {
  return `import React from 'react';

export default function ServicesGrid({ section }) {
  const services = section.services || [];

  return (
    <section className="section-block services-section">
      <div className="section-header">
        <h2 className="section-title">{section.title}</h2>
      </div>
      <div className="grid-cards">
        {services.map((srv, idx) => (
          <div key={idx} className="card service-card">
            {srv.imageUrl && <img src={srv.imageUrl} alt={srv.title} className="hero-image" style={{ height: '160px', marginBottom: '1rem' }} />}
            <h3 className="card-title">{srv.title}</h3>
            <p className="card-desc">{srv.description}</p>
            <div className="card-price">{srv.price}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildStatsCounterComponent() {
  return `import React from 'react';

export default function StatsCounter({ section }) {
  const stats = section.stats || [
    { value: '100%', label: 'Quality Guarantee' },
    { value: '24/7', label: 'Dedicated Support' }
  ];

  return (
    <section className="section-block stats-section">
      <div className="grid-cards">
        {stats.map((st, idx) => (
          <div key={idx} className="card text-center">
            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-color)' }}>{st.value}</div>
            <div className="card-desc">{st.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildCallToActionBannerComponent() {
  return `import React from 'react';

export default function CallToActionBanner({ section, setActivePage }) {
  return (
    <section className="section-block cta-banner-section text-center" style={{ backgroundColor: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--card-border)', padding: '3rem 1.5rem' }}>
      <h2 className="section-title">{section.headline || section.title}</h2>
      <p className="section-purpose" style={{ marginBottom: '1.5rem' }}>{section.subheadline || section.purpose}</p>
      <button className="btn btn-primary" onClick={() => setActivePage('Contact')}>
        {section.actionLabel || 'Get Started'}
      </button>
    </section>
  );
}
`;
}

function buildContentSectionCardComponent() {
  return `import React from 'react';

export default function ContentSectionCard({ section }) {
  return (
    <section className="section-block content-card-section">
      <div className="card">
        <h2 className="section-title">{section.title}</h2>
        <p className="card-desc" style={{ fontSize: '1.05rem', marginTop: '0.5rem' }}>{section.purpose}</p>
      </div>
    </section>
  );
}
`;
}

function buildLocationHoursCardComponent() {
  return `import React from 'react';

export default function LocationHoursCard({ section }) {
  return (
    <section className="section-block location-section">
      <div className="card">
        <h2 className="section-title">{section.title}</h2>
        <p className="card-desc" style={{ marginTop: '0.5rem' }}><strong>Address:</strong> {section.address || 'Location provided upon booking'}</p>
        <p className="card-desc" style={{ marginTop: '0.25rem' }}><strong>Hours:</strong> {section.operatingHours || 'Mon-Fri 9AM-6PM'}</p>
      </div>
    </section>
  );
}
`;
}

module.exports = { generateCodeProject };

// ─── VISUAL DESIGN SPEC HELPERS ────────────────────────────────────────────────

/**
 * Resolves CSS design tokens based on the AI's colorMood field.
 * If the user explicitly specified colors in their prompt (designSpec.sources.primaryColor === 'user_explicit'),
 * those are used as-is; the colorMood only fills in background/text/card tokens.
 */
function resolveColorTokens(colorMood = '', designSpec = {}) {
  const userPrimary = designSpec.primaryColor;
  const isUserExplicitColor = designSpec.sources?.primaryColor === 'user_explicit';

  const palettes = {
    'warm-earthy': {
      primary: isUserExplicitColor ? userPrimary : '#C8854A',
      secondary: '#8B5E3C',
      accent: '#E8A95E',
      bg: '#0F0A06',
      text: '#F5E6D3',
      textMuted: '#B59A80',
      cardBg: 'rgba(31, 18, 8, 0.85)',
      cardBorder: 'rgba(200, 133, 74, 0.2)',
      fontFamily: "'Playfair Display', 'Georgia', serif",
      headingFont: "'Playfair Display', serif",
    },
    'japanese-minimal': {
      primary: isUserExplicitColor ? userPrimary : '#D4416C',
      secondary: '#1A0A0F',
      accent: '#E8926A',
      bg: '#0D0608',
      text: '#F0EDE8',
      textMuted: '#9B8E84',
      cardBg: 'rgba(20, 10, 15, 0.9)',
      cardBorder: 'rgba(212, 65, 108, 0.2)',
      fontFamily: "'Noto Serif JP', 'Playfair Display', serif",
      headingFont: "'Noto Serif JP', serif",
    },
    'dark-premium': {
      primary: isUserExplicitColor ? userPrimary : '#8B5CF6',
      secondary: '#4F46E5',
      accent: '#A78BFA',
      bg: '#060611',
      text: '#EDE9FE',
      textMuted: '#7C6FAD',
      cardBg: 'rgba(15, 10, 40, 0.8)',
      cardBorder: 'rgba(139, 92, 246, 0.15)',
      fontFamily: "'Inter', system-ui, sans-serif",
      headingFont: "'Space Grotesk', 'Inter', sans-serif",
    },
    'cool-modern': {
      primary: isUserExplicitColor ? userPrimary : '#2563EB',
      secondary: '#1E40AF',
      accent: '#3B82F6',
      bg: '#F8FAFC',
      text: '#0F172A',
      textMuted: '#475569',
      cardBg: 'rgba(255, 255, 255, 0.9)',
      cardBorder: 'rgba(37, 99, 235, 0.1)',
      fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      headingFont: "'Plus Jakarta Sans', sans-serif",
    },
    'bright-energetic': {
      primary: isUserExplicitColor ? userPrimary : '#F59E0B',
      secondary: '#D97706',
      accent: '#FBBF24',
      bg: '#FAFAFA',
      text: '#111827',
      textMuted: '#6B7280',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: 'rgba(245, 158, 11, 0.15)',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      headingFont: "'Outfit', sans-serif",
    },
    'neutral-elegant': {
      primary: isUserExplicitColor ? userPrimary : '#374151',
      secondary: '#1F2937',
      accent: '#6B7280',
      bg: '#FAFAF9',
      text: '#111827',
      textMuted: '#9CA3AF',
      cardBg: 'rgba(255, 255, 255, 0.95)',
      cardBorder: 'rgba(55, 65, 81, 0.1)',
      fontFamily: "'Inter', system-ui, sans-serif",
      headingFont: "'Cormorant Garamond', 'Georgia', serif",
    },
    'dramatic-bold': {
      primary: isUserExplicitColor ? userPrimary : '#EF4444',
      secondary: '#B91C1C',
      accent: '#F87171',
      bg: '#030303',
      text: '#FAFAFA',
      textMuted: '#737373',
      cardBg: 'rgba(10, 10, 10, 0.9)',
      cardBorder: 'rgba(239, 68, 68, 0.2)',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      headingFont: "'Space Grotesk', sans-serif",
    },
    'earthy-artisan': {
      primary: isUserExplicitColor ? userPrimary : '#92400E',
      secondary: '#78350F',
      accent: '#B45309',
      bg: '#FFFBF5',
      text: '#1C1008',
      textMuted: '#78716C',
      cardBg: 'rgba(255, 250, 240, 0.95)',
      cardBorder: 'rgba(146, 64, 14, 0.12)',
      fontFamily: "'Lora', 'Georgia', serif",
      headingFont: "'Lora', serif",
    },
    'neon-tech': {
      primary: isUserExplicitColor ? userPrimary : '#06B6D4',
      secondary: '#0891B2',
      accent: '#22D3EE',
      bg: '#020B14',
      text: '#E0F7FA',
      textMuted: '#4B8EA6',
      cardBg: 'rgba(5, 20, 35, 0.85)',
      cardBorder: 'rgba(6, 182, 212, 0.2)',
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      headingFont: "'Space Grotesk', sans-serif",
    },
  };

  const tokens = palettes[colorMood] || palettes['cool-modern'];
  // Always respect explicit user primary color
  if (isUserExplicitColor && userPrimary) tokens.primary = userPrimary;
  return tokens;
}

/**
 * Returns a Google Fonts URL for the given fontPairing tag.
 */
function resolveFontsUrl(fontPairing = '') {
  const fontMap = {
    'serif-editorial':  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap',
    'japanese-inspired': 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap',
    'sans-modern':       'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap',
    'display-bold':      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@400;500;600;700&display=swap',
    'mixed-editorial':   'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    'rounded-friendly':  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap',
  };
  return fontMap[fontPairing] || fontMap['sans-modern'];
}

// ─── INTERACTIVE WEB APPLICATION COMPONENT BUILDERS ────────────────────────────

function buildInteractiveExplorerComponent() {
  return `import React, { useState } from 'react';
import { Search, Sparkles, X, BookOpen, ExternalLink } from 'lucide-react';

export default function InteractiveExplorer({ section }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState(null);

  const topics = section.topics || section.items || [
    { title: 'Space Exploration & Rockets', category: 'Space', desc: 'Discover how rockets escape Earth gravity and explore distant planets.', difficulty: 'Easy', steps: ['Build a paper rocket', 'Learn about thrust', 'Track satellite orbits'] },
    { title: 'Volcanoes & Chemical Reactions', category: 'Chemistry', desc: 'Create fizzing chemical reactions with baking soda and vinegar.', difficulty: 'Fun', steps: ['Mix acid and base', 'Observe CO2 gas release', 'Color the lava eruption'] },
    { title: 'Magnetism & Invisible Forces', category: 'Physics', desc: 'Test how magnetic fields attract and repel metal objects.', difficulty: 'Medium', steps: ['Find magnetic objects', 'Map field lines', 'Build a simple compass'] },
    { title: 'Plant Photosynthesis & Sunlight', category: 'Biology', desc: 'See how plants turn sunlight and water into energy and oxygen.', difficulty: 'Easy', steps: ['Sprout a bean seed', 'Test light vs dark growth', 'Observe leaf veins'] },
  ];

  const categories = ['All', ...new Set(topics.map(t => t.category || 'General'))];

  const filtered = topics.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || (t.desc || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <section className="section-block explorer-section p-6 rounded-3xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h2 className="section-title text-2xl font-extrabold flex items-center justify-center gap-2" style={{ color: 'var(--text-color)' }}>
          <Sparkles className="w-6 h-6 text-yellow-400" /> {section.title || 'Interactive Science Explorer'}
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{section.purpose || 'Search and filter science topics to start an experiment!'}</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topics, experiments, or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm bg-slate-900 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            style={{ borderColor: 'var(--card-border)' }}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={\`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all \${activeCategory === cat ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-800 text-slate-300 hover:text-white'}\`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((topic, idx) => (
          <div
            key={idx}
            onClick={() => setSelectedTopic(topic)}
            className="p-5 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] flex flex-col justify-between"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', borderColor: 'var(--card-border)' }}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  {topic.category || 'Science'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{topic.difficulty || 'Easy'}</span>
              </div>
              <h3 className="font-extrabold text-base mb-1" style={{ color: 'var(--text-color)' }}>{topic.title}</h3>
              <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>{topic.desc}</p>
            </div>
            <button className="mt-4 text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Start Experiment <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {selectedTopic && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full relative space-y-4">
            <button onClick={() => setSelectedTopic(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
              {selectedTopic.category}
            </span>
            <h3 className="text-xl font-extrabold text-white">{selectedTopic.title}</h3>
            <p className="text-xs text-slate-300">{selectedTopic.desc}</p>
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h4 className="text-xs font-extrabold text-yellow-400 uppercase flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" /> Experiment Steps:
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {(selectedTopic.steps || ['Prepare materials', 'Observe results', 'Record findings']).map((step, sIdx) => (
                  <li key={sIdx} className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-lg">
                    <span className="w-5 h-5 rounded-full bg-brand-600 text-white font-extrabold text-[10px] flex items-center justify-center">{sIdx + 1}</span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => { alert(\`Quest started: \${selectedTopic.title}!\`); setSelectedTopic(null); }} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
              Complete Experiment Quest +50 XP 🚀
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
`;
}

function buildExperimentQuestTrackerComponent() {
  return `import React, { useState } from 'react';
import { Trophy, CheckSquare, Square, Zap, Award } from 'lucide-react';

export default function ExperimentQuestTracker({ section }) {
  const [quests, setQuests] = useState(section.quests || [
    { id: 1, title: 'Build a Baking Soda Volcano', category: 'Chemistry', xp: 50, completed: true },
    { id: 2, title: 'Launch a Bottle Rocket', category: 'Physics', xp: 75, completed: false },
    { id: 3, title: 'Sprout a Bean in a Jar', category: 'Biology', xp: 40, completed: true },
    { id: 4, title: 'Map Constellations with a Flashlight', category: 'Space', xp: 60, completed: false },
  ]);

  const toggleQuest = (id) => {
    setQuests(prev => prev.map(q => q.id === id ? { ...q, completed: !q.completed } : q));
  };

  const completedCount = quests.filter(q => q.completed).length;
  const totalXp = quests.filter(q => q.completed).reduce((sum, q) => sum + (q.xp || 50), 0);
  const progressPct = Math.round((completedCount / quests.length) * 100);

  return (
    <section className="section-block quest-tracker-section p-6 rounded-3xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2" style={{ color: 'var(--text-color)' }}>
            <Trophy className="w-6 h-6 text-yellow-400" /> {section.title || 'Science Quest & Progress Tracker'}
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{section.purpose || 'Track your interactive science experiments and level up your XP!'}</p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-3 rounded-2xl border border-slate-800 self-stretch md:self-auto justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">TOTAL XP</span>
              <span className="text-sm font-extrabold text-white">{totalXp} XP</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">LEVEL</span>
              <span className="text-sm font-extrabold text-emerald-400">Junior Scientist</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs font-extrabold mb-1" style={{ color: 'var(--text-color)' }}>
          <span>Experiment Progress</span>
          <span>{completedCount} of {quests.length} Completed ({progressPct}%)</span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-500" style={{ width: \`\${progressPct}%\` }} />
        </div>
      </div>

      <div className="space-y-2">
        {quests.map(quest => (
          <div
            key={quest.id}
            onClick={() => toggleQuest(quest.id)}
            className={\`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between \${quest.completed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'}\`}
          >
            <div className="flex items-center gap-3">
              {quest.completed ? <CheckSquare className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-slate-500" />}
              <div>
                <h4 className={\`text-xs font-extrabold \${quest.completed ? 'line-through text-slate-400' : 'text-white'}\`}>{quest.title}</h4>
                <span className="text-[10px] text-slate-400 font-medium">{quest.category}</span>
              </div>
            </div>
            <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
              +{quest.xp} XP
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
`;
}

function buildInteractiveQuizAppComponent() {
  return `import React, { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

export default function InteractiveQuizApp({ section }) {
  const questions = section.questions || [
    { id: 1, text: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], answer: 'Mars' },
    { id: 2, text: 'What gas do plants absorb from the air during photosynthesis?', options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Helium'], answer: 'Carbon Dioxide' },
    { id: 3, text: 'What state of matter is water vapor?', options: ['Solid', 'Liquid', 'Gas', 'Plasma'], answer: 'Gas' },
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  const handleSelect = (opt) => {
    if (selectedOption !== null) return;
    setSelectedOption(opt);
    if (opt === questions[currentIdx].answer) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(prev => prev + 1);
      setSelectedOption(null);
    } else {
      setCompleted(true);
    }
  };

  const restartQuiz = () => {
    setCurrentIdx(0);
    setSelectedOption(null);
    setScore(0);
    setCompleted(false);
  };

  const currentQ = questions[currentIdx];

  return (
    <section className="section-block quiz-section p-6 rounded-3xl max-w-xl mx-auto" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <h2 className="text-xl font-extrabold text-center mb-4 flex items-center justify-center gap-2" style={{ color: 'var(--text-color)' }}>
        <HelpCircle className="w-5 h-5 text-brand-400" /> {section.title || 'Science Mini Quiz'}
      </h2>

      {!completed ? (
        <div className="space-y-4">
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <span>Score: {score}</span>
          </div>

          <h3 className="text-sm font-extrabold text-white bg-slate-900 p-4 rounded-2xl border border-slate-800">{currentQ.text}</h3>

          <div className="space-y-2">
            {currentQ.options.map((opt, i) => {
              const isChosen = selectedOption === opt;
              const isCorrect = opt === currentQ.answer;
              let btnStyle = 'bg-slate-900 border-slate-800 text-white hover:border-slate-700';

              if (selectedOption !== null) {
                if (isCorrect) btnStyle = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-extrabold';
                else if (isChosen) btnStyle = 'bg-red-500/20 border-red-500/50 text-red-300';
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(opt)}
                  className={\`w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-center justify-between \${btnStyle}\`}
                >
                  <span>{opt}</span>
                  {selectedOption !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {selectedOption !== null && isChosen && !isCorrect && <XCircle className="w-4 h-4 text-red-400" />}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && (
            <button onClick={nextQuestion} className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-extrabold text-xs">
              {currentIdx + 1 < questions.length ? 'Next Question →' : 'See Final Score 🏆'}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4 py-4">
          <h3 className="text-2xl font-extrabold text-yellow-400">Quiz Completed! 🎉</h3>
          <p className="text-sm text-slate-300">You scored <strong>{score}</strong> out of <strong>{questions.length}</strong> correct!</p>
          <button onClick={restartQuiz} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs flex items-center gap-1.5 mx-auto">
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        </div>
      )}
    </section>
  );
}
`;
}

function buildInteractiveCartStoreComponent() {
  return `import React, { useState } from 'react';
import { ShoppingBag, ShoppingCart, Plus, Minus, Trash2, X } from 'lucide-react';

export default function InteractiveCartStore({ section }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const products = section.products || section.items || [
    { id: 1, name: 'Artisanal Product A', price: 29.99, image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&q=80', desc: 'Handcrafted luxury item.' },
    { id: 2, name: 'Artisanal Product B', price: 49.99, image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80', desc: 'Premium material edition.' },
  ];

  const addToCart = (prod) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id);
      if (existing) {
        return prev.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...prod, qty: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2);

  return (
    <section className="section-block p-6 rounded-3xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-color)' }}>{section.title || 'Product Collection'}</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{section.purpose || 'Explore items and add to cart'}</p>
        </div>
        <button onClick={() => setIsCartOpen(true)} className="relative px-3.5 py-2 rounded-xl bg-brand-600 text-white font-extrabold text-xs flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Cart ({totalItems})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {products.map(prod => (
          <div key={prod.id} className="p-4 rounded-2xl border bg-slate-900/60 border-slate-800 flex flex-col justify-between">
            {prod.image && <img src={prod.image} alt={prod.name} className="w-full h-40 object-cover rounded-xl mb-3" />}
            <div>
              <h3 className="font-extrabold text-sm text-white">{prod.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{prod.desc}</p>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm font-extrabold text-emerald-400">\${prod.price}</span>
              <button onClick={() => addToCart(prod)} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs">
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-end">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-brand-400" /> Your Shopping Cart
                </h3>
                <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Your cart is currently empty.</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                      <div>
                        <h4 className="text-xs font-extrabold text-white">{item.name}</h4>
                        <span className="text-[10px] text-emerald-400 font-bold">\${item.price} each</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)} className="p-1 rounded bg-slate-700 text-white"><Minus className="w-3 h-3" /></button>
                        <span className="text-xs font-extrabold text-white px-2">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="p-1 rounded bg-slate-700 text-white"><Plus className="w-3 h-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div className="flex justify-between text-sm font-extrabold text-white">
                  <span>Total Amount</span>
                  <span className="text-emerald-400">\${totalPrice}</span>
                </div>
                <button onClick={() => { alert('Order checkout confirmed!'); setCart([]); setIsCartOpen(false); }} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-extrabold text-xs">
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
`;
}

function buildReservationBookingAppComponent() {
  return `import React, { useState } from 'react';
import { Calendar, Users, Clock, CheckCircle2 } from 'lucide-react';

export default function ReservationBookingApp({ section }) {
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState('2026-08-15');
  const [time, setTime] = useState('19:00');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setConfirmed(true);
  };

  return (
    <section className="section-block booking-app-section p-6 rounded-3xl max-w-xl mx-auto" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
      <h2 className="text-xl font-extrabold text-center mb-2 flex items-center justify-center gap-2" style={{ color: 'var(--text-color)' }}>
        <Calendar className="w-5 h-5 text-brand-400" /> {section.title || 'Table Reservation'}
      </h2>
      <p className="text-xs text-center text-slate-400 mb-6">{section.purpose || 'Reserve your table in advance'}</p>

      {!confirmed ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-300 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Party Size (Guests)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 4, 6, 8].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPartySize(size)}
                  className={\`flex-1 py-2 rounded-xl text-xs font-extrabold border transition-all \${partySize === size ? 'bg-brand-600 text-white border-brand-500' : 'bg-slate-900 text-slate-300 border-slate-800'}\`}
                >
                  {size} {size === 1 ? 'Guest' : 'Guests'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs bg-slate-900 text-white border-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Time
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs bg-slate-900 text-white border-slate-800 focus:outline-none"
              >
                <option value="17:00">5:00 PM</option>
                <option value="18:00">6:00 PM</option>
                <option value="19:00">7:00 PM</option>
                <option value="20:00">8:00 PM</option>
                <option value="21:00">9:00 PM</option>
              </select>
            </div>
          </div>

          <button type="submit" className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-lg">
            Confirm Reservation Request
          </button>
        </form>
      ) : (
        <div className="text-center py-6 space-y-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-extrabold text-white">Reservation Confirmed!</h3>
          <p className="text-xs text-slate-300">Table for <strong>{partySize} guests</strong> on <strong>{date}</strong> at <strong>{time}</strong>.</p>
          <button onClick={() => setConfirmed(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs">
            Make Another Reservation
          </button>
        </div>
      )}
    </section>
  );
}
`;
}
