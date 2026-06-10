const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireAdmin = require('../middleware/requireAdmin.middleware');
const tenantsController = require('../controllers/tenants.controller');

const router = Router();

router.get('/msal-config', tenantsController.msalConfig);
router.get('/', requireJwt, requireAdmin, tenantsController.list);
router.post('/', requireJwt, requireAdmin, tenantsController.create);
router.put('/:id', requireJwt, requireAdmin, tenantsController.update);
router.delete('/:id', requireJwt, requireAdmin, tenantsController.remove);
router.post('/:id/test', requireJwt, requireAdmin, tenantsController.testConnection);

module.exports = router;
