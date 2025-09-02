const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');

// Add item to cart
router.post('/', async (req, res) => {
  try {
    const { productId, name, image, category, district, description, subtitle, 
            price, weight, quantity, ratingValue, variantIndex, weightIndex } = req.body;
    
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const existingItem = await Cart.findOne({ 
      userId: req.user.uid, 
      productId 
    });

    if (existingItem) {
      existingItem.quantity += quantity;
      await existingItem.save();
      return res.status(200).json(existingItem);
    }

    const newCartItem = new Cart({
      userId: req.user.uid,
      productId,
      name,
      image,
      category,
      district,
      description,
      subtitle,
      price,
      weight,
      quantity,
      ratingValue,
      variantIndex,
      weightIndex
    });

    await newCartItem.save();
    res.status(201).json(newCartItem);
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ 
      message: 'Error adding to cart',
      error: error.message 
    });
  }
});

// Get cart items
router.get('/', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const cartItems = await Cart.find({ userId: req.user.uid });
    res.status(200).json(cartItems);
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ 
      message: 'Error fetching cart',
      error: error.message 
    });
  }
});

// Update cart item quantity
router.put('/:id', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { quantity } = req.body;
    const cartItem = await Cart.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { quantity },
      { new: true }
    );

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.status(200).json(cartItem);
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ 
      message: 'Error updating cart',
      error: error.message 
    });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const cartItem = await Cart.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.uid 
    });

    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.status(200).json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ 
      message: 'Error removing from cart',
      error: error.message 
    });
  }
});

// Clear user's cart
router.delete('/', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    console.log(`Clearing cart for user: ${req.user.uid}`);
    const result = await Cart.deleteMany({ userId: req.user.uid });
    console.log(`Cleared ${result.deletedCount} items from cart`);

    res.status(200).json({ 
      message: 'Cart cleared successfully',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ 
      message: 'Error clearing cart',
      error: error.message 
    });
  }
});

module.exports = router;