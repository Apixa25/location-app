const express = require('express');
const router = express.Router();
const Location = require('../models/Location');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { checkAndAwardBadges } = require('./badgeRoutes');

// Updated GET endpoint to handle both admin and user-specific queries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email', 'profile', 'id']
      }],
      order: [['createdAt', 'DESC']]
    };

    // For profile page requests, filter based on user type and userId
    if (req.query.profile === 'true') {
      if (!req.user.isAdmin) {
        query.where = {
          creatorId: req.user.userId
        };
      }
      // Admin users will see all locations in their profile
    }
    // For map page requests, no filtering - everyone sees all locations

    const locations = await Location.findAll(query);
    
    // Debug logs
    console.log("Location points check:");
    locations.forEach(location => {
      console.log(`Location ${location.id}: upvotes=${location.upvotes}, downvotes=${location.downvotes}, totalPoints=${location.totalPoints}`);
    });

    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add POST endpoint
router.post('/', authenticateToken, upload.array('media'), async (req, res) => {
  try {
    console.log('Received location data:', req.body);
    console.log('Received files:', req.files);
    
    const { 
      latitude, 
      longitude, 
      text, 
      isAnonymous, 
      autoDelete, 
      deleteTime, 
      deleteUnit 
    } = req.body;

    // Calculate deleteAt time if autoDelete is enabled
    let deleteAt = null;
    if (autoDelete === 'true') {
      deleteAt = new Date();
      const time = parseInt(deleteTime);
      
      switch(deleteUnit) {
        case 'minutes':
          deleteAt.setMinutes(deleteAt.getMinutes() + time);
          break;
        case 'hours':
          deleteAt.setHours(deleteAt.getHours() + time);
          break;
        case 'days':
          deleteAt.setDate(deleteAt.getDate() + time);
          break;
      }
    }

    // Create the content object with media information
    const content = {
      text: text || '',
      mediaUrls: req.files ? req.files.map(file => file.path) : [],
      mediaTypes: req.files ? req.files.map(file => file.mimetype) : [],
      isAnonymous: isAnonymous === 'true'
    };

    const location = await Location.create({
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      content,
      creatorId: req.user.userId,
      autoDelete: autoDelete === 'true',
      deleteAt
    });

    console.log('Created location:', location);

    res.status(201).json({ 
      location,
      newBadges: []
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete endpoint
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Allow deletion if user is admin OR is the creator
    if (!req.user.isAdmin && location.creatorId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this location' });
    }

    await location.destroy();
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update location
router.put('/:id', authenticateToken, upload.array('media'), async (req, res) => {
  try {
    const location = await Location.findByPk(req.params.id);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (!req.user.isAdmin && location.creatorId !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to update this location' });
    }

    const updatedContent = {
      ...location.content,
      text: req.body.text || location.content.text,
      isAnonymous: req.body.isAnonymous === 'true'
    };

    if (req.files && req.files.length > 0) {
      updatedContent.mediaUrls = [
        ...location.content.mediaUrls,
        ...req.files.map(file => file.path)
      ];
      updatedContent.mediaTypes = [
        ...location.content.mediaTypes,
        ...req.files.map(file => file.mimetype)
      ];
    }

    if (req.body.deleteMediaIndexes) {
      const deleteIndexes = JSON.parse(req.body.deleteMediaIndexes);
      updatedContent.mediaUrls = updatedContent.mediaUrls.filter((_, index) => 
        !deleteIndexes.includes(index)
      );
      updatedContent.mediaTypes = updatedContent.mediaTypes.filter((_, index) => 
        !deleteIndexes.includes(index)
      );
    }

    // Preserve existing location coordinates if new ones aren't provided
    const locationData = {
      type: 'Point',
      coordinates: [
        req.body.longitude ? parseFloat(req.body.longitude) : location.location.coordinates[0],
        req.body.latitude ? parseFloat(req.body.latitude) : location.location.coordinates[1]
      ]
    };

    await location.update({
      location: locationData,
      content: updatedContent
    });

    // Fetch updated location with creator info
    const updatedLocationWithCreator = await Location.findByPk(location.id, {
      include: [{
        model: User,
        as: 'creator',
        attributes: ['email', 'profile', 'id']
      }]
    });

    res.json(updatedLocationWithCreator);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 