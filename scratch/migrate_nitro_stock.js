const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
});

const { Redis } = require('@upstash/redis');
const r = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function migrate() {
  console.log("=== Migrating Nitro Stocks to Database Inventory ===");
  const pool = await r.get('credentials_pool') || [];
  console.log(`Found ${pool.length} accounts in credentials_pool:`, pool);

  let existingInv = await r.get('trinitymart_inventory_discord-nitro-booster') || [];

  // Convert pool items into InventoryItem format
  const converted = pool.map(item => ({
    id: item.id || `inv-nitro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fields: {
      id: item.email || item.id || "DiscordNitroUser",
      email: item.email,
      password: item.discordPassword || item.password || item.emailPassword,
      emailPassword: item.emailPassword,
      token: item.token,
      domain: item.domain || "outlook.com",
    },
    addedAt: item.addedAt || new Date().toISOString(),
  }));

  // Merge deduplicating by email / id
  const existingIds = new Set(existingInv.map(i => i.id));
  const existingEmails = new Set(existingInv.map(i => i.fields?.email || i.fields?.id));

  for (const item of converted) {
    if (!existingIds.has(item.id) && !existingEmails.has(item.fields?.email)) {
      existingInv.push(item);
    }
  }

  await r.set('trinitymart_inventory_discord-nitro-booster', existingInv);
  console.log(`Updated trinitymart_inventory_discord-nitro-booster with ${existingInv.length} accounts!`);

  const activeCount = existingInv.filter(i => !i.claimedAt).length;

  // Update overrides
  let overrides = await r.get('trinitymart_product_overrides') || {};
  overrides['discord-nitro-booster'] = {
    ...(overrides['discord-nitro-booster'] || {}),
    id: 'discord-nitro-booster',
    stockCount: activeCount,
    inStock: activeCount > 0,
    updatedAt: new Date().toISOString(),
  };
  await r.set('trinitymart_product_overrides', overrides);
  console.log(`Updated overrides for discord-nitro-booster to stockCount: ${activeCount}, inStock: ${activeCount > 0}`);

  console.log("=== Nitro Stock Migration Complete ===");
}

migrate().catch(console.error);
