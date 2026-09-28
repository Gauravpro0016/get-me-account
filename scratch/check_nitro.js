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

async function check() {
  const inv = await r.get('trinitymart_inventory_discord-nitro-booster');
  const pool = await r.get('credentials_pool');
  const overrides = await r.get('trinitymart_product_overrides');
  const custom = await r.get('trinitymart_custom_products');
  console.log('--- trinitymart_inventory_discord-nitro-booster ---');
  console.log(JSON.stringify(inv, null, 2));
  console.log('--- credentials_pool count ---', Array.isArray(pool) ? pool.length : pool);
  console.log('--- credentials_pool sample ---', Array.isArray(pool) ? JSON.stringify(pool.slice(0, 3), null, 2) : pool);
  console.log('--- overrides discord-nitro-booster ---', overrides ? overrides['discord-nitro-booster'] : null);

  // Check all keys in redis starting with trinitymart_inventory
  // or keys that have credentials
}

check().catch(console.error);
