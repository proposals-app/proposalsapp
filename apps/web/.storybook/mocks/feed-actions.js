// Mock implementation of feed actions that delegates to the controller
import { actionController } from './action-controller';

export const getDiscourseUser = (...args) =>
  actionController.getDiscourseUser(...args);
export const getPostLikesCount = (...args) =>
  actionController.getPostLikesCount(...args);
export const getDelegateByDiscourseUser = (...args) =>
  actionController.getDelegateByDiscourseUser(...args);
