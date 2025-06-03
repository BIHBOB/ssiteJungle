import { Request, Response } from 'express';
import { ProfileService } from '../services/profile.service';

export const ProfileController = {
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const updatedProfile = await ProfileService.updateProfile(
        userId,
        req.body
      );
      
      res.json(updatedProfile);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const profile = await ProfileService.getProfile(userId);
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async updateEmail(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const { email } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({ message: 'Invalid data' });
      }

      const updatedProfile = await ProfileService.updateEmail(userId, email);
      res.json(updatedProfile);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};