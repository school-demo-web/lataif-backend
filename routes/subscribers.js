const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');

// @route   POST /api/subscribers
// @desc    Subscribe to newsletter
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Check if already subscribed
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      // If previously unsubscribed, reactivate
      if (!existingSubscriber.isActive) {
        existingSubscriber.isActive = true;
        await existingSubscriber.save();
        return res.json({
          success: true,
          message: 'Successfully resubscribed to newsletter',
          data: existingSubscriber
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: 'Email already subscribed' 
      });
    }
    
    // Create new subscriber
    const subscriber = await Subscriber.create({ email });
    
    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: subscriber
    });
    
  } catch (error) {
    console.error('Subscribe error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already subscribed' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/subscribers
// @desc    Get all subscribers (Admin only)
// @access  Private/Admin
router.get('/', async (req, res) => {
  try {
    const subscribers = await Subscriber.find({ isActive: true })
      .sort({ subscribedAt: -1 });
    
    res.json({
      success: true,
      count: subscribers.length,
      data: subscribers
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   DELETE /api/subscribers
// @desc    Unsubscribe from newsletter (by email in body)
// @access  Public
router.delete('/', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    const subscriber = await Subscriber.findOneAndUpdate(
      { email },
      { isActive: false },
      { new: true }
    );
    
    if (!subscriber) {
      return res.status(404).json({ 
        success: false, 
        message: 'Subscriber not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Successfully unsubscribed'
    });
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/subscribers/count
// @desc    Get total subscriber count
// @access  Public
router.get('/count', async (req, res) => {
  try {
    const count = await Subscriber.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Count error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;