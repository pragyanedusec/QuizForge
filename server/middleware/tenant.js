/**
 * Multi-tenant middleware
 * Extracts tenantId from headers or query params
 * For demo purposes, we auto-create a default tenant if none exists
 */
const Tenant = require('../models/Tenant');

const DEFAULT_TENANT_ID = 'default';
const DEFAULT_API_KEY = 'qf_default_key_2024';

// Ensure default tenant exists
let defaultTenantCreated = false;
const ensureDefaultTenant = async () => {
  if (defaultTenantCreated) return;
  try {
    const exists = await Tenant.findOne({ tenantId: DEFAULT_TENANT_ID });
    if (!exists) {
      await Tenant.create({
        tenantId: DEFAULT_TENANT_ID,
        name: 'Default Tenant',
        apiKey: DEFAULT_API_KEY,
        settings: {
          defaultTimeLimit: 600,
          defaultQuestionCount: 10,
          gamificationEnabled: true,
          leaderboardEnabled: true,
        },
      });
      console.log('✅ Default tenant created');
    }
    defaultTenantCreated = true;
  } catch (err) {
    console.error('Error creating default tenant:', err.message);
  }
};

const tenantMiddleware = async (req, res, next) => {
  await ensureDefaultTenant();

  // Extract tenantId from header, query, or body
  const tenantId = req.headers['x-tenant-id'] 
    || req.query.tenantId 
    || req.body?.tenantId 
    || DEFAULT_TENANT_ID;

  // Validate tenant exists
  const tenant = await Tenant.findOne({ tenantId, isActive: true });
  if (!tenant) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid or inactive tenant' 
    });
  }

  req.tenantId = tenantId;
  req.tenant = tenant;
  next();
};

module.exports = tenantMiddleware;
