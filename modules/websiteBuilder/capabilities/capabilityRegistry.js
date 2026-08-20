/**
 * AI Ads™ Website Builder — Dynamic Capability Registry
 *
 * Defines the standard set of web application capabilities that the AI reasoning layer
 * selects from dynamically based on the inferred domain archetype, product goal, and user journey.
 */

const CAPABILITY_REGISTRY = {
  search: {
    id: 'search',
    name: 'Instant Search Engine',
    description: 'Real-time text query filtering over catalog, articles, services, or data entries.',
    stateKeys: ['searchQuery'],
    typicalArchetypes: ['ECOMMERCE_STORE', 'DIRECTORY', 'KNOWLEDGE_BASE', 'CONTENT_PLATFORM', 'DASHBOARD_CONSOLE']
  },

  filtering: {
    id: 'filtering',
    name: 'Multi-Category & Facet Filtering',
    description: '1-click category tabs and multi-tag filtering (e.g. produce, dairy, bakery, dietary tags, price brackets).',
    stateKeys: ['selectedCategory', 'activeTags'],
    typicalArchetypes: ['ECOMMERCE_STORE', 'RESTAURANT_CULINARY', 'DIRECTORY', 'PORTFOLIO_AGENCY', 'RESERVATION_BOOKING']
  },

  cart: {
    id: 'cart',
    name: 'Cart & Quantity Stepper Engine',
    description: 'Working shopping cart with item addition, quantity steppers (+/-), subtotal math, and slide-out cart drawer.',
    stateKeys: ['cartItems', 'cartCount', 'cartTotal', 'isCartOpen'],
    typicalArchetypes: ['ECOMMERCE_STORE', 'RETAIL_SHOP', 'DIGITAL_GOODS']
  },

  checkout: {
    id: 'checkout',
    name: 'Interactive Checkout & Order Modal',
    description: 'Order review modal with delivery address inputs, order summary, and order confirmation receipt.',
    stateKeys: ['isCheckoutOpen', 'orderPlaced', 'customerInfo'],
    typicalArchetypes: ['ECOMMERCE_STORE', 'RETAIL_SHOP']
  },

  booking: {
    id: 'booking',
    name: 'Reservation & Slot Picker Engine',
    description: 'Interactive service selection, staff/doctor cards, date & time slot picker, and booking confirmation modal.',
    stateKeys: ['selectedService', 'selectedPractitioner', 'selectedSlot', 'selectedDate', 'bookingConfirmed'],
    typicalArchetypes: ['RESERVATION_BOOKING', 'CLINIC_HEALTH', 'SPA_WELLNESS', 'HOSPITALITY_HOTEL', 'CONSULTING']
  },

  calendar: {
    id: 'calendar',
    name: 'Calendar & Event Scheduler',
    description: 'Interactive date grid with available time slots and event scheduling.',
    stateKeys: ['activeDate', 'selectedTime'],
    typicalArchetypes: ['RESERVATION_BOOKING', 'EVENTS_PLATFORM', 'EDUCATION_ACADEMY']
  },

  pricing_matrix: {
    id: 'pricing_matrix',
    name: 'Tiered Pricing Matrix with Billing Toggle',
    description: 'Interactive 3-tier pricing table with Monthly vs Annual billing switch (20% discount math) and sign-up modals.',
    stateKeys: ['billingCycle', 'selectedTier', 'isDemoModalOpen'],
    typicalArchetypes: ['SAAS_APPLICATION', 'MEMBERSHIP_COMMUNITY', 'API_DEVTOOL', 'SUBSCRIPTION_BOX']
  },

  calculator: {
    id: 'calculator',
    name: 'Interactive Value & ROI Calculator',
    description: 'Dynamic sliders and numeric input estimating savings, pricing, mortgage, or ROI in real-time.',
    stateKeys: ['sliderValue', 'calculatedOutput'],
    typicalArchetypes: ['SAAS_APPLICATION', 'FINANCE_FINTECH', 'REAL_ESTATE', 'SOLAR_ENERGY']
  },

  dashboard_metrics: {
    id: 'dashboard_metrics',
    name: 'Live KPI & Metric Visualizer',
    description: 'High-impact stat counters with trend percentage badges and 7D/30D/90D time range filters.',
    stateKeys: ['timeRange', 'kpiMetrics'],
    typicalArchetypes: ['DASHBOARD_CONSOLE', 'SAAS_APPLICATION', 'ANALYTICS_PLATFORM']
  },

  interactive_table: {
    id: 'interactive_table',
    name: 'Filterable Data & Status Grid',
    description: 'Searchable, filterable table with status badges (Active, Pending, Failed), sorting, and row detail drawers.',
    stateKeys: ['tableSearch', 'statusFilter', 'selectedRow'],
    typicalArchetypes: ['DASHBOARD_CONSOLE', 'INVENTORY_MANAGEMENT', 'OPERATIONS_PORTAL']
  },

  reviews: {
    id: 'reviews',
    name: 'Customer Testimonials & Verified Reviews',
    description: 'Rating stars, client testimonials carousel, and verified buyer badges.',
    stateKeys: ['activeReviewIndex'],
    typicalArchetypes: ['ECOMMERCE_STORE', 'RESTAURANT_CULINARY', 'SAAS_APPLICATION', 'PORTFOLIO_AGENCY', 'RESERVATION_BOOKING']
  },

  favorites: {
    id: 'favorites',
    name: 'Favorites & Wishlist Bookmark',
    description: 'Heart/bookmark toggle to save items to an in-memory favorites list.',
    stateKeys: ['favoriteIds'],
    typicalArchetypes: ['ECOMMERCE_STORE', 'REAL_ESTATE', 'DIRECTORY', 'PORTFOLIO_AGENCY']
  },

  forms_inquiry: {
    id: 'forms_inquiry',
    name: 'Validated Inquiry & Project Brief Form',
    description: 'Multi-field contact or project discovery form with real-time feedback and instant success confirmation.',
    stateKeys: ['formData', 'formStatus'],
    typicalArchetypes: ['PORTFOLIO_AGENCY', 'B2B_SERVICES', 'CONSULTING', 'ENTERPRISE_SALES']
  },

  gallery_showcase: {
    id: 'gallery_showcase',
    name: 'Interactive Media Showcase & Lightbox',
    description: 'Filterable visual gallery with image zoom modal and project breakdown drawers.',
    stateKeys: ['selectedMedia', 'activeFilter'],
    typicalArchetypes: ['PORTFOLIO_AGENCY', 'RESTAURANT_CULINARY', 'REAL_ESTATE', 'INTERIOR_DESIGN']
  }
};

/**
 * Returns list of capability IDs available in the system
 */
function getAvailableCapabilities() {
  return Object.keys(CAPABILITY_REGISTRY);
}

/**
 * Gets details for a specific capability ID
 */
function getCapability(id) {
  return CAPABILITY_REGISTRY[id] || null;
}

module.exports = {
  CAPABILITY_REGISTRY,
  getAvailableCapabilities,
  getCapability
};
