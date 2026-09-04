/**
 * brandVisualResolver.js (Backend Service)
 * Comprehensive Dynamic Brand-Aware Visual Asset Engine
 */

const BRAND_VISUAL_POOLS = {
  BUS_TRAVEL_TRANSIT: [
    {
      url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957',
      title: 'Modern Luxury Passenger Coach on Highway',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e',
      title: 'Comfortable Long-Distance Coach Travel',
      style: 'Cinematic Film Studio'
    },
    {
      url: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42',
      title: 'Happy Traveler Booking on Smartphone App',
      style: 'Vibrant Social Ad'
    },
    {
      url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c',
      title: 'Customer Case Study & Success Strategy Meeting',
      style: 'Minimalist Editorial'
    },
    {
      url: 'https://images.unsplash.com/photo-1556742049-0a67c5576a8d',
      title: 'Satisfied Customer 5-Star Service Rating',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05',
      title: 'Global Travel & Departure Terminal Hub',
      style: 'Luxury Brand Studio'
    }
  ],

  STATIONERY_WRITING_OFFICE: [
    {
      url: 'https://images.unsplash.com/photo-1585336261026-7f86598c1995',
      title: 'Premium Pencils, Sharpeners and Erasers Set',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd',
      title: 'Classic Red and Black Writing Pencils',
      style: 'Minimalist Editorial'
    },
    {
      url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a',
      title: 'Artisan Journaling, Fountain Pen & Notebook',
      style: 'Cinematic Film Studio'
    },
    {
      url: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634',
      title: 'Creative Art Supplies, Colored Pencils & Sketches',
      style: 'Vibrant Social Ad'
    },
    {
      url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b',
      title: 'School Education & Students Learning Tools',
      style: 'Photorealistic Commercial'
    }
  ],

  TECH_SAAS_AI_SOFTWARE: [
    {
      url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
      title: 'Enterprise Analytics Growth Dashboard',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1556740758-90de374c12ad',
      title: 'Seamless Mobile Application Checkout & Fintech',
      style: 'Vibrant Social Ad'
    },
    {
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
      title: 'Digital Marketing Performance Metrics',
      style: 'Minimalist Editorial'
    },
    {
      url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174',
      title: 'Modern High-Tech Office Workspace',
      style: 'Cinematic Film Studio'
    }
  ],

  FASHION_APPAREL_FOOTWEAR: [
    {
      url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d',
      title: 'High-Fashion Editorial Boutique Garment',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
      title: 'Vibrant Athletic Sneakers & Footwear',
      style: 'Vibrant Social Ad'
    },
    {
      url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446',
      title: 'Luxury Runway Designer Collection',
      style: 'Luxury Brand Studio'
    },
    {
      url: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8',
      title: 'Contemporary Streetwear & Urban Fashion',
      style: 'Cinematic Film Studio'
    }
  ],

  BEAUTY_SKINCARE_COSMETICS: [
    {
      url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e',
      title: 'Organic Botanical Skincare & Serums',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348',
      title: 'Luxury Cosmetics & Beauty Palette',
      style: 'Vibrant Social Ad'
    },
    {
      url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881',
      title: 'Glowing Healthy Skin & Facial Care',
      style: 'Cinematic Film Studio'
    }
  ],

  FOOD_BEVERAGE_DINING: [
    {
      url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48',
      title: 'Luxury Promotional Gift Box & Countdown Offer',
      style: 'Photorealistic Commercial',
      subtopic: 'offer'
    },
    {
      url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300',
      title: 'Authentic Vintage Family Photo Portrait',
      style: 'Photorealistic Commercial',
      subtopic: 'family_photo'
    },
    {
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
      title: 'St. Augustine Outdoor Street Food Tour',
      style: 'Photorealistic Commercial',
      subtopic: 'tour'
    },
    {
      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836',
      title: 'Artisan Gourmet Culinary Plate & Fresh Herbs',
      style: 'Photorealistic Commercial',
      subtopic: 'recipe'
    },
    {
      url: 'https://images.unsplash.com/photo-1588877329975-bc4212882963',
      title: 'Fresh Ripe Datil Peppers Harvest',
      style: 'Photorealistic Commercial',
      subtopic: 'ingredient'
    },
    {
      url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d',
      title: 'Behind the Scenes Craft Kitchen Prep & Bottling',
      style: 'Photorealistic Commercial',
      subtopic: 'behind_the_scenes'
    },
    {
      url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0',
      title: 'Artisan Hot Sauce Bottle & Condiment Display',
      style: 'Photorealistic Commercial',
      subtopic: 'product'
    },
    {
      url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
      title: 'Outdoor BBQ & Friends Lifestyle Dining',
      style: 'Vibrant Social Ad',
      subtopic: 'lifestyle'
    },
    {
      url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8',
      title: 'Gourmet Spicy Eggs Benedict Brunch',
      style: 'Photorealistic Commercial',
      subtopic: 'recipe'
    },
    {
      url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38',
      title: 'Gourmet Spicy Chicken Wings & Drizzle',
      style: 'Photorealistic Commercial',
      subtopic: 'recipe'
    },
    {
      url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
      title: 'Gourmet Burger & Crispy Golden Fries',
      style: 'Vibrant Social Ad',
      subtopic: 'recipe'
    },
    {
      url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a',
      title: 'Vintage Family Recipe Notebook & Heritage Prep',
      style: 'Minimalist Editorial',
      subtopic: 'heritage'
    },
    {
      url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950',
      title: 'Traditional Sweets, Mithai & Festive Gifting Hamper',
      style: 'Luxury Brand Studio',
      subtopic: 'product'
    }
  ],

  JEWELRY_LUXURY: [
    {
      url: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338',
      title: 'Luxury Diamond Solitaire Ring & 22k Gold',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f',
      title: 'Emerald Gemstone Pendant Necklace',
      style: 'Luxury Brand Studio'
    }
  ],

  HEALTHCARE_WELLNESS: [
    {
      url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09',
      title: 'Modern Clean Dental Suite & Confident Smile',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118',
      title: 'Medical Healthcare Consultation & Care',
      style: 'Minimalist Editorial'
    }
  ],

  AUTOMOTIVE_MOBILITY: [
    {
      url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70',
      title: 'Luxury Sports Car in Polished Showroom',
      style: 'Photorealistic Commercial'
    }
  ],

  REAL_ESTATE_HOME: [
    {
      url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
      title: 'Luxury Villa with Infinity Pool at Sunset',
      style: 'Photorealistic Commercial'
    }
  ],

  ECOMMERCE_RETAIL: [
    {
      url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc',
      title: 'Curated Consumer Retail Storefront',
      style: 'Photorealistic Commercial'
    }
  ],

  GENERAL_BUSINESS: [
    {
      url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4',
      title: 'Strategic Growth & Executive Keynote',
      style: 'Photorealistic Commercial'
    },
    {
      url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0',
      title: 'High-Velocity Brand Marketing Workshop',
      style: 'Vibrant Social Ad'
    }
  ]
};

