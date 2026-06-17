const { Router } = require('express');
const requireJwt = require('../middleware/requireJwt.middleware');
const requireModulo = require('../middleware/requireModulo.middleware');
const tenantsController = require('../controllers/tenants.controller');

const router = Router();

router.get('/msal-config', tenantsController.msalConfig);
router.get('/', requireJwt, requireModulo('tenants'), tenantsController.list);
router.post('/', requireJwt, requireModulo('tenants'), tenantsController.create);
router.put('/:id', requireJwt, requireModulo('tenants'), tenantsController.update);
router.delete('/:id', requireJwt, requireModulo('tenants'), tenantsController.remove);
router.post('/:id/test', requireJwt, requireModulo('tenants'), tenantsController.testConnection);

module.exports = router;
