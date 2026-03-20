import { v4 as uuidv4 } from 'uuid';
import User from '../models/User';

export const registerDevice = async () => {
  const deviceId = uuidv4();
  const user = await User.create({ deviceId });
  return { deviceId: user.deviceId };
};

export const getUserByDeviceId = async (deviceId: string) => {
  return User.findOne({ deviceId });
};

export const addBookmark = async (deviceId: string, articleId: string) => {
  // $addToSet avoids duplicate bookmarks.
  return User.findOneAndUpdate(
    { deviceId },
    { $addToSet: { bookmarks: articleId } },
    { new: true, runValidators: true }
  );
};

export const removeBookmark = async (deviceId: string, articleId: string) => {
  return User.findOneAndUpdate(
    { deviceId },
    { $pull: { bookmarks: articleId } },
    { new: true, runValidators: true }
  );
};