function detectVisualDomain(prompt = '', brand = '', topic = '', industry = '') {
  const text = `${prompt} ${brand} ${topic} ${industry}`.toLowerCase();

  if (/redbus|bus|coach|travel|trip|transit|commute|passenger|ticket|booking|route|highway|tour|flight|airline|train|cab|taxi|mobility/i.test(text)) {
    return 'BUS_TRAVEL_TRANSIT';
  }
  if (/nataraj|pencil|pen|stationery|eraser|sharpener|ruler|notebook|drawing|sketch|student|school|exam|writing|paper|journal/i.test(text)) {
    return 'STATIONERY_WRITING_OFFICE';
  }
  if (/saas|software|dashboard|cloud|ai ads|aisa|platform|analytics|api|developer|crm|app|mobile app|digital product|cyber|fintech/i.test(text)) {
    return 'TECH_SAAS_AI_SOFTWARE';
  }
  if (/fashion|apparel|clothing|dress|shirt|footwear|sneakers|shoes|boutique|streetwear|runway|outfit|model|textile|couture|nike|puma|adidas|zara/i.test(text)) {
    return 'FASHION_APPAREL_FOOTWEAR';
  }
  if (/beauty|skincare|cosmetics|serum|makeup|cream|lotion|spa|perfume|fragrance|wellness|nykaa|mamaearth/i.test(text)) {
    return 'BEAUTY_SKINCARE_COSMETICS';
  }
  if (/jewelry|jewellery|diamond|gold|necklace|ring|earring|gemstone|bracelet|tanishq|luxury watch|solitaire/i.test(text)) {
    return 'JEWELRY_LUXURY';
  }
  if (/food|dining|restaurant|cafe|coffee|burger|pizza|sushi|culinary|chef|sweet|mithai|kaju|namkeen|bakery|cake|zomato|swiggy/i.test(text)) {
    return 'FOOD_BEVERAGE_DINING';
  }
  if (/health|hospital|doctor|dental|dentist|clinic|teeth|medicine|pharma|gym|fitness|workout|yoga/i.test(text)) {
    return 'HEALTHCARE_WELLNESS';
  }
  if (/car|auto|automotive|supercar|vehicle|tata motors|tesla|bmw|engine|dealership|ev/i.test(text)) {
    return 'AUTOMOTIVE_MOBILITY';
  }
  if (/real estate|property|villa|apartment|home|furniture|sofa|interior|architecture|penthouse/i.test(text)) {
    return 'REAL_ESTATE_HOME';
  }
  if (/ecommerce|e-commerce|retail|shop|shopping|store|order|delivery|package|cart/i.test(text)) {
    return 'ECOMMERCE_RETAIL';
  }

  return 'GENERAL_BUSINESS';
}

