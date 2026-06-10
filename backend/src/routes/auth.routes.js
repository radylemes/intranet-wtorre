const { Router } = require('express');
const rateLimitAuth = require('../middleware/rateLimitAuth.middleware');
const validateMicrosoftToken = require('../middleware/validateMicrosoftToken.middleware');
const requireJwt = require('../middleware/requireJwt.middleware');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post('/login', rateLimitAuth, authController.login);
router.post('/login-microsoft', rateLimitAuth, validateMicrosoftToken, authController.loginMicrosoft);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireJwt, authController.me);
router.get('/profile-photo', requireJwt, authController.profilePhoto);

module.exports = router;
