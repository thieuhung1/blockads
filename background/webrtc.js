// NetShield WebRTC Leak Protection Controller

import { logger } from './logger.js';

export async function applyWebRTCProtection(enabled) {
  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
    try {
      if (enabled) {
        const details = await chrome.privacy.network.webRTCIPHandlingPolicy.get({});
        if (details.levelOfControl === 'controlled_by_other_extensions' || details.levelOfControl === 'not_controllable') {
          logger.warn('WebRTC policy cannot be set.', details.levelOfControl);
          return { success: false, reason: details.levelOfControl };
        }
        await chrome.privacy.network.webRTCIPHandlingPolicy.set({
          value: 'default_public_interface_only'
        });
        logger.debug('WebRTC IP protection active (default_public_interface_only).');
      } else {
        await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
        logger.debug('WebRTC IP protection cleared.');
      }
      return { success: true };
    } catch (err) {
      logger.error('WebRTC policy error.', err);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'WebRTC API not available' };
}
