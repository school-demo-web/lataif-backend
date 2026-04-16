const express = require('express');
const router = express.Router();
const webPush = require('web-push');
const Subscription = require('../models/Subscription');
const Article = require('../models/Article');

// Configure web-push
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// @route   POST /api/push/subscribe
// @desc    Save subscription
// @access  Public
router.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    
    // Check if already exists
    const existing = await Subscription.findOne({ endpoint: subscription.endpoint });
    if (existing) {
      return res.json({ success: true, message: 'Already subscribed' });
    }
    
    await Subscription.create(subscription);
    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ success: false, message: 'Subscription failed' });
  }
});

// @route   POST /api/push/unsubscribe
// @desc    Remove subscription
// @access  Public
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    await Subscription.deleteOne({ endpoint });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// @route   POST /api/push/notify-new-article
// @desc    Send notification when new article is published
// @access  Private (Admin/Author)
router.post('/notify-new-article', async (req, res) => {
  try {
    const { articleId, title, excerpt } = req.body;
    
    const subscriptions = await Subscription.find();
    const payload = JSON.stringify({
      title: '📝 نئی تحریر شائع ہوگئی!',
      body: title,
      icon: '/logo.png',
      badge: '/badge.png',
      data: {
        url: `/article_detail?id=${articleId}`
      }
    });
    
    const results = [];
    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(sub, payload);
        results.push({ endpoint: sub.endpoint, status: 'success' });
      } catch (error) {
        if (error.statusCode === 410) {
          // Subscription expired, delete it
          await Subscription.deleteOne({ _id: sub._id });
        }
        results.push({ endpoint: sub.endpoint, status: 'failed', error: error.message });
      }
    }
    
    res.json({ success: true, sent: results.filter(r => r.status === 'success').length, total: subscriptions.length });
  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;