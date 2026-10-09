// NetShield WebRTC Leak Protection Controller

export async function applyWebRTCProtection(enabled) {
  if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.webRTCIPHandlingPolicy) {
    try {
      if (enabled) {
        const details = await chrome.privacy.network.webRTCIPHandlingPolicy.get({});
        if (details.levelOfControl === 'controlled_by_other_extensions' || details.levelOfControl === 'not_controllable') {
          console.warn('[NetShield] WebRTC policy cannot be set (levelOfControl: ' + details.levelOfControl + ')');
          return { success: false, reason: details.levelOfControl };
        }
        await chrome.privacy.network.webRTCIPHandlingPolicy.set({
          value: 'default_public_interface_only'
        });
        console.log('[NetShield] WebRTC IP protection ACTIVE (default_public_interface_only)');
      } else {
        await chrome.privacy.network.webRTCIPHandlingPolicy.clear({});
        console.log('[NetShield] WebRTC IP protection CLEARED');
      }
      return { success: true };
    } catch (err) {
      console.warn('[NetShield] WebRTC policy error:', err);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'WebRTC API not available' };
}
