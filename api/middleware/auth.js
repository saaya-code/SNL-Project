import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware to verify JWT token
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET || 'default-secret');
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user is admin
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin permissions
    const user = await User.findOne({ discordId: req.user.sub || req.user.id });
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    req.userData = user;
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ error: 'Failed to verify admin status' });
  }
};

// Middleware to check if user is admin or moderator
export const requireModerator = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin or moderator permissions
    const user = await User.findOne({ discordId: req.user.sub || req.user.id });
    
    if (!user || (!user.isAdmin && !user.isModerator)) {
      return res.status(403).json({ error: 'Admin or moderator privileges required' });
    }

    req.userData = user;
    next();
  } catch (error) {
    console.error('Moderator check error:', error);
    return res.status(500).json({ error: 'Failed to verify moderator status' });
  }
};

// Helper function to check permissions
export const hasPermission = (user, requiredRole) => {
  if (!user) return false;
  
  switch (requiredRole) {
    case 'admin':
      return user.isAdmin;
    case 'moderator':
      return user.isAdmin || user.isModerator;
    default:
      return false;
  }
};