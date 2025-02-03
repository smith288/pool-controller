// server/controllers/apiController.js

exports.getStatus = (serialHandler) => (req, res) => {
  res.json(serialHandler.currentStatuses);
};

exports.toggleSwitch = (serialHandler) => (req, res) => {
  const { type, value } = req.params;

  if (!serialHandler.currentStatuses.hasOwnProperty(type)) {
    return res.status(400).json({ success: false, message: `Invalid switch type: ${type}` });
  }

  const newState = value.toLowerCase() === 'true';

  serialHandler.sendCommand(type, newState, true);
  res.json({ success: true, type, newState });
};

exports.toggleLights = (serialHandler) => (req, res) => {
  const currentLightsState = serialHandler.currentStatuses.lights;
  serialHandler.sendCommand('lights', !currentLightsState, true);
  res.json({ success: true, newState: !currentLightsState });
};
