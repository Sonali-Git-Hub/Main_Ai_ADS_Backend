const { analyzeRequirement } = require('./modules/websiteBuilder/websiteBuilder.service');

const prompt = "I want a modern restaurant website for my family restaurant called Spice Garden. I want customers to see our menu, view food photos, check our location and opening hours, make table reservations, and contact us on WhatsApp. I don't need online payment or customer login. I want a premium but warm design with dark green, cream and gold colors.";

(async () => {
  const result = await analyzeRequirement(prompt);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();
