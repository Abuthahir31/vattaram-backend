const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const multer = require('multer');
const path = require('path');


// Store uploaded images in /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// GET all categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST with file
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    const newCategories = new Category({ name, image });
    await newCategories.save();

    res.status(201).json(newCategories );
  } catch (err) {
    res.status(500).json({ error: 'Failed to add categories' });
  }
});
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;

    // Fetch current district data first
    const existingCategories = await Category.findById(req.params.id);
    if (!existingCategories) {
      return res.status(404).json({ error: 'Categories not found' });
    }

    // Use uploaded image if provided, else keep the current one
    const image = req.file ? `/uploads/${req.file.filename}` : existingCategories.image;

    const updatedCategories = await Category.findByIdAndUpdate(
      req.params.id,
      { name, image },
      { new: true }
    );

    res.json(updatedCategories);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update Categories' });
  }
});
// DELETE /api/categories
router.delete('/', async (req, res) => {
  try {
    await Category.deleteMany({});
    res.json({ message: 'All categories deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete categories' });
  }
});
// DELETE a category by ID
router.delete('/:id', async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);

    if (!deletedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
