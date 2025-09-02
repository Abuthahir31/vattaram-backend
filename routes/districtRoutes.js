const express = require('express');
const router = express.Router();
const District = require('../models/District');
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

// GET all districts
router.get('/', async (req, res) => {
  try {
    const districts = await District.find();
    res.json(districts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch districts' });
  }
});

// GET a single district by ID
router.get('/:id', async (req, res) => {
  try {
    const district = await District.findById(req.params.id);
    if (!district) {
      return res.status(404).json({ error: 'District not found' });
    }
    res.json(district);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch district' });
  }
});

// POST with file
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    const newDistrict = new District({ name, image });
    await newDistrict.save();

    res.status(201).json(newDistrict);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add district' });
  }
});
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { name } = req.body;

    // Fetch current district data first
    const existingDistrict = await District.findById(req.params.id);
    if (!existingDistrict) {
      return res.status(404).json({ error: 'District not found' });
    }

    // Use uploaded image if provided, else keep the current one
    const image = req.file ? `/uploads/${req.file.filename}` : existingDistrict.image;

    const updatedDistrict = await District.findByIdAndUpdate(
      req.params.id,
      { name, image },
      { new: true }
    );

    res.json(updatedDistrict);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update district' });
  }
});



// DELETE a district by ID
router.delete('/:id', async (req, res) => {
  try {
    const deletedDistrict = await District.findByIdAndDelete(req.params.id);
    if (!deletedDistrict) {
      return res.status(404).json({ error: 'District not found' });
    }
    res.json({ message: 'District deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete district' });
  }
});

module.exports = router;