function resolveBrandVisualAsset({
  prompt = '',
  brandName = 'Redbus',
  topic = 'Customer Case Studies & Proof',
  style = 'Photorealistic Commercial',
  aspect = '1:1',
  variationIndex = 0,
  industry = ''
}) {
  const cleanBrand = (brandName || 'Redbus').trim();
  const cleanTopic = (topic || prompt || 'Marketing Campaign').trim();
  const topicText = `${topic} ${prompt}`.toLowerCase();

  const domain = detectVisualDomain(prompt, cleanBrand, cleanTopic, industry);
  const pool = BRAND_VISUAL_POOLS[domain] || BRAND_VISUAL_POOLS.GENERAL_BUSINESS;

  // Subtopic matching logic (evaluated on specific strategy topic & prompt text)
  let subtopicKey = '';
  if (/offer|discount|deal|countdown|sale|special|coupon|promo|limited|exclusive/i.test(topicText)) {
    subtopicKey = 'offer';
  } else if (/family photo|vintage family|family picture|family portrait|ancestor|grandma|grandfather/i.test(topicText)) {
    subtopicKey = 'family_photo';
  } else if (/behind the scenes|maker|craft|kitchen|bottling|factory|team|production|making|floor/i.test(topicText)) {
    subtopicKey = 'behind_the_scenes';
  } else if (/ingredient|pepper|farm|harvest|chili|datil|fresh tomatoes|field|grow|farmer/i.test(topicText)) {
    subtopicKey = 'ingredient';
  } else if (/bottle|packaging|product|shelf|label|display/i.test(topicText)) {
    subtopicKey = 'product';
  } else if (/heritage|origin|history|throwback|30-year|traditional/i.test(topicText)) {
    subtopicKey = 'heritage';
  } else if (/customer|testimonial|challenge|fan|community|patio|friends|lifestyle|appreciation/i.test(topicText)) {
    subtopicKey = 'lifestyle';
  } else if (/recipe|dish|plate|meal|wing|burger|pairing|cooking|culinary|brunch|chef/i.test(topicText)) {
    subtopicKey = 'recipe';
  } else if (/food tour|st\. augustine|exploring|local spots|community|partnership/i.test(topicText)) {
    subtopicKey = 'tour';
  }

  let matchingItems = pool;
  if (subtopicKey) {
    const subMatches = pool.filter(item => item.subtopic === subtopicKey);
    if (subMatches.length > 0) matchingItems = subMatches;
  }

  // Filter by style if available
  const styleMatches = matchingItems.filter(item => item.style.toLowerCase() === style.toLowerCase());
  if (styleMatches.length > 0) matchingItems = styleMatches;

  const selectedItem = matchingItems[Math.abs(variationIndex) % matchingItems.length] || pool[0];

  const is916 = aspect === '9:16';
  const is169 = aspect === '16:9';
  const is45 = aspect === '4:5';

  const w = is169 ? 1280 : is916 ? 720 : is45 ? 1080 : 1080;
  const h = is169 ? 720 : is916 ? 1280 : is45 ? 1350 : 1080;

  const baseCleanUrl = selectedItem.url.split('&w=')[0].split('?')[0];
  return `${baseCleanUrl}?auto=format&fit=crop&w=${w}&h=${h}&q=85`;
}

module.exports = {
  detectVisualDomain,
  resolveBrandVisualAsset,
};
