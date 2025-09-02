const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');

// Configure multer storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET all products with variants flattened and full image URLs
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    const flattenedProducts = products.flatMap(product => 
      product.variants.flatMap((variant, variantIndex) =>
        variant.weights.map((weight, weightIndex) => ({
          _id: product._id,
          variantIndex: variantIndex,
          weightIndex: weightIndex,
          name: product.name,
          image: product.image,
          imageUrl: product.image ? `${req.protocol}://${req.get('host')}${product.image}` : null,
          subtitle: product.subtitle,
          description: product.description,
          category: product.category,
          district: product.district,
          ratingValue: product.ratingValue,
          weight: weight,
          weightQuantity: weight.quantity,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          isTrending: product.isTrending,
          trendingOrder: product.trendingOrder
        }))
      )
    );
    res.json(flattenedProducts);
  } catch (err) {
    console.error('❌ Error fetching products:', err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET trending products
router.get('/trending', async (req, res) => {
  try {
    const products = await Product.find({ isTrending: true }).sort({ trendingOrder: 1 });
    res.json(products);
  } catch (err) {
    console.error('❌ Error fetching trending products:', err.message);
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
});

// PUT add/remove from trending
router.put('/:id/trending', async (req, res) => {
  try {
    const { isTrending } = req.body;
    
    if (isTrending) {
      // When adding to trending, set the order to be last
      const count = await Product.countDocuments({ isTrending: true });
      await Product.findByIdAndUpdate(req.params.id, { 
        isTrending: true,
        trendingOrder: count
      });
    } else {
      await Product.findByIdAndUpdate(req.params.id, { 
        isTrending: false,
        trendingOrder: -1
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error updating trending status:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update trending status' });
  }
});

// PUT update trending order
router.put('/:id/trending-order', async (req, res) => {
  try {
    const { direction } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product || !product.isTrending) {
      return res.status(400).json({ error: 'Product not found or not trending' });
    }

    const currentOrder = product.trendingOrder;
    let swapProduct;

    if (direction === 'up' && currentOrder > 0) {
      swapProduct = await Product.findOne({ 
        isTrending: true, 
        trendingOrder: currentOrder - 1 
      });
      
      if (swapProduct) {
        await Product.updateMany({
          _id: { $in: [product._id, swapProduct._id] }
        }, [{
          $set: {
            trendingOrder: {
              $cond: [
                { $eq: ['$_id', product._id] },
                currentOrder - 1,
                currentOrder
              ]
            }
          }
        }]);
      }
    } else if (direction === 'down') {
      swapProduct = await Product.findOne({ 
        isTrending: true, 
        trendingOrder: currentOrder + 1 
      });
      
      if (swapProduct) {
        await Product.updateMany({
          _id: { $in: [product._id, swapProduct._id] }
        }, [{
          $set: {
            trendingOrder: {
              $cond: [
                { $eq: ['$_id', product._id] },
                currentOrder + 1,
                currentOrder
              ]
            }
          }
        }]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error updating trending order:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update trending order' });
  }
});

// Image upload endpoint
router.post('/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const imagePath = `/uploads/${req.file.filename}`;
    const imageUrl = `${req.protocol}://${req.get('host')}${imagePath}`;
    console.log('✅ Image uploaded:', imageUrl);
    res.status(200).json({ 
      imagePath,
      imageUrl
    });
  } catch (err) {
    console.error('❌ Error uploading image:', err.message);
    res.status(400).json({ error: err.message || 'Failed to upload image' });
  }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    const productWithFullUrl = {
      ...product.toObject(),
      imageUrl: product.image ? `${req.protocol}://${req.get('host')}${product.image}` : null
    };
    
    res.json(productWithFullUrl);
  } catch (err) {
    console.error('❌ Error fetching product:', err.message);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST create new product
router.post('/', async (req, res) => {
  try {
    const { name, image, subtitle, description, category, district, ratingValue, variants } = req.body;
    
    if (!name?.trim() || !image?.trim() || !subtitle?.trim() || !description?.trim() || 
        !category?.trim() || !district?.trim() || !variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Name, image, subtitle, description, category, district, and at least one variant are required' });
    }
    
    for (const variant of variants) {
      if (!variant.weights || !Array.isArray(variant.weights) || variant.weights.length === 0) {
        return res.status(400).json({ error: 'Each variant must have at least one weight option' });
      }
      
      for (const weight of variant.weights) {
        if (!Number.isFinite(weight.value) || weight.value <= 0 || !weight.unit || 
            !Number.isFinite(weight.price) || weight.price <= 0 || 
            !Number.isFinite(weight.quantity) || weight.quantity < 0) {
          return res.status(400).json({ 
            error: 'Each weight option must have valid value (> 0), unit, price (> 0), and quantity (>= 0)' 
          });
        }
      }
    }
    
    const newProduct = new Product({
      name: name.trim(),
      image: image.trim(),
      subtitle: subtitle.trim(),
      description: description.trim(),
      category: category.trim(),
      district: district.trim(),
      ratingValue: ratingValue ? parseFloat(ratingValue) : undefined,
      variants: variants.map(variant => ({
        weights: variant.weights.map(weight => ({
          value: parseFloat(weight.value),
          unit: weight.unit,
          price: parseFloat(weight.price),
          quantity: parseInt(weight.quantity)
        }))
      })
)});
    
    await newProduct.save();
    
    const productWithFullUrl = {
      ...newProduct.toObject(),
      imageUrl: newProduct.image ? `${req.protocol}://${req.get('host')}${newProduct.image}` : null
    };
    
    res.status(201).json(productWithFullUrl);
  } catch (err) {
    console.error('❌ Error creating product:', err);
    res.status(400).json({ error: err.message || 'Failed to create product' });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    
    const { name, image, subtitle, description, category, district, ratingValue, variants } = req.body;
    
    if (!name?.trim() || !image?.trim() || !subtitle?.trim() || !description?.trim() || 
        !category?.trim() || !district?.trim() || !variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Name, image, subtitle, description, category, district, and at least one variant are required' });
    }
    
    for (const variant of variants) {
      if (!variant.weights || !Array.isArray(variant.weights) || variant.weights.length === 0) {
        return res.status(400).json({ error: 'Each variant must have at least one weight option' });
      }
      
      for (const weight of variant.weights) {
        if (!Number.isFinite(weight.value) || weight.value <= 0 || !weight.unit || 
            !Number.isFinite(weight.price) || weight.price <= 0 || 
            !Number.isFinite(weight.quantity) || weight.quantity < 0) {
          return res.status(400).json({ 
            error: 'Each weight option must have valid value (> 0), unit, price (> 0), and quantity (>= 0)' 
          });
        }
      }
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        image: image.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        category: category.trim(),
        district: district.trim(),
        ratingValue: ratingValue ? parseFloat(ratingValue) : undefined,
        variants: variants.map(variant => ({
          weights: variant.weights.map(weight => ({
            value: parseFloat(weight.value),
            unit: weight.unit,
            price: parseFloat(weight.price),
            quantity: parseInt(weight.quantity)
          }))
        }))
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const productWithFullUrl = {
      ...updatedProduct.toObject(),
      imageUrl: updatedProduct.image ? `${req.protocol}://${req.get('host')}${updatedProduct.image}` : null
    };
    
    res.json(productWithFullUrl);
  } catch (err) {
    console.error('❌ Error updating product:', err.message);
    res.status(400).json({ error: err.message || 'Failed to update product' });
  }
});

// DELETE product by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  
  try {
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting product:', err.message);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// GET specific variant and weight of a product
router.get('/:id/:variantIndex/:weightIndex', async (req, res) => {
  const { id, variantIndex, weightIndex } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const variant = product.variants[parseInt(variantIndex)];
    if (!variant) return res.status(404).json({ error: 'Variant not found at index' });

    const weight = variant.weights[parseInt(weightIndex)];
    if (!weight) return res.status(404).json({ error: 'Weight option not found at index' });

    const result = {
      _id: product._id,
      variantIndex: parseInt(variantIndex),
      weightIndex: parseInt(weightIndex),
      name: product.name,
      image: product.image,
      imageUrl: product.image ? `${req.protocol}://${req.get('host')}${product.image}` : null,
      subtitle: product.subtitle,
      description: product.description,
      category: product.category,
      district: product.district,
      ratingValue: product.ratingValue,
      weight: weight,
      weightQuantity: weight.quantity,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };

    res.json(result);
  } catch (err) {
    console.error('❌ Error getting variant/weight:', err.message);
    res.status(500).json({ error: 'Failed to get variant/weight' });
  }
});

// PUT update specific weight quantity
router.put('/:id/:variantIndex/:weightIndex/quantity', async (req, res) => {
  const { id, variantIndex, weightIndex } = req.params;
  const { quantity } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }

  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const variant = product.variants[parseInt(variantIndex)];
    if (!variant) return res.status(404).json({ error: 'Variant not found at index' });

    const weight = variant.weights[parseInt(weightIndex)];
    if (!weight) return res.status(404).json({ error: 'Weight option not found at index' });

    weight.quantity = parseInt(quantity);
    await product.save();

    res.json({ 
      message: 'Weight quantity updated successfully',
      updatedQuantity: weight.quantity
    });
  } catch (err) {
    console.error('❌ Error updating weight quantity:', err.message);
    res.status(500).json({ error: 'Failed to update weight quantity' });
  }
});

// DELETE specific variant of a product
router.delete('/:id/:variantIndex', async (req, res) => {
  const { id, variantIndex } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const indexToRemove = parseInt(variantIndex);
    if (indexToRemove < 0 || indexToRemove >= product.variants.length) {
      return res.status(404).json({ error: 'Variant index out of range' });
    }

    product.variants.splice(indexToRemove, 1);
    await product.save();

    res.json({ message: `Variant at index ${indexToRemove} deleted successfully` });
  } catch (err) {
    console.error('❌ Error deleting variant:', err.message);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
});

// DELETE specific weight option from a variant
router.delete('/:id/:variantIndex/:weightIndex', async (req, res) => {
  const { id, variantIndex, weightIndex } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const variant = product.variants[parseInt(variantIndex)];
    if (!variant) return res.status(404).json({ error: 'Variant not found at index' });

    const weightIndexToRemove = parseInt(weightIndex);
    if (weightIndexToRemove < 0 || weightIndexToRemove >= variant.weights.length) {
      return res.status(404).json({ error: 'Weight index out of range' });
    }

    if (variant.weights.length === 1) {
      return res.status(400).json({ error: 'Cannot delete the last weight option. Delete the entire variant instead.' });
    }

    variant.weights.splice(weightIndexToRemove, 1);
    await product.save();

    res.json({ message: `Weight option at index ${weightIndexToRemove} deleted successfully` });
  } catch (err) {
    console.error('❌ Error deleting weight option:', err.message);
    res.status(500).json({ error: 'Failed to delete weight option' });
  }
});

router.use('/uploads', express.static(path.join(__dirname, '../uploads')));

module.exports = router;